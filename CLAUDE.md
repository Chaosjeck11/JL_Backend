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

## Architecture

**Stack:** NestJS · Prisma ORM · PostgreSQL · JWT (Passport)

**Module structure:**

- `PrismaModule` — global singleton wrapping `PrismaClient`, imported by every feature module that needs DB access.
- `AuthModule` — handles `POST /auth/login`, returns a JWT. The JWT payload carries `sub` (memberId), `email`, `accessLevel`, and `role`.
- `MembersModule` — CRUD for `Member` records (`GET/POST /members`, `GET/PATCH /members/:id`, `PATCH /members/:id/deactivate`).
- `FinanceModule` — Kassenbuch-Verwaltung, aufgeteilt in drei Sub-Ressourcen:
  - `BusinessYear` — Geschäftsjahre mit aggregierten Kennzahlen
  - `Category` — Buchungskategorien
  - `Transaction` — Einzelbuchungen mit Rückbuchungslogik

**Authorization flow:**

Every protected route uses two guards applied together at the controller level:
1. `AuthGuard("jwt")` — validates the Bearer token via `JwtStrategy`, attaches the decoded payload as `request.user`.
2. `AccessLevelGuard` — reads the `@AccessLevel(n)` decorator on the handler and compares it against `request.user.accessLevel`. Access level `0` = any authenticated user; `5` = admin operations (create, update, delete).

**Data model:**

`Member` belongs to a `Role` (many-to-one). `Role` is a simple lookup table (`id`, `name`, `description`). Members are soft-deleted via `active: false` — there is no hard delete endpoint.

`BusinessYear` holds one fiscal year (`year` unique) and a `carryOver` float. When a new `BusinessYear` is created, the previous year's calculated balance is automatically used as `carryOver`.

`Category` is a lookup table for transaction categories (`name` unique).

`Transaction` belongs to both `BusinessYear` and `Category`. The `type` enum has three values:
- `EINZAHLUNG` — income, adds to balance
- `AUSZAHLUNG` — expense, subtracts from balance
- `RUECKBUCHUNG` — reversal of a prior transaction; requires `relatedTransactionId`. Sign is derived from the original transaction's type. `type` and `amount` are immutable after creation.

**Finance API routes:**

| Method | Route | AccessLevel | Description |
|--------|-------|-------------|-------------|
| GET | `/finance/business-years` | 0 | All business years |
| GET | `/finance/business-years/:id` | 0 | One year with totalIncome, totalExpenses, balance |
| POST | `/finance/business-years` | 5 | Create; auto-sets carryOver from prior year |
| PATCH | `/finance/business-years/:id` | 5 | Update carryOver |
| DELETE | `/finance/business-years/:id` | 5 | Only if no transactions exist |
| GET | `/finance/categories` | 0 | All categories |
| GET | `/finance/categories/:id` | 0 | Single category |
| POST | `/finance/categories` | 5 | Create; name must be unique |
| PATCH | `/finance/categories/:id` | 5 | Update name/description |
| DELETE | `/finance/categories/:id` | 5 | Only if no transactions assigned |
| GET | `/finance/transactions` | 0 | All transactions; optional `?businessYearId=&categoryId=&type=` |
| GET | `/finance/transactions/balance/:businessYearId` | 0 | Running balance array |
| GET | `/finance/transactions/:id` | 0 | Single transaction incl. relations |
| POST | `/finance/transactions` | 5 | Create with validation |
| PATCH | `/finance/transactions/:id` | 5 | Only date, description, categoryId |
| DELETE | `/finance/transactions/:id` | 5 | Only if no reversals reference it |

**Seeder (`src/seed.ts`):**

Idempotent — safe to run multiple times. Each section uses `upsert` or `findFirst`-guard:
1. Default categories (6 entries, upsert by `name`)
2. BusinessYear 2023 with 4 transactions from the Kassenbuch Excel
3. BusinessYear 2025 (carryOver 119) with 1 transaction
4. Members — TODO, pending full member list

**CORS:** Configured for `http://localhost:5173` and `http://127.0.0.1:5173` (Vite frontend).
