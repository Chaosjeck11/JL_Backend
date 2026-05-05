# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `backend/`:

```bash
npm run start:dev       # Dev server with hot reload
npm run build           # Compile TypeScript to dist/
npm run prisma:generate # Regenerate Prisma client after schema changes
npm run prisma:migrate  # Run migrations against the dev database
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

**Authorization flow:**

Every members route is protected by two guards applied together:
1. `AuthGuard("jwt")` — validates the Bearer token via `JwtStrategy`, attaches the decoded payload as `request.user`.
2. `AccessLevelGuard` — reads the `@AccessLevel(n)` decorator on the handler and compares it against `request.user.accessLevel`. Access level `0` = any authenticated user; `5` = admin operations (create, update, deactivate).

**Data model:**

`Member` belongs to a `Role` (many-to-one). `Role` is a simple lookup table (`id`, `name`, `description`). Members are soft-deleted via `active: false` — there is no hard delete endpoint.

**CORS:** Configured for `http://localhost:5173` (the expected Vite frontend origin).
