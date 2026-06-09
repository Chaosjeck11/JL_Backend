# JL Backend

REST-API für die Vereinsverwaltung der Jungen Löwen.

**Stack:** NestJS · Prisma ORM · PostgreSQL · JWT (Passport) · Docker

---

## Inhaltsverzeichnis

1. [Voraussetzungen](#voraussetzungen)
2. [Ersteinrichtung (lokal)](#ersteinrichtung-lokal)
3. [Docker-Setup (Produktion)](#docker-setup-produktion)
4. [Umgebungsvariablen](#umgebungsvariablen)
5. [Nützliche Befehle](#nützliche-befehle)
6. [API-Dokumentation](#api-dokumentation)

---

## Voraussetzungen

| Tool | Mindestversion |
|---|---|
| Node.js | 18 |
| Docker + Docker Compose | aktuell |
| `openssl` | beliebig (für Secret-Generierung) |

---

## Ersteinrichtung (lokal)

### 1. Repository klonen

```bash
git clone <repo-url>
cd JL_Backend
```

### 2. Umgebungsvariablen anlegen

```bash
cp .env.example .env
```

`.env` öffnen und alle Platzhalter ersetzen. Sichere Werte generieren:

```bash
# JWT_SECRET (mindestens 32 Zeichen):
openssl rand -hex 32

# Datenbankpasswort:
openssl rand -base64 24 | tr -d '/+='
```

> Für lokale Entwicklung ohne Docker: `DATABASE_URL` auf `@localhost:5432` ändern.

### 3. Datenbank starten

```bash
docker compose up db -d
```

### 4. Abhängigkeiten installieren

```bash
cd backend
npm install
```

### 5. Migrationen ausführen & Prisma Client generieren

```bash
npm run prisma:migrate
npm run prisma:generate
```

### 6. Datenbank seeden

```bash
npm run seed
```

Erstellt: alle Rollen, Admin-User (`admin@jl.local` mit Passwort aus `ADMIN_SEED_PASSWORD`), Standardkategorien, Strafenkatalog, Geschäftsjahre ab 2023.

> **Nach dem ersten Seeding:** Admin-Passwort über die App ändern. `ADMIN_SEED_PASSWORD` kann danach aus der `.env` entfernt werden.

### 7. Dev-Server starten

```bash
npm run start:dev
# API erreichbar unter: http://localhost:3000
```

---

## Docker-Setup (Produktion)

### docker-compose.yml — Erläuterung

```yaml
services:
  db:
    image: postgres:16
    container_name: jl-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-jl_db}           # DB-Name, Standard: jl_db
      POSTGRES_USER: ${POSTGRES_USER:-jl_user}     # DB-User, Standard: jl_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?...} # Pflicht — bricht ab wenn nicht gesetzt
    volumes:
      - ./data/postgres:/var/lib/postgresql/data   # Datenpersistenz auf dem Host

  backend:
    build: ./backend                               # Baut das Image aus backend/Dockerfile
    container_name: jl-backend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      # "db" = Service-Name im Docker-Netzwerk, kein localhost
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET must be set}
      ADMIN_SEED_PASSWORD: ${ADMIN_SEED_PASSWORD:?...}
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173}
    volumes:
      - /mnt/lokal_nas/storage/services/Junge_loewen:/app/uploads  # Upload-Persistenz
      - ./Builds:/Builds                                            # App-Builds für Update-Endpoint
    depends_on:
      - db                                         # Backend startet erst wenn DB bereit
    networks:
      - jl-net                                     # Internes Netz (Backend ↔ DB)
      - web                                        # Externes Netz (z.B. Traefik/Reverse Proxy)
    ports:
      - "3000:3000"                                # Port-Mapping Host:Container

networks:
  jl-net:
    driver: bridge    # Internes Netz — nur DB und Backend kommunizieren hier
  web:
    external: true    # Externes Netz muss vorher existieren (z.B. durch Traefik)
```

### Stack starten

```bash
# Alle Services starten:
docker compose up -d

# Logs verfolgen:
docker compose logs -f backend
docker compose logs -f db

# Stack stoppen (Daten bleiben erhalten):
docker compose down

# Stack stoppen + Volumes löschen (ACHTUNG: löscht DB-Daten):
docker compose down -v
```

### Erstes Seeding im laufenden Container

```bash
docker exec -it jl-backend npm run seed
```

### Build-Status prüfen

```bash
docker compose ps
docker inspect jl-backend | grep Status
```

### Code-Änderungen in laufenden Container übertragen

Der Container enthält eine eigenständige Kopie des Quellcodes — kein Volume-Mount auf `src/`. Nach Änderungen manuell kopieren:

```bash
# Einzelne Datei:
docker cp backend/src/module/datei.ts jl-backend:/app/src/module/datei.ts

# Neu bauen:
docker exec jl-backend sh -c "cd /app && npm run build"
docker restart jl-backend

# Bei Prisma-Schema-Änderungen zusätzlich:
docker cp backend/prisma/schema.prisma jl-backend:/app/prisma/schema.prisma
docker exec jl-backend sh -c "cd /app && ./node_modules/.bin/prisma migrate dev --name <migration-name>"
```

### Datenbankpasswort ändern (laufende Instanz)

```bash
# 1. Neues Passwort in PostgreSQL setzen:
docker exec -it jl-postgres psql -U jl_user -d jl_db \
  -c "ALTER USER jl_user WITH PASSWORD 'NEUES_PASSWORT';"

# 2. .env aktualisieren (POSTGRES_PASSWORD + DATABASE_URL)

# 3. Backend neu starten:
docker restart jl-backend
```

---

## Umgebungsvariablen

Alle Variablen werden aus der `.env`-Datei im Root-Verzeichnis geladen.  
Vorlage: `.env.example`.

| Variable | Pflicht | Standard | Beschreibung |
|---|---|---|---|
| `POSTGRES_DB` | — | `jl_db` | PostgreSQL Datenbankname |
| `POSTGRES_USER` | — | `jl_user` | PostgreSQL Benutzername |
| `POSTGRES_PASSWORD` | ✅ | — | PostgreSQL Passwort — stark und zufällig |
| `DATABASE_URL` | ✅ | — | Vollständiger Connection-String (im Docker-Stack: Hostname `db`) |
| `JWT_SECRET` | ✅ | — | Mindestens 32 Zeichen, zufällig generiert |
| `ADMIN_SEED_PASSWORD` | ✅* | — | Passwort für `admin@jl.local` — nur beim Seeding nötig |
| `CORS_ORIGINS` | — | `http://localhost:5173` | Kommagetrennte erlaubte Frontend-Origins |

> `*` Nach dem ersten Seeding optional.

---

## Nützliche Befehle

Alle Befehle aus `backend/`:

```bash
npm run start:dev       # Dev-Server mit Hot-Reload
npm run build           # TypeScript → dist/ kompilieren
npm run start           # Produktionsstart (nach build)
npm run prisma:generate # Prisma Client neu generieren (nach Schema-Änderungen)
npm run prisma:migrate  # Migrationen gegen die Dev-DB ausführen
npm run seed            # Seeder ausführen (idempotent)
```

---

## API-Dokumentation

### Authentifizierung

Alle geschützten Endpunkte erwarten einen `Authorization: Bearer <token>` Header.  
Token wird via `POST /auth/login` bezogen (gültig 8 Stunden).

**Access Levels:**

| Level | Rolle | Kurzbeschreibung |
|---|---|---|
| 0 | Mitglied | Lesen von Events/Files, eigene Strafen, eigenes Avatar |
| 1 | Strafenwart | + Strafenkatalog verwalten, alle Strafen lesen/schreiben/bezahlen |
| 2 | Orgateam | + Veranstaltungen schreiben, Mitglieder-Details lesen |
| 3 | Vorstand | + Mitglieder erstellen/deaktivieren/bearbeiten, Finanzen lesen |
| 4 | Kassenwart | + Finanzen Vollzugriff, Beiträge/Strafen bezahlen |
| 5 | Admin | Vollzugriff + Rollenvergabe, Backfill, Form-Template |

---

### Auth

| Methode | Route | Auth | Beschreibung |
|---|---|---|---|
| POST | `/auth/login` | — | Login mit `email` + `password` im Body; gibt `access_token` zurück. Rate-limitiert: max. 10 Requests/Minute pro IP. |

**Request:**
```json
{ "email": "user@example.com", "password": "geheim" }
```
**Response:**
```json
{ "access_token": "eyJ..." }
```

---

### Members

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/members` | 0 | Mitgliederliste. L0/L1: nur `{id, firstname, lastname}`. L2+: vollständiger Datensatz. |
| GET | `/members/roles` | 0 | Alle Rollen sortiert nach accessLevel. |
| GET | `/members/:id` | 2 | Einzelnes Mitglied inkl. Rolle, Mitgliedsbeiträge, Transaktionen. |
| POST | `/members` | 3 | Mitglied anlegen. Pflichtfeld: `roleId`. Optional: `joinedAt` (ISO-String). Erstellt automatisch Mitgliedsbeiträge. |
| PATCH | `/members/:id` | 3 | Felder aktualisieren. `roleId`-Änderung nur für L5. `password` (Klartext) → serverseitig gehasht. Optional: `retroactiveYearIds: number[]`. |
| PATCH | `/members/:id/deactivate` | 3 | Setzt `active=false`, `inactiveSince=now()`. |
| POST | `/members/:id/avatar` | 0 | Avatar hochladen (`multipart/form-data`, Feld `file`). Nur Bilder, max. 5 MB. L0–L4: nur eigenes Avatar. L5: jedes Avatar. |
| GET | `/members/:id/avatar` | 0 | Avatar inline ausgeben. |
| DELETE | `/members/:id/avatar` | 0 | Avatar löschen. L0–L4: nur eigenes. L5: jedes. |

#### Members — Anhänge

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/members/:id/attachments` | 2 | Alle Anhänge eines Mitglieds. |
| POST | `/members/:id/attachments` | 5 | Datei hochladen (`multipart/form-data`, Feld `file`). Alle Typen, max. 50 MB. |
| GET | `/members/:id/attachments/:aid/download` | 2 | Datei herunterladen. |
| DELETE | `/members/:id/attachments/:aid` | 5 | Anhang löschen (DB + Datei). |

---

### Finance — Geschäftsjahre

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/finance/business-years` | 3 | Alle Geschäftsjahre mit `startDate`, `endDate`. |
| GET | `/finance/business-years/:id` | 3 | Einzelnes Jahr mit `totalIncome`, `totalExpenses`, `balance` (live), `mitgliedsbeitraege`. |
| POST | `/finance/business-years` | 4 | Neues Geschäftsjahr anlegen. `carryOver` wird automatisch aus dem Vorjahres-Saldo gesetzt. Erstellt Mitgliedsbeiträge für alle aktiven Mitglieder. |
| PATCH | `/finance/business-years/:id` | 4 | `carryOver` manuell korrigieren (nur für das älteste Jahr relevant). |
| DELETE | `/finance/business-years/:id` | 4 | Löschen — nur wenn keine Buchungen vorhanden. Löscht auch Mitgliedsbeiträge. |

---

### Finance — Kategorien

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/finance/categories` | 3 | Alle Kategorien inkl. `isMitgliedsbeitrag`. |
| GET | `/finance/categories/:id` | 3 | Einzelne Kategorie. |
| POST | `/finance/categories` | 4 | Anlegen. `name` muss eindeutig sein. |
| PATCH | `/finance/categories/:id` | 4 | `name`, `description`, `isMitgliedsbeitrag` ändern. |
| DELETE | `/finance/categories/:id` | 4 | Löschen — nur wenn keine Buchungen zugewiesen. |

---

### Finance — Transaktionen

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/finance/transactions` | 3 | Alle Buchungen. Filter: `?businessYearId=&categoryId=&memberId=&type=` |
| GET | `/finance/transactions/balance/:businessYearId` | 3 | Laufender Saldoverlauf als Array. |
| GET | `/finance/transactions/:id` | 3 | Einzelne Buchung inkl. Kategorie, Geschäftsjahr, Mitglied, Rückbuchungen. |
| POST | `/finance/transactions` | 4 | Buchung anlegen. `type`: `EINZAHLUNG` / `AUSZAHLUNG` / `RUECKBUCHUNG` (erfordert `relatedTransactionId`). Optional: `tag: ONLINE\|BAR`, `memberId`, `veranstaltungId`. |
| PATCH | `/finance/transactions/:id` | 4 | `date`, `description`, `categoryId`, `memberId`, `tag` (nullable), `veranstaltungId` (nullable — `null` trennt Verknüpfung). |
| DELETE | `/finance/transactions/:id` | 4 | Löschen — nur wenn keine Rückbuchungen vorhanden. |

---

### Finance — Mitgliedsbeiträge

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/finance/mitgliedsbeitraege` | 3 | Alle Beiträge. Filter: `?businessYearId=&memberId=&status=` |
| GET | `/finance/mitgliedsbeitraege/:id` | 3 | Einzelner Beitrag inkl. Mitglied und Geschäftsjahr. |
| PATCH | `/finance/mitgliedsbeitraege/:id` | 4 | `bezahltJL` / `bezahltKG` manuell korrigieren. Status wird automatisch neu berechnet. |
| POST | `/finance/mitgliedsbeitraege/generate` | 5 | Einmaliger Backfill: erstellt fehlende Beiträge für alle aktiven Mitglieder × alle Geschäftsjahre (idempotent). |

---

### Finance — Transaktions-Anhänge

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/finance/transactions/:id/attachments` | 3 | Alle Anhänge einer Transaktion. |
| POST | `/finance/transactions/:id/attachments` | 4 | Datei hochladen (`multipart/form-data`, Feld `file`). |
| GET | `/finance/transactions/:id/attachments/:aid/download` | 3 | Datei herunterladen. |
| DELETE | `/finance/transactions/:id/attachments/:aid` | 4 | Anhang löschen (DB + Datei). |

---

### Veranstaltungen

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/veranstaltungen` | 0 | Alle Events inkl. `_count` (Transaktionen/Anhänge) und `kategorien[]`. |
| POST | `/veranstaltungen` | 2 | Anlegen. Body: `name`, `date` (ISO-String), `description?`, `kategorieIds?: number[]`. Erstellt automatisch ein `VeranstaltungForm` aus dem aktuellen Template. |
| GET | `/veranstaltungen/:id` | 0 | Einzelnes Event inkl. Transaktionen, Anhänge, Form mit Rows, `kategorien[]`. |
| PATCH | `/veranstaltungen/:id` | 2 | `name`, `date`, `description`, `kategorieIds?: number[]` (vollständiger Ersatz des Kategorie-Sets). |
| DELETE | `/veranstaltungen/:id` | 2 | Löschen inkl. Cascade (Form, Rows, Anhänge + Dateien). |
| GET | `/veranstaltungen/:id/financials` | 0 | `{ einnahmen, ausgaben, saldo }` — live aus verknüpften Transaktionen. |
| GET | `/veranstaltungen/:id/all-attachments` | 0 | `{ direct: [], fromTransactions: [] }` — alle erreichbaren Anhänge. |
| GET | `/veranstaltungen/:id/attachments` | 0 | Nur direkte Anhänge. |
| POST | `/veranstaltungen/:id/attachments` | 2 | Datei hochladen (`multipart/form-data`, Feld `file`). Alle Typen, max. 50 MB. |
| GET | `/veranstaltungen/:id/attachments/:aid/download` | 0 | Datei herunterladen. |
| DELETE | `/veranstaltungen/:id/attachments/:aid` | 2 | Anhang löschen (DB + Datei). |
| GET | `/veranstaltungen/:id/form` | 0 | Formular-Spalten (Snapshot) + alle Rows sortiert nach `rowIndex`. |
| PATCH | `/veranstaltungen/:id/form` | 2 | Spalten des Event-Formulars aktualisieren (nur dieses Event, nicht das globale Template). |
| POST | `/veranstaltungen/:id/form/rows` | 2 | Neue Row. Body: `cells?: { [colId]: value }`, `rowIndex?` (wird ans Ende angehängt wenn weggelassen). |
| PATCH | `/veranstaltungen/:id/form/rows/:rowId` | 2 | `cells` und/oder `rowIndex` aktualisieren. |
| DELETE | `/veranstaltungen/:id/form/rows/:rowId` | 2 | Row löschen. |
| GET | `/veranstaltungen/ical` | **öffentlich** | iCal-Feed aller Events (kein JWT nötig). Direkt in Kalender-Apps abonnierbar. |

---

### Veranstaltung Form Template

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/veranstaltung-form-template` | 0 | Globales Template lesen (wird beim ersten Zugriff automatisch angelegt). `columns: Array<{id, label, type}>`. |
| PATCH | `/veranstaltung-form-template` | 5 | Spalten ersetzen. Betrifft nur **neue** Veranstaltungen — bestehende Forms bleiben unverändert. |

---

### Veranstaltung-Kategorien

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/veranstaltung-kategorien` | 0 | Alle Kategorien inkl. `_count.veranstaltungen`. |
| GET | `/veranstaltung-kategorien/:id` | 0 | Einzelne Kategorie. |
| POST | `/veranstaltung-kategorien` | 2 | Anlegen. `name` (eindeutig), `description?`, `color?` (Hex, z.B. `"#FF5733"`). |
| PATCH | `/veranstaltung-kategorien/:id` | 2 | Beliebige Felder aktualisieren. |
| DELETE | `/veranstaltung-kategorien/:id` | 2 | Löschen — blockiert (HTTP 400) wenn noch Events zugewiesen sind. |

---

### Files

Allgemeiner Dateimanager für beliebige Vereinsdokumente.

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/files` | 0 | Alle Dateien. Optional: `?path=ordner` zum Filtern nach Ordner. |
| GET | `/files/folders` | 0 | Alle vorhandenen Ordnerpfade (distinct). |
| POST | `/files/upload` | 0 | Datei hochladen (`multipart/form-data`, Feld `file`). Body: `path?` (Ordner), `description?`. Alle Typen, max. 50 MB. |
| GET | `/files/:id/download` | 0 | Datei herunterladen (`Content-Disposition: attachment`). |
| GET | `/files/:id/preview` | 0 | Datei inline ansehen (`Content-Disposition: inline` — für PDF/Bilder). |
| PATCH | `/files/:id` | 0 | `description` und/oder `path` ändern. |
| DELETE | `/files/:id` | 0 | Datei löschen (DB + Datei). |

---

### Strafenkatalog

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/strafen` | 0 | Alle Strafarten inkl. `_count.eintraege`. |
| GET | `/strafen/:id` | 0 | Einzelne Strafart. |
| POST | `/strafen` | 0* | Anlegen. `name` (eindeutig), `betrag`, `beschreibung?`. *Runtime-Check: L1 oder L3+. |
| PATCH | `/strafen/:id` | 0* | Felder ändern. *Runtime-Check: L1 oder L3+. |
| DELETE | `/strafen/:id` | 0* | Löschen — blockiert (HTTP 400) wenn Einträge existieren. *Runtime-Check: L1 oder L3+. |

---

### Strafen — Einträge

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/strafen/eintraege` | 0 | Einträge. L0/L2: nur eigene. L1/L3+: alle. Filter: `?memberId=&strafeId=&businessYearId=&bezahlt=` |
| GET | `/strafen/eintraege/summary` | 0 | Aggregierte Übersicht (offen/bezahlt pro Mitglied × Geschäftsjahr). L0/L2: nur eigene. L1/L3+: alle. Filter: `?memberId=&businessYearId=` |
| GET | `/strafen/eintraege/:id` | 0 | Einzelner Eintrag. L0/L2 können nur eigene abrufen. |
| POST | `/strafen/eintraege` | 0* | Strafe zuweisen. *Runtime-Check: L1 oder L3+. |
| PATCH | `/strafen/eintraege/:id` | 0* | `grund` (L1, L3+) und/oder `bezahlt` (L1, L4+) aktualisieren. |
| POST | `/strafen/eintraege/:id/bezahlen` | 0* | Als bezahlt markieren mit `datum` + `tag`. *Runtime-Check: L1 oder L4+. |
| POST | `/strafen/eintraege/:id/stornieren` | 0* | Zahlung rückgängig machen. *Runtime-Check: L1 oder L4+. |
| DELETE | `/strafen/eintraege/:id` | 0* | Eintrag löschen. *Runtime-Check: L1 oder L3+. |

---

### Update (Desktop-App)

| Methode | Route | Level | Beschreibung |
|---|---|---|---|
| GET | `/update/check` | 0 | Prüfen ob neue Version verfügbar. Query: `?version=1.0.0&platform=linux\|windows\|android`. |
| GET | `/update/download` | 0 | Neueste Version herunterladen. Query: `?platform=linux\|windows\|android`. |

Builds werden aus dem `Builds/`-Verzeichnis (neben `backend/`) gelesen. Struktur: `Builds/<semver>/<platform>/<datei>`.

---

## Sicherheitshinweise

- **Rate Limiting:** `POST /auth/login` ist auf 10 Requests/Minute pro IP limitiert. Alle anderen Endpunkte: 20 Requests/Minute.
- **Inaktive Mitglieder** können sich nicht einloggen (`active: false` wird beim Login geprüft).
- **JWT-Secret** muss mindestens 32 Zeichen lang sein — die App verweigert den Start sonst.
- **Rollen-Änderungen** (`roleId`) sind nur für L5 (Admin) möglich.
- **Uploads** werden mit UUID-Dateinamen gespeichert — keine Pfad-Traversal-Möglichkeit.
- **HTTP-Sicherheitsheader** werden via `helmet` gesetzt (CSP, X-Frame-Options, HSTS etc.).
