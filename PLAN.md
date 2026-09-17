# Lime Platform – Technology Lifecycle & EOL Registry
## Project Plan (PLAN.md)

> Keep this file in the root of the repository. Update the **Progress Tracker** (section 15) and **Work Log** (section 16) as you work, so you (or an AI coding assistant) can always continue from where you stopped.

- **Owner / developer:** Single developer
- **Created:** 17 September 2026
- **Current focus:** Backend APIs running in Docker Desktop (frontend comes later)

---

## 1. Project Summary

A web tool that is the single source of truth for the lifecycle of the open-source and third-party technologies used in the Lime Platform. It will:

- Keep a registry of technologies and versions (MongoDB, Node.js, Angular, Kubernetes, RHEL, Docker, Kafka, OpenSSL, …).
- Track EOL dates, pulled automatically from the **endoflife.date API v1** where possible, and entered manually otherwise.
- Map technology versions to Lime versions, customers, environments (DEV/UAT/PROD), locations (EC2/Customer site) and responsible teams.
- Track upgrade actions (owner, planned date, completion, Jira key, customer communication).
- Send notifications 180 / 90 / 30 / 0 days before EOL via **Microsoft Teams (Workflows webhook)** and **email**.
- Provide dashboard, timeline, personal inbox, search and Excel/CSV export.
- Protect everything with **authentication (Entra ID)** and **authorization (RBAC: Admin / Editor / Viewer)**.

**Out of scope (phase 1):** automatic upgrades of customer environments, vulnerability remediation, CI/CD integration, SBOM generation, automatic discovery from source code.

---

## 2. Final Architecture Decisions

| Topic | Decision |
|---|---|
| Containers | 3 app containers + database: **web** (later), **api**, **worker**, **db** |
| Backend | **NestJS** (TypeScript) on **Node.js 24 LTS** |
| One codebase, two entry points | `src/main.ts` → API, `src/worker.ts` → scheduled jobs. Same Docker image, different start command |
| Database | **PostgreSQL 16** |
| ORM / migrations | **Prisma** |
| Authentication | **Microsoft Entra ID** (OIDC, JWT validated with JWKS). `AUTH_MODE=dev` gives a local dev login until Entra is ready |
| Authorization | Role-based (`ADMIN`, `EDITOR`, `VIEWER`) using NestJS guards + `@Roles()` decorator |
| EOL data | `https://endoflife.date/api/v1/products/{slug}/` (Beta API → adapter + cache + manual override) |
| Teams alerts | Power Automate **Workflows** webhook with Adaptive Cards (old O365 connectors are retired) |
| Email | Nodemailer (SMTP or Amazon SES) |
| API docs | Swagger / OpenAPI at `/api/docs` |
| Local runtime | **Docker Desktop** + Docker Compose |
| Production (later) | Single EC2 instance, Docker Compose, Nginx TLS, nightly `pg_dump` to S3 |
| Frontend (later) | Angular + **spartan/ui** (Tailwind), "Timeline + Inbox" UX |
| Timezone | `Asia/Colombo` (change in `.env` if needed) |

---

## 3. Prerequisites (install once)

- [ ] Docker Desktop (Windows: enable **WSL 2** backend)
- [ ] Node.js 24 LTS + npm (for running CLI tools locally)
- [ ] Git
- [ ] VS Code (extensions: Prisma, ESLint, Docker, REST Client or Thunder Client)
- [ ] NestJS CLI: `npm i -g @nestjs/cli`
- [ ] Optional: DBeaver or pgAdmin to browse the database

---

## 4. Repository Structure

Created 2026-09-17. Feature modules live under `src/modules/`; shared domain
rules, cross-cutting mechanics and infrastructure sit beside it. See
`backend/src/modules/README.md` for the per-module responsibility table and the
standard file anatomy.

```
lime-eol-registry/
├── PLAN.md                     ← this file
├── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml          ← db + api + worker (+ pgadmin profile)
├── docker-compose.dev.yml      ← hot-reload overrides for development
├── docs/
│   ├── findings.md
│   ├── api-examples.http       ← REST Client requests
│   ├── diagrams/               ← C4 / architecture images
│   └── postman/                ← collection + local environment
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── nest-cli.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json     ← excludes prisma/ and test/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed/               ← seed.ts orchestrator + one file per data set
│   ├── src/
│   │   ├── main.ts             ← API entry point
│   │   ├── worker.ts           ← worker entry point
│   │   ├── app.module.ts
│   │   ├── worker.module.ts
│   │   ├── bootstrap/          ← swagger / security / validation / shutdown wiring
│   │   ├── config/
│   │   │   ├── env.validation.ts   ← zod schema, single source of truth
│   │   │   └── namespaces/         ← typed config: app, auth, eol, notification
│   │   ├── prisma/             ← PrismaService, PrismaModule
│   │   ├── common/             ← decorators, guards, interceptors, filters,
│   │   │                          pipes, pagination dto, types, utils
│   │   ├── lifecycle/          ← pure domain rules: cycle derivation, support
│   │   │                          status, display status, notification thresholds
│   │   ├── modules/
│   │   │   ├── health/
│   │   │   ├── auth/           ← strategies/, user provisioning, /auth/me
│   │   │   ├── users/
│   │   │   ├── teams/
│   │   │   ├── technologies/
│   │   │   ├── versions/
│   │   │   ├── lime-versions/
│   │   │   ├── customers/
│   │   │   ├── deployments/
│   │   │   ├── upgrade-actions/
│   │   │   ├── inbox/
│   │   │   ├── dashboard/
│   │   │   ├── search/
│   │   │   ├── reports/        ← builders/ + formatters/ (xlsx, csv)
│   │   │   ├── settings/
│   │   │   ├── audit/
│   │   │   ├── eol-sync/       ← ports/ + adapters/ + mappers/ + __fixtures__/
│   │   │   └── notifications/  ← ports/ + senders/ + templates/
│   │   └── jobs/               ← cron jobs (loaded only by worker.module)
│   └── test/
│       ├── jest-e2e.json
│       ├── helpers/
│       └── e2e/
└── frontend/                   ← later (Angular + spartan/ui)
```

---

## 5. Environment Variables (`.env.example`)

```dotenv
# ---- General ----
NODE_ENV=development
TZ=Asia/Colombo
API_PORT=3000
APP_BASE_URL=http://localhost:4200

# ---- Database ----
POSTGRES_USER=lime
POSTGRES_PASSWORD=change_me
POSTGRES_DB=lime_eol
DATABASE_URL=postgresql://lime:change_me@db:5432/lime_eol?schema=public

# ---- Auth ----
# dev = local login endpoint (never in production), entra = Microsoft Entra ID
AUTH_MODE=dev
DEV_JWT_SECRET=dev_only_secret_change_me
ENTRA_TENANT_ID=
ENTRA_API_CLIENT_ID=
ENTRA_AUDIENCE=api://<api-client-id>

# ---- EOL sync ----
EOL_API_BASE=https://endoflife.date/api/v1
SYNC_CRON=0 2 * * *
STATUS_APPROACHING_DAYS=180

# ---- Notifications ----
NOTIFY_CRON=0 8 * * *
NOTIFY_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Lime Lifecycle <lifecycle@example.com>"
# Teams webhook URLs are stored per team in the database (team.teams_webhook_url)

# ---- pgAdmin (optional) ----
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=change_me
```

Rules: never commit `.env`; validate all variables at startup (`src/config`); the app must refuse to start with `AUTH_MODE=dev` when `NODE_ENV=production`.

---

## 6. Docker Setup

### 6.1 `backend/Dockerfile`

```dockerfile
FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- development (hot reload) ----
FROM base AS dev
RUN npm ci
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "start:dev"]

# ---- build ----
FROM base AS build
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- production ----
FROM node:24-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
USER node
CMD ["node", "dist/main.js"]
```

Notes:
- Put `prisma` (CLI) in **dependencies**, not devDependencies, so `prisma migrate deploy` works in the prod image.
- `tsconfig.build.json` must exclude `prisma` and `test`, otherwise the build output becomes `dist/src/main.js`.
- `.dockerignore`: `node_modules`, `dist`, `.env`, `coverage`.
- If using Prisma 7 or newer, follow its current docs (generator name and datasource URL config have changed); adjust the commands above accordingly.

### 6.2 `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build:
      context: ./backend
      target: prod
    restart: unless-stopped
    env_file: .env
    command: sh -c "npx prisma migrate deploy && node dist/main.js"
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy

  worker:
    build:
      context: ./backend
      target: prod
    restart: unless-stopped
    env_file: .env
    command: node dist/worker.js
    depends_on:
      db:
        condition: service_healthy
      api:
        condition: service_started

  pgadmin:
    image: dpage/pgadmin4
    profiles: ["tools"]
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD}
    ports:
      - "5050:80"
    depends_on:
      - db

volumes:
  pgdata:
```

### 6.3 `docker-compose.dev.yml` (hot reload)

```yaml
services:
  api:
    build:
      target: dev
    command: sh -c "npx prisma migrate dev && npm run start:dev"
    volumes:
      - ./backend:/app
      - /app/node_modules
  worker:
    build:
      target: dev
    command: npm run start:worker:dev
    volumes:
      - ./backend:/app
      - /app/node_modules
```

### 6.4 Everyday commands

| Task | Command |
|---|---|
| Start (dev, hot reload) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` |
| Start (prod-like) | `docker compose up --build -d` |
| Start with pgAdmin | `docker compose --profile tools up -d` |
| Stop | `docker compose down` |
| Reset database (deletes data!) | `docker compose down -v` |
| API logs | `docker compose logs -f api` |
| Worker logs | `docker compose logs -f worker` |
| New migration | `docker compose exec api npx prisma migrate dev --name <name>` |
| Seed data | `docker compose exec api npx prisma db seed` |
| Prisma Studio | `docker compose exec api npx prisma studio` (or run locally) |
| Run tests | `docker compose exec api npm test` |

URLs: API `http://localhost:3000/api/v1` · Swagger `http://localhost:3000/api/docs` · Health `http://localhost:3000/api/v1/health` · pgAdmin `http://localhost:5050`

### 6.5 `package.json` scripts (backend)

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "start:worker": "node dist/worker.js",
    "start:worker:dev": "nest start --watch --entryFile worker",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "prisma": { "seed": "ts-node prisma/seed.ts" }
}
```

### 6.6 Main packages

`@nestjs/core @nestjs/common @nestjs/platform-express @nestjs/config @nestjs/swagger @nestjs/schedule @nestjs/terminus @nestjs/passport @nestjs/jwt passport passport-jwt jwks-rsa @prisma/client prisma class-validator class-transformer nodemailer exceljs json2csv helmet zod`
Dev: `@types/passport-jwt @types/nodemailer jest supertest ts-node`

---

## 7. Database Design

### 7.1 `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ComponentType {
  DATABASE
  RUNTIME
  FRAMEWORK
  OS
  CONTAINER
  ORCHESTRATION
  MESSAGING
  LIBRARY
  OTHER
}

enum EolSource {
  API
  MANUAL
}

enum Environment {
  DEV
  UAT
  PROD
}

enum DeploymentLocation {
  EC2
  CUSTOMER_SITE
}

enum ActionStatus {
  NOT_STARTED
  PLANNED
  IN_PROGRESS
  COMPLETED
  DEFERRED
}

enum CommStatus {
  NOT_REQUIRED
  PENDING
  SENT
  ACKNOWLEDGED
}

enum Role {
  ADMIN
  EDITOR
  VIEWER
}

enum Channel {
  EMAIL
  TEAMS
}

model Technology {
  id            String              @id @default(uuid()) @db.Uuid
  name          String              @unique
  componentType ComponentType       @map("component_type")
  vendor        String?
  eolSlug       String?             @map("eol_slug")        // endoflife.date product slug
  cycleRule     String              @default("MAJOR") @map("cycle_rule") // MAJOR | MAJOR_MINOR
  eolField      String              @default("eol") @map("eol_field")    // eol | eoas | eoes
  referenceUrl  String?             @map("reference_url")
  notes         String?
  createdAt     DateTime            @default(now()) @map("created_at")
  updatedAt     DateTime            @updatedAt @map("updated_at")
  versions      TechnologyVersion[]
  syncLogs      EolSyncLog[]

  @@map("technology")
}

model TechnologyVersion {
  id                  String                @id @default(uuid()) @db.Uuid
  technologyId        String                @map("technology_id") @db.Uuid
  fullVersion         String                @map("full_version")
  cycle               String
  releaseDate         DateTime?             @map("release_date") @db.Date
  eolDate             DateTime?             @map("eol_date") @db.Date
  activeSupportEnd    DateTime?             @map("active_support_end") @db.Date
  isLts               Boolean               @default(false) @map("is_lts")
  latestSupported     String?               @map("latest_supported")
  eolSource           EolSource             @default(API) @map("eol_source")
  lastSyncedAt        DateTime?             @map("last_synced_at")
  notes               String?
  createdAt           DateTime              @default(now()) @map("created_at")
  updatedAt           DateTime              @updatedAt @map("updated_at")
  technology          Technology            @relation(fields: [technologyId], references: [id], onDelete: Cascade)
  limeVersions        LimeVersionComponent[]
  deploymentOverrides DeploymentComponent[]
  upgradeActions      UpgradeAction[]
  notifications       NotificationLog[]

  @@unique([technologyId, fullVersion])
  @@index([eolDate])
  @@map("technology_version")
}

model LimeVersion {
  id            String                 @id @default(uuid()) @db.Uuid
  versionNumber String                 @unique @map("version_number")
  releaseDate   DateTime?              @map("release_date") @db.Date
  notes         String?
  components    LimeVersionComponent[]
  deployments   Deployment[]

  @@map("lime_version")
}

model LimeVersionComponent {
  limeVersionId String            @map("lime_version_id") @db.Uuid
  techVersionId String            @map("tech_version_id") @db.Uuid
  limeVersion   LimeVersion       @relation(fields: [limeVersionId], references: [id], onDelete: Cascade)
  techVersion   TechnologyVersion @relation(fields: [techVersionId], references: [id], onDelete: Cascade)

  @@id([limeVersionId, techVersionId])
  @@map("lime_version_component")
}

model Customer {
  id          String       @id @default(uuid()) @db.Uuid
  name        String       @unique
  code        String?      @unique
  contact     String?
  notes       String?
  deployments Deployment[]

  @@map("customer")
}

model Deployment {
  id             String                    @id @default(uuid()) @db.Uuid
  customerId     String                    @map("customer_id") @db.Uuid
  limeVersionId  String?                   @map("lime_version_id") @db.Uuid
  teamId         String?                   @map("team_id") @db.Uuid
  name           String
  environment    Environment
  location       DeploymentLocation
  notes          String?
  customer       Customer                  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  limeVersion    LimeVersion?              @relation(fields: [limeVersionId], references: [id])
  team           Team?                     @relation(fields: [teamId], references: [id])
  overrides      DeploymentComponent[]
  upgradeActions UpgradeActionDeployment[]

  @@unique([customerId, name, environment])
  @@map("deployment")
}

model DeploymentComponent {
  deploymentId  String            @map("deployment_id") @db.Uuid
  techVersionId String            @map("tech_version_id") @db.Uuid
  deployment    Deployment        @relation(fields: [deploymentId], references: [id], onDelete: Cascade)
  techVersion   TechnologyVersion @relation(fields: [techVersionId], references: [id], onDelete: Cascade)

  @@id([deploymentId, techVersionId])
  @@map("deployment_component")
}

model UpgradeAction {
  id                 String                    @id @default(uuid()) @db.Uuid
  techVersionId      String                    @map("tech_version_id") @db.Uuid
  teamId             String?                   @map("team_id") @db.Uuid
  assigneeId         String?                   @map("assignee_id") @db.Uuid
  targetVersion      String?                   @map("target_version")
  plannedDate        DateTime?                 @map("planned_date") @db.Date
  completedDate      DateTime?                 @map("completed_date") @db.Date
  status             ActionStatus              @default(NOT_STARTED)
  jiraKey            String?                   @map("jira_key")
  customerComm       CommStatus                @default(NOT_REQUIRED) @map("customer_comm")
  customerCommNotes  String?                   @map("customer_comm_notes")
  remarks            String?
  createdAt          DateTime                  @default(now()) @map("created_at")
  updatedAt          DateTime                  @updatedAt @map("updated_at")
  techVersion        TechnologyVersion         @relation(fields: [techVersionId], references: [id], onDelete: Cascade)
  team               Team?                     @relation(fields: [teamId], references: [id])
  assignee           AppUser?                  @relation(fields: [assigneeId], references: [id])
  deployments        UpgradeActionDeployment[]

  @@index([status, plannedDate])
  @@map("upgrade_action")
}

model UpgradeActionDeployment {
  upgradeActionId String        @map("upgrade_action_id") @db.Uuid
  deploymentId    String        @map("deployment_id") @db.Uuid
  upgradeAction   UpgradeAction @relation(fields: [upgradeActionId], references: [id], onDelete: Cascade)
  deployment      Deployment    @relation(fields: [deploymentId], references: [id], onDelete: Cascade)

  @@id([upgradeActionId, deploymentId])
  @@map("upgrade_action_deployment")
}

model Team {
  id              String          @id @default(uuid()) @db.Uuid
  name            String          @unique
  email           String?
  teamsWebhookUrl String?         @map("teams_webhook_url")
  members         TeamMember[]
  deployments     Deployment[]
  upgradeActions  UpgradeAction[]

  @@map("team")
}

model AppUser {
  id             String          @id @default(uuid()) @db.Uuid
  entraOid       String?         @unique @map("entra_oid")
  email          String          @unique
  displayName    String?         @map("display_name")
  role           Role            @default(VIEWER)
  isActive       Boolean         @default(true) @map("is_active")
  lastLoginAt    DateTime?       @map("last_login_at")
  teams          TeamMember[]
  assignedActions UpgradeAction[]
  auditLogs      AuditLog[]

  @@map("app_user")
}

model TeamMember {
  teamId String  @map("team_id") @db.Uuid
  userId String  @map("user_id") @db.Uuid
  team   Team    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user   AppUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([teamId, userId])
  @@map("team_member")
}

model NotificationRule {
  id            String   @id @default(uuid()) @db.Uuid
  thresholdDays Int      @unique @map("threshold_days")   // 180, 90, 30, 0
  emailEnabled  Boolean  @default(true) @map("email_enabled")
  teamsEnabled  Boolean  @default(true) @map("teams_enabled")
  isActive      Boolean  @default(true) @map("is_active")

  @@map("notification_rule")
}

model NotificationLog {
  id            String            @id @default(uuid()) @db.Uuid
  techVersionId String            @map("tech_version_id") @db.Uuid
  thresholdDays Int               @map("threshold_days")
  recipient     String
  channel       Channel
  success       Boolean
  error         String?
  sentAt        DateTime          @default(now()) @map("sent_at")
  techVersion   TechnologyVersion @relation(fields: [techVersionId], references: [id], onDelete: Cascade)

  @@unique([techVersionId, thresholdDays, recipient, channel])
  @@map("notification_log")
}

model EolSyncLog {
  id           String      @id @default(uuid()) @db.Uuid
  technologyId String?     @map("technology_id") @db.Uuid
  startedAt    DateTime    @default(now()) @map("started_at")
  finishedAt   DateTime?   @map("finished_at")
  success      Boolean     @default(false)
  changes      Int         @default(0)
  error        String?
  rawResponse  Json?       @map("raw_response")
  technology   Technology? @relation(fields: [technologyId], references: [id], onDelete: SetNull)

  @@map("eol_sync_log")
}

model AuditLog {
  id         BigInt   @id @default(autoincrement())
  userId     String?  @map("user_id") @db.Uuid
  entity     String
  entityId   String?  @map("entity_id")
  action     String   // CREATE | UPDATE | DELETE | SYNC | LOGIN
  beforeData Json?    @map("before_data")
  afterData  Json?    @map("after_data")
  createdAt  DateTime @default(now()) @map("created_at")
  user       AppUser? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([entity, entityId])
  @@map("audit_log")
}
```

### 7.2 Status view (add with a raw SQL migration)

Create with `npx prisma migrate dev --create-only --name status_view`, then paste into the generated `migration.sql`:

```sql
CREATE OR REPLACE VIEW v_version_status AS
SELECT tv.id,
       tv.technology_id,
       tv.full_version,
       tv.cycle,
       tv.eol_date,
       (tv.eol_date - CURRENT_DATE) AS days_to_eol,
       CASE
         WHEN tv.eol_date IS NULL               THEN 'UNKNOWN'
         WHEN tv.eol_date <= CURRENT_DATE       THEN 'EOL'
         WHEN tv.eol_date <= CURRENT_DATE + 180 THEN 'EOL_APPROACHING'
         ELSE 'SUPPORTED'
       END AS support_status
FROM technology_version tv;
```

Query it from Prisma with `prisma.$queryRaw`.

### 7.3 Impact query (which deployments use a version?)

```sql
SELECT d.* FROM deployment d
JOIN lime_version_component lvc ON lvc.lime_version_id = d.lime_version_id
WHERE lvc.tech_version_id = $1
UNION
SELECT d.* FROM deployment d
JOIN deployment_component dc ON dc.deployment_id = d.id
WHERE dc.tech_version_id = $1;
```

Rule: a deployment uses the components of its Lime version, **plus** any explicit overrides in `deployment_component`. (If an override replaces a Lime default of the same technology, the service layer must exclude the Lime default for that technology.)

### 7.4 Seed data (`prisma/seed.ts`)

- Notification rules: 180, 90, 30, 0.
- Technologies with slugs and cycle rules:

| Name | Slug | Type | Cycle rule |
|---|---|---|---|
| MongoDB | `mongodb` | DATABASE | MAJOR_MINOR |
| Node.js | `nodejs` | RUNTIME | MAJOR |
| Angular | `angular` | FRAMEWORK | MAJOR |
| Kubernetes | `kubernetes` | ORCHESTRATION | MAJOR_MINOR |
| RHEL | `rhel` | OS | MAJOR |
| Docker Engine | `docker-engine` | CONTAINER | MAJOR_MINOR |
| Apache Kafka | `apache-kafka` | MESSAGING | MAJOR_MINOR |
| OpenSSL | `openssl` | LIBRARY | MAJOR_MINOR |
| PostgreSQL | `postgresql` | DATABASE | MAJOR |

(Verify each slug on endoflife.date before relying on it.)

- One admin user, two teams (DevOps, Platform), two sample customers, one Lime version with components, a few deployments.

---

## 8. Authentication & Authorization

### 8.1 Modes

| `AUTH_MODE` | How it works | Use |
|---|---|---|
| `dev` | `POST /api/v1/auth/dev-login` `{ "email", "role" }` returns a JWT signed with `DEV_JWT_SECRET` | Local development only. Blocked when `NODE_ENV=production` |
| `entra` | Frontend signs in with MSAL; API validates bearer token using Entra JWKS (issuer `https://login.microsoftonline.com/<tenant>/v2.0`, audience `ENTRA_AUDIENCE`) | Test and production |

### 8.2 Flow

1. Request arrives with `Authorization: Bearer <token>`.
2. `JwtAuthGuard` (global) validates the token → else `401`.
3. User is upserted in `app_user` (match on `entra_oid` or email); `last_login_at` updated; inactive users → `403`.
4. Role = Entra `roles` claim (app roles `Admin`, `Editor`, `Viewer`) if present, else `app_user.role`.
5. `RolesGuard` checks `@Roles(...)` on the handler → else `403`.
6. `@Public()` decorator skips auth (only `health` and `dev-login`).
7. `AuditInterceptor` records every create/update/delete with user, before and after.

### 8.3 Permission matrix

| Area | VIEWER | EDITOR | ADMIN |
|---|---|---|---|
| Read everything, dashboard, search, export | ✅ | ✅ | ✅ |
| Create/edit technologies, versions, Lime versions | ❌ | ✅ | ✅ |
| Create/edit customers, deployments, mappings | ❌ | ✅ | ✅ |
| Create/edit upgrade actions | ❌ | ✅ | ✅ |
| Delete records | ❌ | ❌ | ✅ |
| Users, roles, teams, webhooks | ❌ | ❌ | ✅ |
| Notification rules, manual sync, test notification | ❌ | ❌ | ✅ |
| Audit log | ❌ | ❌ | ✅ |

### 8.4 Entra ID setup (when ready)

- [ ] App registration for the **API**: expose an API (`api://<client-id>`), define app roles Admin/Editor/Viewer.
- [ ] App registration for the **SPA**: redirect URI `http://localhost:4200`, API permission to the API scope.
- [ ] Assign users/groups to roles in Enterprise Applications.
- [ ] Fill `ENTRA_*` in `.env`, set `AUTH_MODE=entra`.

---

## 9. API Specification (v1)

Base path: `/api/v1` · JSON · paginated lists use `?page=1&pageSize=20&sort=field:asc` and return `{ items, total, page, pageSize }` · errors return `{ statusCode, message, error }`.

### 9.1 System & auth
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/health` | public | DB + app health |
| POST | `/auth/dev-login` | public (dev only) | Get dev JWT |
| GET | `/auth/me` | any | Current user, role, teams |

### 9.2 Registry
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/technologies` | any | List (filters: `type`, `q`) |
| POST | `/technologies` | editor | Create |
| GET | `/technologies/:id` | any | Detail with versions |
| PATCH | `/technologies/:id` | editor | Update |
| DELETE | `/technologies/:id` | admin | Delete |
| GET | `/technologies/:id/cycles` | any | Available cycles from endoflife.date (cached) |
| GET | `/versions` | any | List with status (filters: `status`, `technologyId`, `eolWithinDays`, `customerId`, `environment`, `limeVersionId`, `teamId`) |
| POST | `/technologies/:id/versions` | editor | Add version (cycle auto-derived) |
| GET | `/versions/:id` | any | Detail incl. status, EOL info |
| PATCH | `/versions/:id` | editor | Update (setting `eolDate` manually sets `eolSource=MANUAL`) |
| DELETE | `/versions/:id` | admin | Delete |
| GET | `/versions/:id/impact` | any | Affected deployments, customers, teams |
| GET | `/lime-versions` | any | List |
| POST | `/lime-versions` | editor | Create |
| GET | `/lime-versions/:id` | any | Detail with components |
| PATCH / DELETE | `/lime-versions/:id` | editor / admin | Update / delete |
| PUT | `/lime-versions/:id/components` | editor | Replace component list `{ techVersionIds: [] }` |

### 9.3 Customers & mapping
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET / POST | `/customers` | any / editor | List / create |
| GET / PATCH / DELETE | `/customers/:id` | any / editor / admin | Detail (with deployments) / update / delete |
| GET | `/customers/:id/components` | any | Effective components and statuses for all deployments |
| GET / POST | `/deployments` | any / editor | List (filters: `customerId`, `environment`, `location`, `teamId`) / create |
| GET / PATCH / DELETE | `/deployments/:id` | any / editor / admin | Detail (effective components) / update / delete |
| PUT | `/deployments/:id/overrides` | editor | Replace overrides `{ techVersionIds: [] }` |

### 9.4 Teams & users
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/teams` | any | List |
| POST / PATCH / DELETE | `/teams`, `/teams/:id` | admin | Manage (incl. webhook URL) |
| PUT | `/teams/:id/members` | admin | Replace members |
| GET | `/users` | admin | List |
| PATCH | `/users/:id` | admin | Change role / activate |

### 9.5 Upgrade actions & inbox
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/upgrade-actions` | any | List (filters: `status`, `overdue=true`, `teamId`, `assigneeId`, `customerId`) |
| POST | `/upgrade-actions` | editor | Create `{ techVersionId, targetVersion, teamId, assigneeId, plannedDate, deploymentIds[], jiraKey }` |
| GET | `/upgrade-actions/:id` | any | Detail |
| PATCH | `/upgrade-actions/:id` | editor | Update status, dates, comms, remarks (setting COMPLETED requires `completedDate`) |
| DELETE | `/upgrade-actions/:id` | admin | Delete |
| GET | `/inbox` | any | "Needs you" items for current user (see 10.4) |

### 9.6 Dashboard, search, reports
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/dashboard/summary` | any | Counts: tracked, EOL, approaching, within 30/90/180, open actions, overdue, affected deployments (same filters as `/versions`) |
| GET | `/dashboard/timeline?months=12` | any | Versions in use with EOL in the window, with days left and impact counts |
| GET | `/search?q=` | any | Grouped results: technologies, versions, customers, deployments, actions |
| GET | `/reports/registry?format=xlsx\|csv` | any | Full registry export |
| GET | `/reports/impact/:versionId?format=` | any | Impact report |
| GET | `/reports/actions?format=&from=&to=` | any | Upgrade action report |
| GET | `/reports/customer/:id?format=` | any | Customer lifecycle report |

### 9.7 Admin operations
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET / PUT | `/settings/notification-rules` | admin | Read / replace thresholds |
| POST | `/sync/run` | admin | Trigger EOL sync now (all or `?technologyId=`) |
| GET | `/sync/logs` | admin | Sync history |
| POST | `/notifications/test` | admin | Send test email / Teams card `{ teamId, channel }` |
| GET | `/notifications/logs` | admin | Sent notifications |
| GET | `/audit-logs` | admin | Audit history (filters: `entity`, `userId`, dates) |

---

## 10. Core Business Logic

### 10.1 Cycle derivation (`lifecycle/cycle.util.ts`)
- `MAJOR`: `20.11.1` → `20`, `9.4` → `9`
- `MAJOR_MINOR`: `6.0.14` → `6.0`, `1.30.2` → `1.30`
- Strip prefixes like `v`. Allow manual cycle override on the version.

### 10.2 EOL sync (worker, `SYNC_CRON`)
1. For each technology with `eolSlug`: `GET {EOL_API_BASE}/products/{slug}/` (timeout 10 s, 3 retries with backoff, 1 s delay between products).
2. Validate the response shape (`result.releases[]`). On failure → log in `eol_sync_log`, keep existing data, continue with next product.
3. For each registered version, find the release where `release.name === version.cycle`.
4. If `eolSource = API`: update `eolDate` from the field chosen by `technology.eolField` (`eolFrom`, `eoasFrom`, or `eoesFrom`), plus `releaseDate`, `activeSupportEnd` (`eoasFrom`), `isLts`, `latestSupported` (`latest.name`), `lastSyncedAt`. Never overwrite `MANUAL` records.
5. Save `raw_response` and change count in `eol_sync_log`.
6. If every product fails → notify admins.

### 10.3 Status rules
- Support status: `UNKNOWN` / `EOL` / `EOL_APPROACHING` / `SUPPORTED` (from the view, threshold from `STATUS_APPROACHING_DAYS`).
- Display status: if an open upgrade action exists → `UPGRADE_PLANNED` / `IN_PROGRESS`; if latest action COMPLETED → `UPGRADE_COMPLETED`; else the support status.
- Overdue action: `status NOT IN (COMPLETED, DEFERRED)` and `plannedDate < today`.
- Only versions **in use** (linked to a deployment through Lime version or override) count on the dashboard.

### 10.4 Inbox items for the current user
- Versions in use that are EOL/approaching, with **no** open action, for deployments owned by the user's teams → "needs an upgrade plan".
- Open actions assigned to the user or their team → sorted by planned date; overdue first.
- Actions with `customerComm = PENDING` → "tell the customer".

### 10.5 Notifications (worker, `NOTIFY_CRON`)
1. Skip if `NOTIFY_ENABLED=false` (log only).
2. For each version in use with `days_to_eol` not null:
   - Find the **smallest** active threshold `t` where `days_to_eol <= t`.
   - Skip if the latest related action is COMPLETED.
   - Recipients = teams owning affected deployments (Teams webhook + team email) and assignees of open actions (email).
   - For each recipient/channel: skip if `notification_log` already has `(version, t, recipient, channel)`; otherwise send and insert log (unique constraint prevents duplicates).
3. Overdue actions: send a daily reminder to the assignee (max once per day, logged with threshold `-1`).
4. Teams message = Adaptive Card: technology + version, EOL date, days left, affected customers/environments count, action status, "Open in Lifecycle" link (`APP_BASE_URL`).
5. Email = same content as HTML.

---

## 11. Coding Conventions

- Modules follow NestJS pattern: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`.
- DTOs validated with `class-validator`; global `ValidationPipe({ whitelist: true, transform: true })`.
- All routes versioned under `/api/v1`, documented with Swagger decorators.
- Services never return Prisma errors directly; a global exception filter maps them (e.g. unique violation → `409`).
- Dates stored as `DATE` for lifecycle values; timestamps in UTC; display in `TZ`.
- No secrets in code or logs. Webhook URLs are masked in API responses (`https://…/last4`).
- `helmet`, CORS restricted to `APP_BASE_URL`, rate limit on auth endpoints.
- Commit style: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- Every phase ends with: build passes, lint passes, tests pass, Swagger updated, this file updated.

---

## 12. Testing Strategy

| Level | What | Tool |
|---|---|---|
| Unit | cycle derivation, status rules, threshold selection, inbox rules, sync mapping | Jest |
| Integration | services against a real PostgreSQL (docker) | Jest + test DB |
| E2E | auth (401/403), CRUD flows, impact, export | Jest + Supertest |
| Manual | `docs/api-examples.http`, Swagger UI | REST Client |
| External mocks | endoflife.date responses saved as JSON fixtures; fake SMTP (e.g. Mailpit container) and a test Teams channel | — |

Minimum before release: all unit tests for section 10 logic, E2E for auth and each main module.

---

## 13. Delivery Phases (backend first)

Estimates assume one developer; adjust as needed.

### Phase 0 – Environment (0.5 day)
- [x] Install prerequisites (section 3) — Docker 29.7.2, Compose v5.3.1, Git 2.54. **Host Node is v10.13.0 (npm 6.4.1)**; all builds run in `node:24-alpine`, so this only limits local CLI use. Upgrade when convenient.
- [x] Create repo, `.gitignore`, `README.md`, copy this `PLAN.md`
- [x] `.env.example` + local `.env` (git-ignored)

### Phase 1 – Skeleton + Docker (1–2 days)
- [x] Backend scaffolded by hand (npm, strict TypeScript) — no global `nest` CLI needed; lockfile generated inside a Node 24 container
- [x] Config module with env validation (zod, `src/config/env.validation.ts`)
- [x] `/api/v1` prefix, Swagger at `/api/docs`, helmet, CORS, ValidationPipe
- [x] Health endpoint (Terminus + Prisma check)
- [x] `src/worker.ts` + `worker.module.ts` (starts, logs "worker ready")
- [x] Dockerfile, `.dockerignore`, `docker-compose.yml`, `docker-compose.dev.yml`
- [x] Postman collection + local environment (`docs/postman/`)
- [x] ✅ Done when: `docker compose ... up` shows db healthy, API health returns OK, worker logs ready

### Phase 2 – Database (2 days)
- [ ] Prisma init, schema from 7.1, first migration
- [ ] Status view migration (7.2)
- [ ] PrismaService / PrismaModule
- [ ] Seed script (7.4)
- [ ] ✅ Done when: migration + seed run in Docker, data visible in pgAdmin/Prisma Studio

### Phase 3 – Auth, RBAC, audit (3 days)
- [ ] Dev JWT strategy + `/auth/dev-login` (blocked in production)
- [ ] Entra JWT strategy (jwks-rsa) behind `AUTH_MODE`
- [ ] Global `JwtAuthGuard`, `@Public()`, `@Roles()`, `RolesGuard`, `@CurrentUser()`
- [ ] User upsert on request, `/auth/me`
- [ ] AuditInterceptor + `/audit-logs`
- [ ] E2E: 401 without token, 403 wrong role
- [ ] ✅ Done when: Swagger "Authorize" works with dev token and roles are enforced

### Phase 4 – Registry APIs (3 days)
- [ ] Technologies CRUD
- [ ] Versions CRUD + cycle derivation + filters + status from view
- [ ] Lime versions CRUD + components
- [ ] Unit tests for cycle util and status rules

### Phase 5 – Customers & mapping (3 days)
- [ ] Customers CRUD
- [ ] Deployments CRUD + overrides + effective components
- [ ] Teams, members, users admin endpoints
- [ ] `/versions/:id/impact` and `/customers/:id/components`
- [ ] Tests for impact logic (Lime default + override)

### Phase 6 – Upgrade actions & inbox (2–3 days)
- [ ] Upgrade actions CRUD, validation rules, overdue filter
- [ ] `/inbox` for current user
- [ ] Tests for inbox rules

### Phase 7 – EOL sync (3 days)
- [ ] endoflife.date client (timeout, retries, response validation, fixtures)
- [ ] Sync service (section 10.2), manual override protection
- [ ] Cron job in worker, `/sync/run`, `/sync/logs`, `/technologies/:id/cycles`
- [ ] ✅ Done when: real sync updates seeded versions and logs results

### Phase 8 – Dashboard, timeline, search (2–3 days)
- [ ] `/dashboard/summary` with filters
- [ ] `/dashboard/timeline`
- [ ] `/search`

### Phase 9 – Notifications (3–4 days)
- [ ] Email sender (Nodemailer) + HTML template
- [ ] Teams sender (Workflows webhook, Adaptive Card)
- [ ] Notification service (section 10.5) + cron + de-duplication
- [ ] Settings endpoints for rules, `/notifications/test`, `/notifications/logs`
- [ ] Add Mailpit container for local email testing
- [ ] Tests for threshold selection and de-duplication

### Phase 10 – Reports & export (2 days)
- [ ] Registry, impact, actions, customer reports (xlsx + csv)

### Phase 11 – Hardening (2–3 days)
- [ ] Global exception filter, rate limiting, webhook masking
- [ ] Structured logging (Pino), request IDs
- [ ] Complete Swagger descriptions and examples
- [ ] `docs/api-examples.http`
- [ ] Test coverage for section 10 logic
- [ ] ✅ **Backend milestone complete**

### Phase 12 – Frontend (later, 3–4 weeks)
- [ ] Angular + Tailwind + spartan/ui, MSAL auth
- [ ] Home: search + 12-month timeline + "Needs you" inbox
- [ ] Technology story panel, registry list, customers, actions, admin settings
- [ ] `web` container (Nginx serving Angular, proxy `/api` → api)

### Phase 13 – Deployment (later, 1 week)
- [ ] EC2 instance, Docker, Nginx TLS
- [ ] Entra ID production registration
- [ ] Nightly `pg_dump` → S3 with retention
- [ ] Monitoring: health check alert, sync failure alert
- [ ] User guide + handover notes

---

## 14. Risks & Decisions Log

| Date | Item | Decision / mitigation |
|---|---|---|
| 2026-09-17 | endoflife.date API is Beta | Adapter + validation + cache + manual override |
| 2026-09-17 | O365 Teams connectors retired | Use Workflows webhooks only |
| 2026-09-17 | Few users, solo developer | 3 containers max, one NestJS codebase with two entry points |
| 2026-09-17 | Entra ID may not be ready at start | `AUTH_MODE=dev` for local development |
| 2026-09-17 | Database choice | PostgreSQL + Prisma (relational data, joins, constraints) |
| 2026-09-17 | endoflife.date client needs tuning knobs | Added `EOL_HTTP_TIMEOUT_MS`, `EOL_RETRY_ATTEMPTS`, `EOL_RETRY_BASE_DELAY_MS`, `EOL_REQUEST_DELAY_MS`, `EOL_USER_AGENT`, `SYNC_ON_STARTUP` to `.env` — the values section 10.2 requires, configurable instead of hard-coded |
| 2026-09-17 | Worker process exited immediately (no HTTP server, no jobs yet) | `JobsModule` with a `WorkerHeartbeatService` 15-minute interval keeps the event loop alive and logs liveness; Phase 7 cron jobs join the same module |
| 2026-09-17 | ~20 feature folders flat under `src/` hid the infrastructure | Feature modules moved under `src/modules/`; `config/`, `common/`, `prisma/`, `bootstrap/`, `lifecycle/` and `jobs/` stay at `src/` root. Section 4 updated |
| 2026-09-17 | Lifecycle rules are needed by five modules | `src/lifecycle/` holds them as pure functions with no HTTP or DB dependency, so they are unit-testable and never duplicated |
| 2026-09-17 | External systems must be swappable and fakeable in tests | `eol-sync/` and `notifications/` define `ports/` interfaces with DI tokens; implementations live in `adapters/` and `senders/`. Adding a source or channel means adding a file, not editing a service |
| 2026-09-17 | Stringly-typed `config.get('API_PORT')` scattered through the code | Typed namespaces in `config/namespaces/` (app, auth, eol, notification) built from the validated env |
| | | |

---

## 15. Progress Tracker

| Phase | Status | Started | Finished | Notes |
|---|---|---|---|---|
| 0 Environment | ✅ Done | 2026-09-17 | 2026-09-17 | Host Node is v10; builds happen in Docker |
| 1 Skeleton + Docker | ✅ Done | 2026-09-17 | 2026-09-17 | API, worker and db run; health OK; Swagger live; Postman collection added |
| 2 Database | ⬜ | | | |
| 3 Auth, RBAC, audit | ⬜ | | | |
| 4 Registry APIs | ⬜ | | | |
| 5 Customers & mapping | ⬜ | | | |
| 6 Upgrade actions & inbox | ⬜ | | | |
| 7 EOL sync | ⬜ | | | |
| 8 Dashboard, timeline, search | ⬜ | | | |
| 9 Notifications | ⬜ | | | |
| 10 Reports & export | ⬜ | | | |
| 11 Hardening | ⬜ | | | |
| 12 Frontend | ⬜ | | | |
| 13 Deployment | ⬜ | | | |

Legend: ⬜ Not started · 🟨 In progress · ✅ Done · ⛔ Blocked

**Next step:** Phase 2 – Database (schema from 7.1, status view 7.2, seed 7.4).

---

## 16. Work Log

Add a short entry every session (newest on top).

### 2026-09-17
- **Done:** Phase 0 and Phase 1. Git repo, `.gitignore`, `README.md`, `.env.example` + `.env`.
  NestJS 11 backend scaffolded by hand (strict TS) with config validation (zod), `/api/v1` prefix,
  Swagger at `/api/docs`, helmet, CORS, global ValidationPipe, Prisma service/module, Terminus health
  check with a Prisma indicator, and the worker entry point. Dockerfile (dev/build/prod targets),
  `docker-compose.yml` and `docker-compose.dev.yml`. Postman collection + local environment in
  `docs/postman/`. Verified running: `/api/v1/health` → 200 `{"status":"ok","database":"up"}`,
  `/api/docs` → 200, worker logs "worker ready".
- **Problems:**
  - Host Node is **v10.13.0** — too old for the toolchain. Worked around by generating the npm
    lockfile inside a `node:24-alpine` container; nothing on the host needs Node. Worth upgrading
    for local CLI work and for IDE type resolution (`backend/node_modules` is not installed on the host).
  - The worker exited with code 0 immediately and restart-looped: signal listeners are unref'd in
    Node, so nothing held the event loop open. Fixed with `JobsModule` +
    `WorkerHeartbeatService` (a 15-minute `@Interval`), which also gives the worker a liveness log
    until the Phase 7 cron jobs exist.
  - `.env.example` is committed — keep real secrets in `.env` only.
- **Also done:** Full folder structure created (section 4 rewritten to match). Feature modules moved
  under `src/modules/` with `health/` relocated; `common/`, `lifecycle/`, `config/namespaces/`,
  `bootstrap/` split into security/validation/swagger/shutdown; `ports/`+`adapters/` folders for
  `eol-sync/` and `notifications/`; `prisma/seed/`, `test/e2e/`, `docs/diagrams/`. Empty folders hold
  a `.gitkeep` until their phase fills them. Added `backend/src/modules/README.md` (responsibility
  table + module anatomy), `docs/findings.md`, `docs/api-examples.http`, `test/jest-e2e.json`.
  Rebuilt and re-verified: health 200, worker ready.
- **Next:** Phase 2 – Prisma schema from section 7.1, first migration, status view (7.2), seed (7.4).

```
### YYYY-MM-DD
- Done:
- Problems:
- Next:
```

---

## 17. Instructions for an AI Coding Assistant (if used)

When continuing this project:
1. Read this file fully, then check section 15 for the current phase and section 16 for the latest notes.
2. Work only on the current phase's unchecked items unless told otherwise.
3. Follow the architecture decisions (section 2), schema (section 7), API list (section 9), business rules (section 10) and conventions (section 11). Do not add new services, databases or frameworks without recording the decision in section 14.
4. After finishing work: make sure everything builds and runs in Docker, tick the checkboxes, update section 15, and add a Work Log entry.
