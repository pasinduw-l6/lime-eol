# Feature modules

One folder per bounded concern. Each maps to a section of the requirements.

| Folder | Requirement | Responsibility |
|---|---|---|
| `health/` | — | Liveness of app and database |
| `auth/` | §3 access control | Dev and Entra JWT strategies, user provisioning, `/auth/me` |
| `users/` | §3 | Admin user list, role changes |
| `teams/` | §2.4 | Teams, members, Teams webhook URL |
| `technologies/` | §2.1 | Technology master registry |
| `versions/` | §2.1, §2.2 | Versions, lifecycle status, impact analysis |
| `lime-versions/` | §2.1 | Lime releases and their component sets |
| `customers/` | §2.4 | Customers and their effective components |
| `deployments/` | §2.4 | Environment/location mapping and component overrides |
| `upgrade-actions/` | §2.5 | Upgrade tracking: owner, dates, status, Jira, customer comms |
| `inbox/` | §2.5 | "Needs you" items for the signed-in user |
| `dashboard/` | §2.6 | Summary counts and the EOL timeline |
| `search/` | §2.6 | Cross-entity search |
| `reports/` | §3 | Excel/CSV exports |
| `settings/` | §2.3 | Notification thresholds |
| `audit/` | §3 | Audit trail of changes |
| `eol-sync/` | §2.2 | endoflife.date adapter and sync orchestration |
| `notifications/` | §2.3 | Email and Teams delivery, de-duplication |

## Anatomy of a module

```
<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts     HTTP surface + Swagger decorators only
├── <feature>.service.ts        business rules; throws domain exceptions
├── <feature>.repository.ts     only where raw SQL / multi-table queries live
├── dto/                        request DTOs (class-validator) + response DTOs
├── mappers/                    Prisma model -> response DTO
└── <feature>.service.spec.ts
```

Rules:

- Controllers contain no business logic; services contain no HTTP concepts.
- A plain CRUD module talks to `PrismaService` directly — a pass-through
  repository adds nothing. Add a repository when queries get complex
  (`versions`, `dashboard`, `inbox`, `search`).
- Anything crossing a process boundary (HTTP, SMTP, webhook) sits behind a
  `ports/` interface with its implementation in `adapters/` or `senders/`, so
  it can be swapped and faked in tests.
- Shared lifecycle rules live in `src/lifecycle/`, never copied into a module.
