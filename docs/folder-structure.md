# Folder Structure

What every folder in this repository is for, what belongs in it, and what does
not. Read this before adding a file, so new code lands where the next person
will look for it.

- **Status:** current as of 2026-09-17 (Phases 0 and 1 complete, EOL data source
  connected)
- **Update when:** a folder is added, removed, or changes purpose
- **Related:** [api-reference.md](api-reference.md) · [../PLAN.md](../PLAN.md) section 4

---

## 1. Top level

| Path | Contains | Notes |
|---|---|---|
| `PLAN.md` | The specification, delivery phases, progress tracker and work log | The single source of truth for *what* is being built and *where we are*. Update sections 15 and 16 at the end of every session |
| `README.md` | How to start the stack and the everyday commands | First file a newcomer reads |
| `.env.example` | Template of every environment variable, with comments | Committed. Placeholders only — real secrets belong in `.env` |
| `.env` | The working configuration | **Git-ignored.** Never commit |
| `.gitignore` | Excluded paths | Also keeps `node_modules` and `dist` out of the repository |
| `docker-compose.yml` | db + api + worker services, and a `pgadmin` profile | The prod-like stack |
| `docker-compose.dev.yml` | Hot-reload overrides | Layered on top of the file above, never used alone |
| `docs/` | All documentation | See section 2 |
| `backend/` | The NestJS application (API + worker) | See sections 3–6 |
| `frontend/` | The Angular app | Empty until Phase 12 |

## 2. `docs/`

| Path | Contains |
|---|---|
| `docs/README.md` | Index of the documentation and the rules for keeping it current |
| `docs/folder-structure.md` | This file |
| `docs/api-reference.md` | Every endpoint, its parameters, responses and errors |
| `docs/findings.md` | Notes on external systems and surprises met while building, newest first |
| `docs/api-examples.http` | Ready-made requests for the VS Code REST Client extension |
| `docs/postman/` | Postman collection, local environment, and how to run the whole collection headlessly |
| `docs/diagrams/` | Architecture images (C4 or similar). Empty so far |

## 3. `backend/` — top level

| Path | Contains | Notes |
|---|---|---|
| `Dockerfile` | Four build stages: `base`, `dev`, `build`, `prod` | `dev` carries the test tooling; `prod` installs production dependencies only and runs as the non-root `node` user |
| `.dockerignore` | Paths kept out of the build context | `node_modules`, `dist`, `.env`, coverage |
| `package.json` | Dependencies and scripts | `prisma` (the CLI) is a **production** dependency so `prisma migrate deploy` works in the prod image |
| `package-lock.json` | Locked dependency tree | Generated inside a `node:24-alpine` container, because the host has Node 10 |
| `nest-cli.json` | Nest build configuration | Enables the Swagger plugin, so DTO properties document themselves |
| `tsconfig.json` | TypeScript settings for the editor and tests | `strict: true` |
| `tsconfig.build.json` | Settings for the production build | Excludes `test/` and `prisma/`; without this the output becomes `dist/src/main.js` and the Docker `CMD` breaks |
| `prisma/` | Database schema, migrations and seed data | Section 4 |
| `src/` | Application code | Sections 5–6 |
| `test/` | End-to-end tests and their helpers | `jest-e2e.json` is the config used by `npm run test:e2e`. Unit tests live beside the code they test, not here |

## 4. `backend/prisma/`

| Path | Contains |
|---|---|
| `schema.prisma` | Models, enums and relations — the database definition |
| `migrations/` | Generated SQL migrations. Never edit an applied migration; add a new one |
| `seed/` | `seed.ts` orchestrates; one file per data set (technologies, notification rules, sample customers) so the seed stays readable |

## 5. `backend/src/` — infrastructure and shared code

These sit at the root of `src/` because they are used by every feature.

| Path | Contains | Rule |
|---|---|---|
| `main.ts` | API entry point | Composition only: prefix, security, validation, Swagger, listen. No business logic |
| `worker.ts` | Worker entry point | Same image, no HTTP server. Waits for a shutdown signal and closes cleanly |
| `app.module.ts` | Modules loaded by the API | Feature modules are registered here as each phase lands |
| `worker.module.ts` | Modules loaded by the worker | Imports `JobsModule`; the API must never import it |
| `bootstrap/` | Application wiring: `swagger.setup.ts`, `security.setup.ts` (helmet + CORS), `validation.setup.ts`, `shutdown.ts` | Keeps `main.ts` short. One concern per file |
| `config/` | `env.validation.ts` (zod schema, the single source of truth for environment variables) and `namespaces/` (typed accessors: `app`, `auth`, `eol`, `notification`) | Nothing reads `process.env` directly; everything goes through the validated schema |
| `prisma/` | `PrismaService` (owns the connection lifecycle) and the global `PrismaModule` | Services inject `PrismaService`; nobody constructs a `PrismaClient` |
| `common/` | Cross-cutting mechanics: `decorators/`, `guards/`, `interceptors/`, `filters/`, `pipes/`, `dto/` (pagination), `types/`, `utils/` | Mechanics only. **No business rules** — those belong to a module or to `lifecycle/` |
| `lifecycle/` | Pure domain rules: cycle derivation, support status, display status, notification thresholds | No HTTP, no database, no I/O. Used by five different modules, so it lives in one place and is unit-tested directly |
| `modules/` | One folder per bounded concern | Section 6 |
| `jobs/` | Scheduled work: the worker heartbeat, and from Phase 7 the EOL sync and notification crons | Loaded by `worker.module.ts` only, so the API never runs a job |

## 6. `backend/src/modules/`

Each folder maps to a section of the requirements. The responsibility table and
the standard file anatomy live in
[`backend/src/modules/README.md`](../backend/src/modules/README.md), next to the
code.

**Built so far**

| Folder | Status | What it does |
|---|---|---|
| `health/` | Done | `GET /health` — application and database liveness |
| `eol-sync/` | Partly done | Talks to endoflife.date. Lookup endpoints work; writing to the database arrives with Phase 7 |

**Scaffolded, filled in later**

`auth/` · `users/` · `teams/` · `technologies/` · `versions/` · `lime-versions/` ·
`customers/` · `deployments/` · `upgrade-actions/` · `inbox/` · `dashboard/` ·
`search/` · `reports/` · `settings/` · `audit/` · `notifications/`

Empty folders hold a `.gitkeep` file, because git does not track a directory on
its own. Deleting that file is the first step of filling the folder.

### Inside a module

```
<feature>/
├── <feature>.module.ts        wiring: what this module provides and exports
├── <feature>.controller.ts    HTTP surface and Swagger decorators only
├── <feature>.service.ts       business rules; throws domain exceptions
├── <feature>.repository.ts    only where raw SQL or multi-table queries live
├── dto/                       request DTOs (validated) and response DTOs
├── mappers/                   database model -> response DTO
└── <feature>.service.spec.ts  unit tests, beside the code they test
```

Four rules keep modules consistent:

1. A controller contains no business logic; a service contains no HTTP concepts.
2. Plain CRUD talks to `PrismaService` directly. A pass-through repository adds
   nothing — add one only when queries get complex (`versions`, `dashboard`,
   `inbox`, `search`).
3. Anything crossing a process boundary (HTTP, SMTP, webhook) sits behind an
   interface in `ports/`, with the implementation in `adapters/` or `senders/`.
   That is what makes it swappable and fakeable in tests.
4. Lifecycle rules live in `src/lifecycle/` and are never copied into a module.

### `eol-sync/` in detail

The one module that is built, and the pattern the others follow.

| Path | Contains |
|---|---|
| `ports/eol-data-source.port.ts` | The `EolDataSource` interface, the `EOL_DATA_SOURCE` injection token, and the domain types. **This is what the rest of the application depends on** |
| `adapters/endoflife-date.client.ts` | The endoflife.date implementation: URLs, timeout, retries, caching |
| `adapters/endoflife-date.schema.ts` | zod schemas validating every upstream response |
| `mappers/release-to-version.mapper.ts` | Turns a release into the fields a `TechnologyVersion` stores |
| `dto/` | Request and response shapes for our own endpoints |
| `eol-lookup.service.ts` | Read-only lookups; no database dependency |
| `eol-sync.controller.ts` | The `/eol/*` endpoints |
| `__fixtures__/` | Real API responses saved to disk, so tests never call the network |

Only `eol-sync.module.ts` knows that `EOL_DATA_SOURCE` is endoflife.date.
Changing provider means changing that one binding.

## 7. Where do I put…?

| I am adding… | It goes in |
|---|---|
| A new endpoint for an existing feature | That module's controller, with the logic in its service |
| A whole new feature | A new folder in `src/modules/`, registered in `app.module.ts` |
| A rule about EOL dates or status | `src/lifecycle/`, with unit tests |
| A guard, filter or decorator used by several modules | `src/common/` |
| A call to an outside system | A `ports/` interface plus an `adapters/` implementation, inside the module that owns it |
| A scheduled job | `src/jobs/`, registered in `JobsModule` |
| An environment variable | `config/env.validation.ts`, the matching `config/namespaces/` file, **and** `.env.example` |
| A unit test | Beside the file it tests, as `*.spec.ts` |
| An end-to-end test | `backend/test/e2e/`, as `*.e2e-spec.ts` |
| A note about an external system | `docs/findings.md` |
| An architectural decision | `PLAN.md` section 14, and this file if a folder changed |
