# JL Backend

NestJS · Prisma ORM · PostgreSQL · JWT

---

## Voraussetzungen

- [Node.js](https://nodejs.org/) ≥ 18
- [Docker](https://www.docker.com/) & Docker Compose
- `openssl` (zum Generieren von Secrets)

---

## Initialisierung (Ersteinrichtung)

### 1. Repository klonen

```bash
git clone <repo-url>
cd JL_Backend
```

### 2. Umgebungsvariablen anlegen

```bash
cp backend/.env.example backend/.env
```

Dann `backend/.env` bearbeiten und alle `CHANGE_ME`-Platzhalter ersetzen:

```bash
# Sicheres JWT_SECRET generieren:
openssl rand -hex 32

# Sicheres DB-Passwort generieren:
openssl rand -base64 24 | tr -d '/+='
```

> **Wichtig:** `JWT_SECRET` muss mindestens 32 Zeichen lang sein.  
> `ADMIN_SEED_PASSWORD` wird nur beim ersten `npm run seed` verwendet.

### 3. Datenbank starten

```bash
docker compose -f example-compose.yml up db -d
```

Für lokale Entwicklung ohne den vollen Stack reicht:

```bash
# In backend/.env: DATABASE_URL=postgresql://jl_user:PASSWORT@localhost:5432/jl_db
docker compose -f example-compose.yml up db -d
```

### 4. Abhängigkeiten installieren

```bash
cd backend
npm install
```

### 5. Datenbankmigrationen ausführen

```bash
npm run prisma:migrate
# Prisma Client neu generieren (nach Schema-Änderungen):
npm run prisma:generate
```

### 6. Datenbank seeden (Rollen, Admin-User, Standardkategorien)

```bash
npm run seed
```

Erstellt:
- Alle Rollen (Mitglied bis Admin)
- Admin-User `admin@jl.local` mit dem Passwort aus `ADMIN_SEED_PASSWORD`
- Standard-Buchungskategorien
- Geschäftsjahre ab 2023

> **Nach dem ersten Seeding das Passwort des Admin-Users über die App ändern.**

---

## Entwicklung

```bash
cd backend

# Dev-Server mit Hot-Reload starten:
npm run start:dev
```

Die API ist dann unter `http://localhost:3000` erreichbar.

---

## Bauen (Produktions-Build)

```bash
cd backend
npm run build
# Erzeugt: backend/dist/
```

Produktionsstart:

```bash
node dist/main.js
```

---

## Docker-Stack starten (Produktion)

Die `example-compose.yml` dient als Vorlage. Für den echten Betrieb kopieren und anpassen:

```bash
cp example-compose.yml compose.yml
```

Alle Variablen werden aus `backend/.env` gelesen (via `environment`-Block in der Compose-Datei).  
Pflichtfelder die gesetzt sein müssen: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_SEED_PASSWORD`.

```bash
# Stack starten:
docker compose up -d

# Logs verfolgen:
docker compose logs -f backend

# Stack stoppen:
docker compose down
```

### Erstes Seeding im Container

```bash
docker exec -it jl-backend npm run seed
```

### Code-Änderungen in laufenden Container übertragen

Der Container enthält eine eigenständige Kopie des Quellcodes (kein Volume-Mount). Nach Änderungen:

```bash
docker cp backend/src/DATEI jl-backend:/app/src/DATEI
docker exec jl-backend sh -c "cd /app && npm run build"
docker restart jl-backend

# Bei Prisma-Schema-Änderungen zusätzlich:
docker cp backend/prisma/schema.prisma jl-backend:/app/prisma/schema.prisma
docker exec jl-backend sh -c "cd /app && ./node_modules/.bin/prisma migrate dev --name <migration-name>"
```

---

## Umgebungsvariablen — Übersicht

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL-Connection-String |
| `POSTGRES_DB` | ✅ | DB-Name (Standard: `jl_db`) |
| `POSTGRES_USER` | ✅ | DB-User (Standard: `jl_user`) |
| `POSTGRES_PASSWORD` | ✅ | DB-Passwort — niemals hardcoden |
| `JWT_SECRET` | ✅ | Min. 32 Zeichen, zufällig generiert |
| `ADMIN_SEED_PASSWORD` | ✅ | Nur beim ersten Seeding benötigt |
| `CORS_ORIGINS` | — | Kommagetrennte Frontend-URLs (Standard: `http://localhost:5173`) |

---

## Datenbankpasswort einer laufenden Instanz ändern

```bash
# 1. Neues Passwort in PostgreSQL setzen (während DB läuft):
docker exec -it jl-postgres psql -U jl_user -d jl_db \
  -c "ALTER USER jl_user WITH PASSWORD 'NEUES_PASSWORT';"

# 2. backend/.env aktualisieren (DATABASE_URL + POSTGRES_PASSWORD)

# 3. Backend neu starten:
docker restart jl-backend
```

---

## Wichtige API-Endpunkte

| Methode | Route | Beschreibung |
|---|---|---|
| POST | `/auth/login` | Login, gibt JWT zurück |
| GET | `/members` | Mitgliederliste |
| GET | `/veranstaltungen` | Alle Events |
| GET | `/veranstaltungen/ical` | Öffentlicher iCal-Feed (kein Auth) |
| GET | `/finance/business-years` | Geschäftsjahre (L3+) |

Vollständige API-Dokumentation: siehe `CLAUDE.md`.
