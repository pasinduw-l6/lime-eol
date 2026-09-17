# Lime Technology Lifecycle & EOL Registry

Single source of truth for the lifecycle of the open-source and third-party
technologies used in the Lime Platform: what we run, which versions, where they
are deployed, when they go end-of-life, and who is upgrading them.

Full specification and phase plan: [PLAN.md](PLAN.md).

## Stack

| Layer | Choice |
|---|---|
| API | NestJS 11 (TypeScript, strict) on Node.js 24 |
| Worker | Same image, `dist/worker.js` entry point, cron jobs |
| Database | PostgreSQL 16 + Prisma |
| Auth | Entra ID (OIDC/JWT); `AUTH_MODE=dev` for local development |
| EOL data | endoflife.date API v1 |
| Runtime | Docker Desktop + Docker Compose |

## Getting started

Requires Docker Desktop (WSL 2 backend on Windows). Host Node.js is only needed
for CLI tooling — everything runs in containers.

```bash
cp .env.example .env     # then adjust secrets
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

| URL | What |
|---|---|
| http://localhost:3000/api/v1 | API base |
| http://localhost:3000/api/v1/health | Health check (public) |
| http://localhost:3000/api/docs | Swagger UI |
| http://localhost:5050 | pgAdmin (`--profile tools`) |

## Everyday commands

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
| Run tests | `docker compose exec api npm test` |

## Testing the API

Postman collection and environment: [docs/postman/](docs/postman/) — import both,
select the **Lime EOL – Local** environment, and run *System → Health*.
See [docs/postman/README.md](docs/postman/README.md).

## Repository layout

```
.
├── PLAN.md                  ← specification, phases, progress tracker
├── docker-compose.yml       ← db + api + worker (+ pgadmin profile)
├── docker-compose.dev.yml   ← hot-reload overrides
├── docs/postman/            ← API collection for manual testing
└── backend/
    ├── prisma/              ← schema, migrations, seed
    └── src/
        ├── config/          ← env validation (zod)
        ├── prisma/          ← PrismaService / PrismaModule
        ├── health/          ← /health
        ├── main.ts          ← API entry point
        └── worker.ts        ← worker entry point
```

## Conventions

- Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- Every phase ends with: build passes, lint passes, tests pass, Swagger updated,
  `PLAN.md` sections 15 and 16 updated.
- Never commit `.env`. No secrets in code or logs.
