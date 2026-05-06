# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `backend/`:

```bash
npm run start:dev       # Dev server with hot reload
npm run build           # Compile TypeScript to dist/
npm run prisma:generate # Regenerate Prisma client after schema changes
npm run prisma:migrate  # Run migrations against the dev database
npm run seed            # Run the database seeder (idempotent)
```

Start the PostgreSQL database (required for local dev):

```bash
docker compose up db -d
```

The backend requires a `.env` file in `backend/` with at least:
```
DATABASE_URL=postgresql://jl_user:jl_password@localhost:5432/jl_db
JWT_SECRET=<secret>
```

**Docker-Hinweis:** Der Container (`jl-backend`) enthält eine eigenständige Kopie des Quellcodes — kein Volume-Mount. Nach Code-Änderungen auf dem Host müssen Dateien explizit kopiert werden:
```bash
docker cp backend/src/... jl-backend:/app/src/...
docker exec jl-backend sh -c "cd /app && npm run build"
docker restart jl-backend
# Bei Schema-Änderungen zusätzlich:
docker cp backend/prisma/schema.prisma jl-backend:/app/prisma/schema.prisma
docker exec jl-backend sh -c "cd /app && ./node_modules/.bin/prisma db push"
```

## Architecture

**Stack:** NestJS · Prisma ORM · PostgreSQL · JWT (Passport)

**Module structure:**

- `PrismaModule` — global singleton wrapping `PrismaClient`, imported by every feature module that needs DB access.
- `AuthModule` — handles `POST /auth/login`, returns a JWT. The JWT payload carries `sub` (memberId), `email`, `accessLevel`, and `role`.
- `MembersModule` — CRUD for `Member` records.
- `FinanceModule` — Kassenbuch-Verwaltung, aufgeteilt in vier Sub-Ressourcen:
  - `BusinessYear` — Geschäftsjahre mit aggregierten Kennzahlen und Datumsgrenzen
  - `Category` — Buchungskategorien
  - `Transaction` — Einzelbuchungen mit Rückbuchungslogik
  - `Mitgliedsbeitrag` — Beitragsverwaltung je Member × Geschäftsjahr

**Authorization flow:**

Every protected route uses two guards applied together at the controller level:
1. `AuthGuard("jwt")` — validates the Bearer token via `JwtStrategy`, attaches the decoded payload as `request.user`.
2. `AccessLevelGuard` — reads the `@AccessLevel(n)` decorator on the handler and compares it against `request.user.accessLevel`. Access level `0` = any authenticated user; `5` = admin operations (create, update, delete).

## Data model

### Member

Belongs to a `Role` (many-to-one). Members are soft-deactivated via `active: false` + `inactiveSince` timestamp — no hard delete.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `firstname`, `lastname` | String | |
| `email` | String | unique |
| `passwordHash` | String | bcrypt |
| `birthday` | DateTime? | |
| `phone`, `address`, `avatarPath` | String? | |
| `roleId` | Int | FK → Role |
| `accessLevel` | Int | default 0 |
| `active` | Boolean | default true |
| `inactiveSince` | DateTime? | set automatically on deactivate |
| `joinedAt` | DateTime | default now(); settable on create |
| `u18` | Boolean | default false |
| `bereitsMitglied` | Boolean | default false — already member of parent org |
| `schuelerStudentAzubi` | Boolean | default false |
| `berufstaetig` | Boolean | default false |

All fields except `id`, `joinedAt`, and `passwordHash` are editable via `PATCH /members/:id`. `joinedAt` can be set on creation but not updated afterwards.

### BusinessYear

A fiscal year named by its start year. **2025 runs from 01.02.2025 to 31.01.2026.**
`startDate` and `endDate` are computed from `year` and returned in every response (not stored).

`carryOver` stored in DB is used as the seed for the **oldest** year only. For all other years, `carryOver` is computed live by walking all prior years chronologically — so retroactive transaction changes are always reflected correctly.

When a new `BusinessYear` is created, `Mitgliedsbeitrag` records are automatically generated for all currently active members.

### Category

Lookup table for transaction categories (`name` unique). Special flag:
- `isMitgliedsbeitrag: Boolean` — marks the "Mitgliedsbeitrag" category; drives automatic Beitrag tracking when transactions are booked against it.

### Transaction

Belongs to `BusinessYear`, `Category`, and optionally `Member`. The `type` enum:
- `EINZAHLUNG` — income
- `AUSZAHLUNG` — expense
- `RUECKBUCHUNG` — reversal; requires `relatedTransactionId`. `type` and `amount` are immutable after creation.

`memberId` (optional): when set on an `EINZAHLUNG` with `isMitgliedsbeitrag` category, the `Mitgliedsbeitrag` record for that member × year is updated automatically. On deletion, the record is recomputed from remaining transactions.

### Mitgliedsbeitrag

Tracks the fee obligation and payment status for each Member × BusinessYear combination.

| Field | Type | Notes |
|---|---|---|
| `memberId` | Int | FK → Member |
| `businessYearId` | Int | FK → BusinessYear |
| `betragJL` | Float | always 35 € |
| `betragKG` | Float | 65 € (full) or 0 € (reduced) |
| `bezahltJL` | Float | paid towards JL portion |
| `bezahltKG` | Float | paid towards KG portion |
| `status` | BeitragStatus | `AUSSTEHEND \| TEILWEISE \| BEZAHLT` |

**Fee rules:**
- Reduced (35 € total, JL only): `u18 = true` OR `schuelerStudentAzubi = true` OR `bereitsMitglied = true`
- Full (100 € total): all other members — 35 € JL + 65 € KG

Payments fill JL first, then KG. Status is computed automatically; can be manually corrected via `PATCH /finance/mitgliedsbeitraege/:id`.

**Auto-creation / update triggers:**
- New `BusinessYear` created → Beiträge für alle aktuell aktiven Mitglieder (`active: true`)
- `PATCH /members/:id` → Beiträge werden immer neu berechnet:
  - Aktives Mitglied: fehlende Einträge werden erstellt; `betragJL`/`betragKG` auf bestehenden Einträgen werden **nur** aktualisiert, wenn die `businessYearId` im optionalen Body-Feld `retroactiveYearIds: number[]` angegeben ist
  - Inaktives Mitglied: nur Einträge in `retroactiveYearIds` werden aktualisiert, keine neuen erstellt
- Deaktivierung: keine Aktion — bereits erstellte Beiträge bleiben bestehen

**Manueller Backfill:** `POST /finance/mitgliedsbeitraege/generate` (AccessLevel 5) — erstellt fehlende Beiträge für alle aktiven Mitglieder × alle Geschäftsjahre (idempotent via upsert).

## API Routes

### Members

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/members` | 0 | All members incl. role, mitgliedsbeitraege |
| GET | `/members/:id` | 0 | Single member incl. role, mitgliedsbeitraege, transactions |
| POST | `/members` | 5 | Create member; optional `joinedAt` (ISO string, default now()); creates Mitgliedsbeitrag for all business years ending after joinedAt |
| PATCH | `/members/:id` | 5 | Update any field except id/joinedAt/passwordHash; optional `retroactiveYearIds: number[]` to apply fee changes to specific past years |
| PATCH | `/members/:id/deactivate` | 5 | Sets active=false, inactiveSince=now() |

### Finance — Business Years

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/finance/business-years` | 0 | All years with startDate/endDate |
| GET | `/finance/business-years/:id` | 0 | One year with totalIncome, totalExpenses, balance (live carryOver), startDate, endDate, mitgliedsbeitraege |
| POST | `/finance/business-years` | 5 | Create; auto-sets carryOver from newest year's live balance; creates Mitgliedsbeitrag records |
| PATCH | `/finance/business-years/:id` | 5 | Update carryOver (seed value for oldest year) |
| DELETE | `/finance/business-years/:id` | 5 | Only if no transactions; also deletes Mitgliedsbeitrag records |

### Finance — Categories

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/finance/categories` | 0 | All categories incl. isMitgliedsbeitrag |
| GET | `/finance/categories/:id` | 0 | Single category |
| POST | `/finance/categories` | 5 | Create; name must be unique |
| PATCH | `/finance/categories/:id` | 5 | Update name, description, isMitgliedsbeitrag |
| DELETE | `/finance/categories/:id` | 5 | Only if no transactions assigned |

### Finance — Transactions

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/finance/transactions` | 0 | All; optional `?businessYearId=&categoryId=&memberId=&type=` |
| GET | `/finance/transactions/balance/:businessYearId` | 0 | Running balance array (uses live carryOver) |
| GET | `/finance/transactions/:id` | 0 | Single transaction incl. category, businessYear, member, reversals |
| POST | `/finance/transactions` | 5 | Create with validation; updates Mitgliedsbeitrag if applicable |
| PATCH | `/finance/transactions/:id` | 5 | date, description, categoryId, memberId |
| DELETE | `/finance/transactions/:id` | 5 | Only if no reversals; recomputes Mitgliedsbeitrag if applicable |

### Finance — Mitgliedsbeiträge

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/finance/mitgliedsbeitraege` | 0 | All; optional `?businessYearId=&memberId=&status=` |
| GET | `/finance/mitgliedsbeitraege/:id` | 0 | Single record incl. member, businessYear |
| PATCH | `/finance/mitgliedsbeitraege/:id` | 5 | Manual correction of bezahltJL / bezahltKG; status auto-recomputed |
| POST | `/finance/mitgliedsbeitraege/generate` | 5 | One-time backfill: upsert Beiträge für alle aktiven Mitglieder × alle Geschäftsjahre |

## Key design decisions

**Live carryOver:** `BusinessYear.carryOver` in the DB is only the seed for the oldest year (manually adjustable via PATCH). All other years' `carryOver` values are computed on every `findOne` call by walking prior years chronologically. This ensures retroactive transaction changes are always reflected.

**Mitgliedsbeitrag auto-payment:** Payments are allocated JL-first. Status transitions automatically: `AUSSTEHEND → TEILWEISE → BEZAHLT`. Manual override available via PATCH.

**inactiveSince vs active:** `active` is the fast boolean flag. `inactiveSince` records the exact timestamp and is used to determine whether a member owed fees for a given year (if they were active at the year's start date).

## Seeder (`src/seed.ts`)

Idempotent — safe to run multiple times. Each section uses `upsert` or `findFirst`-guard:
1. Default categories (6 entries, upsert by `name`; sets `isMitgliedsbeitrag: true` on "Mitgliedsbeitrag")
2. BusinessYear 2023 with 4 transactions from the Kassenbuch Excel
3. BusinessYear 2025 (carryOver 119) with 1 transaction
4. Members — TODO, pending full member list

**CORS:** Configured for `http://localhost:5173` and `http://127.0.0.1:5173` (Vite frontend).
