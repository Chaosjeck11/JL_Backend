# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Maintenance
After significant changes to the codebase, update this CLAUDE.md 
to reflect new architecture, added services, or changed conventions.



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

**Docker-Hinweis:** Der Container (`jl-backend-t`) enthält eine eigenständige Kopie des Quellcodes — kein Volume-Mount. Nach Code-Änderungen auf dem Host müssen Dateien explizit kopiert werden. **Container-Updates führt ausschließlich der User durch** — Claude gibt nur die nötigen Befehle an:
```bash
docker cp backend/src/... jl-backend-t:/app/src/...
docker exec jl-backend-t sh -c "cd /app && npm run build"
docker restart jl-backend-t
# Bei Schema-Änderungen zusätzlich:
docker cp backend/prisma/schema.prisma jl-backend-t:/app/prisma/schema.prisma
docker exec jl-backend-t sh -c "cd /app && ./node_modules/.bin/prisma migrate dev --name <migration-name>"
```

## Architecture

**Stack:** NestJS · Prisma ORM · PostgreSQL · JWT (Passport)

**Module structure:**

- `PrismaModule` — global singleton wrapping `PrismaClient`, imported by every feature module that needs DB access.
- `AuthModule` — handles `POST /auth/login`, returns a JWT. The JWT payload carries `sub` (memberId), `email`, `accessLevel`, and `role`.
- `MembersModule` — CRUD for `Member` records; Multer-Upload für Avatar-Bilder (`uploads/avatars/`) und Member-Anhänge (`uploads/member-attachments/`, alle Dateitypen, max 50 MB).
- `FinanceModule` — Kassenbuch-Verwaltung, aufgeteilt in fünf Sub-Ressourcen:
  - `BusinessYear` — Geschäftsjahre mit aggregierten Kennzahlen und Datumsgrenzen
  - `Category` — Buchungskategorien
  - `Transaction` — Einzelbuchungen mit Rückbuchungslogik
  - `Mitgliedsbeitrag` — Beitragsverwaltung je Member × Geschäftsjahr
  - `Attachment` — Dateianhänge (Belege, Rechnungen, PDFs) an Transaktionen; Multer-Upload auf lokalem Filesystem
- `FilesModule` — General-purpose file manager at route `/files`. Multer disk storage to `uploads/files/`, UUID filenames, all mimetypes, max 50 MB. `uploadedBy` FK → Member (from JWT `sub`). AccessLevel(0) for all reads; AccessLevel(5) for upload, update, delete.
- `VeranstaltungenModule` — Veranstaltungsverwaltung at routes `/veranstaltungen` and `/veranstaltung-form-template`. Two controllers in one module: `VeranstaltungenController` (CRUD, attachments, form rows, financials, all-attachments) and `FormTemplateController` (global template GET/PATCH). Files at `uploads/veranstaltung-attachments/`, all mimetypes, max 50 MB.

**Authorization flow:**

Every protected route uses two guards applied together at the controller level:
1. `AuthGuard("jwt")` — validates the Bearer token via `JwtStrategy`, attaches the decoded payload as `request.user`.
2. `AccessLevelGuard` — reads the `@AccessLevel(n)` decorator on the handler and compares it against `request.user.accessLevel`. Access level `0` = any authenticated user; `5` = admin operations (create, update, delete).

`accessLevel` is defined on the **Role**, not the Member. The JWT payload reads `member.role.accessLevel` at login time. Changing a member's role automatically changes their effective permissions on next login.

## Data model

### Role

Defines the permission level for a group of members. `accessLevel` is stored here — not on the Member.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `name` | String | unique |
| `description` | String? | |
| `accessLevel` | Int | default 0 |

Seeded roles:
- **Mitglied** — `accessLevel: 0` (einfaches Vereinsmitglied, read-only access)
- **Admin** — `accessLevel: 5` (Systemadministrator, full access)

### Member

Belongs to a `Role` (many-to-one). Members are soft-deactivated via `active: false` + `inactiveSince` timestamp — no hard delete.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `firstname`, `lastname` | String | |
| `email` | String | unique |
| `passwordHash` | String | bcrypt; update via `password` field in PATCH |
| `birthday` | DateTime? | |
| `phone`, `address` | String? | |
| `avatarPath` | String? | UUID-based filename stored in `uploads/avatars/`; managed via avatar endpoints |
| `roleId` | Int | FK → Role |
| `active` | Boolean | default true |
| `inactiveSince` | DateTime? | set automatically on deactivate |
| `joinedAt` | DateTime | default now(); settable on create and updatable via PATCH |
| `u18` | Boolean | default false |
| `bereitsMitglied` | Boolean | default false — already member of parent org |
| `schuelerStudentAzubi` | Boolean | default false |
| `berufstaetig` | Boolean | default false |
| `excludeFromBeitrag` | Boolean | default false — skips Mitgliedsbeitrag generation entirely |

All fields except `id` are editable via `PATCH /members/:id`. Send `password` (plaintext) to update the password — it is hashed server-side before storage. `joinedAt` can be set on creation and updated afterwards. `accessLevel` is **not** a Member field — it derives from the assigned Role.

### MemberAttachment

File attachments linked to a `Member` (onDelete: Cascade).

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `memberId` | Int | FK → Member (cascade delete) |
| `filename` | String | original filename as uploaded |
| `storedName` | String | unique UUID-based filename on disk |
| `mimeType` | String | |
| `size` | Int | bytes |
| `uploadedAt` | DateTime | default now() |

Files stored at `uploads/member-attachments/` relative to `process.cwd()`. Covered by the same `/app/uploads` Docker volume as avatars and transaction attachments.

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

`tag` (optional, `PaymentTag` enum): payment method tag — `ONLINE` or `BAR`. Settable on create and updatable via PATCH.

`memberId` (optional): when set on an `EINZAHLUNG` with `isMitgliedsbeitrag` category, the `Mitgliedsbeitrag` record for that member × year is updated automatically. On deletion, the record is recomputed from remaining transactions.

`veranstaltungId` (optional): links the transaction to a `Veranstaltung`. Settable on create and updatable via PATCH (nullable — send `null` to unlink). Response always includes `veranstaltung: { id, name } | null`.

Has a `attachments` relation to `TransactionAttachment` (`onDelete: Cascade`).

### TransactionAttachment

File attachments (receipts, invoices, emails) linked to a `Transaction`.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `transactionId` | Int | FK → Transaction (cascade delete) |
| `filename` | String | original filename as uploaded |
| `storedName` | String | unique UUID-based filename on disk |
| `mimeType` | String | |
| `size` | Int | bytes |
| `uploadedAt` | DateTime | default now() |

Files stored at `uploads/attachments/` relative to `process.cwd()`. Mount `/app/uploads` as a Docker volume to persist files across container rebuilds. Requires `@types/multer` devDependency.

All upload directories are under `/app/uploads/` and covered by the same Docker volume:
- `uploads/avatars/` — Member avatars (images only, max 5 MB); old file deleted on re-upload
- `uploads/attachments/` — Transaction attachments (all mimetypes, no size limit configured)
- `uploads/member-attachments/` — Member attachments (all mimetypes, max 50 MB)
- `uploads/files/` — General FilesModule uploads (all mimetypes, max 50 MB)
- `uploads/veranstaltung-attachments/` — Direct Veranstaltung attachments (all mimetypes, max 50 MB)

### Veranstaltung

Event record. Each Veranstaltung gets a `VeranstaltungForm` created automatically at creation time (snapshot of the current global template columns).

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `name` | String | |
| `date` | DateTime | |
| `description` | String? | |
| `createdAt`, `updatedAt` | DateTime | |

Relations: `transactions Transaction[]`, `attachments VeranstaltungAttachment[]`, `form VeranstaltungForm?`

### VeranstaltungAttachment

Direct file attachments on a `Veranstaltung` (not tied to a specific transaction). `onDelete: Cascade`.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `veranstaltungId` | Int | FK → Veranstaltung (cascade delete) |
| `filename` | String | original filename |
| `storedName` | String | unique UUID-based filename on disk |
| `mimeType` | String | |
| `size` | Int | bytes |
| `uploadedAt` | DateTime | default now() |

Files stored at `uploads/veranstaltung-attachments/`.

### VeranstaltungFormTemplate

Singleton — only one record ever exists (id=1, created lazily on first access). Defines the column structure applied to new Veranstaltungen. Changes do **not** affect existing forms.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `columns` | Json | `Array<{ id: string, label: string, type: string }>` |
| `updatedAt` | DateTime | |

### VeranstaltungForm

One-to-one with `Veranstaltung`. Created automatically on Veranstaltung creation with a snapshot of the template's `columns`. The snapshot is immutable — subsequent template changes don't alter existing forms.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `veranstaltungId` | Int | unique FK → Veranstaltung (cascade delete) |
| `columns` | Json | snapshot of template columns at creation time |
| `createdAt`, `updatedAt` | DateTime | |

### VeranstaltungFormRow

Individual rows of a `VeranstaltungForm`. `cells` is a free JSON map of `{ columnId: value }`.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `formId` | Int | FK → VeranstaltungForm (cascade delete) |
| `rowIndex` | Int | display order; auto-incremented if not provided on create |
| `cells` | Json | `{ [columnId: string]: unknown }` |
| `createdAt`, `updatedAt` | DateTime | |

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
  - Aktives Mitglied: fehlende Einträge werden erstellt, sofern `byEnd >= joinedAt` (Geschäftsjahr endet 31.01. des Folgejahres); bei Reaktivierung (`active: false→true`) nur Geschäftsjahre, die noch nicht vollständig abgelaufen sind; `betragJL`/`betragKG` auf bestehenden Einträgen werden **nur** aktualisiert, wenn die `businessYearId` im optionalen Body-Feld `retroactiveYearIds: number[]` angegeben ist
  - Bestehende Einträge für Geschäftsjahre, deren Ende **vor** `joinedAt` liegt, werden automatisch gelöscht — aber **nur wenn** `bezahltJL === 0` und `bezahltKG === 0`
  - Inaktives Mitglied: Beiträge für Geschäftsjahre, die **nach** `inactiveSince` beginnen (01.02.), werden gelöscht (nur wenn unbezahlt); nur Einträge in `retroactiveYearIds` werden in Bezug auf Beträge aktualisiert, keine neuen erstellt
  - `excludeFromBeitrag = true`: alle unbezahlten Beiträge werden gelöscht
- `PATCH /members/:id/deactivate`: setzt nur `active=false, inactiveSince=now()` — **keine** Beitrag-Bereinigung (dafür PATCH verwenden)

**Manueller Backfill:** `POST /finance/mitgliedsbeitraege/generate` (AccessLevel 5) — erstellt fehlende Beiträge für alle aktiven Mitglieder × alle Geschäftsjahre (idempotent via upsert).

## API Routes

### Members

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/members` | 0 | All members incl. role, mitgliedsbeitraege |
| GET | `/members/roles` | 0 | All roles ordered by accessLevel |
| GET | `/members/:id` | 0 | Single member incl. role, mitgliedsbeitraege, transactions |
| POST | `/members` | 5 | Create member; required `roleId`; optional `joinedAt` (ISO string, default now()); creates Mitgliedsbeitrag for all business years ending after joinedAt |
| PATCH | `/members/:id` | 5 | Update any field except id/accessLevel; send `password` to update password (hashed server-side); `active`/`inactiveSince` directly settable; optional `retroactiveYearIds: number[]` to apply fee changes to specific past years |
| PATCH | `/members/:id/deactivate` | 5 | Sets active=false, inactiveSince=now() (bypasses Beitrag cleanup — use PATCH for that) |
| POST | `/members/:id/avatar` | 5 | Upload avatar (multipart/form-data, field `file`; images only, max 5 MB); replaces old file |
| GET | `/members/:id/avatar` | 0 | Serve avatar image inline |
| DELETE | `/members/:id/avatar` | 5 | Delete avatar file + clear avatarPath |

### Members — Attachments

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/members/:id/attachments` | 0 | List attachments for member |
| POST | `/members/:id/attachments` | 5 | Upload file (multipart/form-data, field `file`); all mimetypes, max 50 MB |
| GET | `/members/:id/attachments/:aid/download` | 0 | Download file with original filename |
| DELETE | `/members/:id/attachments/:aid` | 5 | Delete DB record + file from disk |

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
| POST | `/finance/transactions` | 5 | Create with validation; updates Mitgliedsbeitrag if applicable; optional `tag: ONLINE\|BAR` |
| PATCH | `/finance/transactions/:id` | 5 | date, description, categoryId, memberId, tag (nullable), veranstaltungId (nullable — send null to unlink) |
| DELETE | `/finance/transactions/:id` | 5 | Only if no reversals; recomputes Mitgliedsbeitrag if applicable |

### Finance — Mitgliedsbeiträge

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/finance/mitgliedsbeitraege` | 0 | All; optional `?businessYearId=&memberId=&status=` |
| GET | `/finance/mitgliedsbeitraege/:id` | 0 | Single record incl. member, businessYear |
| PATCH | `/finance/mitgliedsbeitraege/:id` | 5 | Manual correction of bezahltJL / bezahltKG; status auto-recomputed |
| POST | `/finance/mitgliedsbeitraege/generate` | 5 | One-time backfill: upsert Beiträge für alle aktiven Mitglieder × alle Geschäftsjahre |

### Finance — Transaction Attachments

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/finance/transactions/:id/attachments` | 0 | List attachments for transaction |
| POST | `/finance/transactions/:id/attachments` | 5 | Upload file (multipart/form-data, field name `file`) |
| GET | `/finance/transactions/:id/attachments/:aid/download` | 0 | Download file with original filename |
| DELETE | `/finance/transactions/:id/attachments/:aid` | 5 | Delete DB record + file from disk |

### Veranstaltungen

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/veranstaltungen` | 0 | All events; includes `_count` for transactions and attachments |
| POST | `/veranstaltungen` | 5 | Create; body: `name`, `date` (ISO string), `description?`; auto-creates `VeranstaltungForm` from current template snapshot |
| GET | `/veranstaltungen/:id` | 0 | Single event incl. transactions (with category + member), attachments, form with rows |
| PATCH | `/veranstaltungen/:id` | 5 | Update `name`, `date`, `description` |
| DELETE | `/veranstaltungen/:id` | 5 | Delete event + cascade (form, rows, attachments); also deletes attachment files from disk |
| GET | `/veranstaltungen/:id/financials` | 0 | `{ einnahmen, ausgaben, saldo }` — computed live from linked transactions; RUECKBUCHUNG direction resolved via related transaction type |
| GET | `/veranstaltungen/:id/all-attachments` | 0 | `{ direct: VeranstaltungAttachment[], fromTransactions: TransactionAttachment[] }` — all attachments reachable under this event |
| GET | `/veranstaltungen/:id/attachments` | 0 | Direct attachments only |
| POST | `/veranstaltungen/:id/attachments` | 5 | Upload direct attachment (multipart/form-data, field `file`); all mimetypes, max 50 MB |
| GET | `/veranstaltungen/:id/attachments/:aid/download` | 0 | Download with `Content-Disposition: attachment` |
| DELETE | `/veranstaltungen/:id/attachments/:aid` | 5 | Delete DB record + file from disk |
| GET | `/veranstaltungen/:id/form` | 0 | Form columns snapshot + all rows ordered by `rowIndex` |
| POST | `/veranstaltungen/:id/form/rows` | 5 | Add row; body: `cells?: { [colId]: value }`, `rowIndex?` (auto-appended if omitted) |
| PATCH | `/veranstaltungen/:id/form/rows/:rowId` | 5 | Update `cells` and/or `rowIndex` |
| DELETE | `/veranstaltungen/:id/form/rows/:rowId` | 5 | Delete row |

### Veranstaltung Form Template

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/veranstaltung-form-template` | 0 | Get global template (created lazily if not exists); `columns: Array<{ id, label, type }>` |
| PATCH | `/veranstaltung-form-template` | 5 | Replace `columns` array; only affects new Veranstaltungen created after this change |

### Files

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/files` | 0 | All files; optional `?path=` to filter by folder |
| GET | `/files/folders` | 0 | List distinct folder paths |
| POST | `/files/upload` | 5 | Upload file (multipart/form-data, field `file`); body fields: `path?` (folder), `description?` |
| GET | `/files/:id/download` | 0 | Download with `Content-Disposition: attachment` |
| GET | `/files/:id/preview` | 0 | Inline view with `Content-Disposition: inline` (PDF/image) |
| PATCH | `/files/:id` | 5 | Update `description` and/or `path` |
| DELETE | `/files/:id` | 5 | Delete DB record + file from disk |

## Key design decisions

**Live carryOver:** `BusinessYear.carryOver` in the DB is only the seed for the oldest year (manually adjustable via PATCH). All other years' `carryOver` values are computed on every `findOne` call by walking prior years chronologically. This ensures retroactive transaction changes are always reflected.

**Mitgliedsbeitrag auto-payment:** Payments are allocated JL-first. Status transitions automatically: `AUSSTEHEND → TEILWEISE → BEZAHLT`. Manual override available via PATCH.

**inactiveSince vs active:** `active` is the fast boolean flag. `inactiveSince` records the exact timestamp and is used to determine whether a member owed fees for a given year (if they were active at the year's start date).

**Veranstaltung form template snapshot:** The global `VeranstaltungFormTemplate` defines the column schema. On Veranstaltung creation the current `columns` JSON is copied into the `VeranstaltungForm` record (snapshot). All subsequent template edits only affect future Veranstaltungen. Row `cells` is a free `{ [columnId]: value }` map — no server-side enforcement of column schema, frontend is responsible for matching cells to the form's column list.

**Veranstaltung all-attachments aggregation:** `GET /veranstaltungen/:id/all-attachments` is a separate endpoint (not embedded in `GET /:id`) to keep the main detail response lean and allow independent caching. Returns `direct` (VeranstaltungAttachment) and `fromTransactions` (TransactionAttachment, each tagged with its transaction summary) as distinct arrays.

## Seeder (`src/seed.ts`)

Idempotent — safe to run multiple times. Each section uses `upsert` or `findFirst`-guard:
1. Roles — upsert "Mitglied" (`accessLevel: 0`) and "Admin" (`accessLevel: 5`)
2. Admin member — upsert `admin@jl.local` with role "Admin" (password: `admin123`)
3. Default categories — upsert by `name`; sets `isMitgliedsbeitrag: true` on "Mitgliedsbeitrag"
4. BusinessYears — creates all years from 2023 to current year if missing; generates Mitgliedsbeitrag records for active members
5. Members — TODO, pending full member list

**CORS:** Configured for `http://localhost:5173` and `http://127.0.0.1:5173` (Vite frontend).
