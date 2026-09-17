# Database Design — Research Notes

Things to settle **before** writing `schema.prisma`, with the trade-offs and a
recommendation for each. Written 2026-09-17, before Phase 2.

The schema in PLAN.md section 7.1 is a good starting point. This document
records where it should change and why, so the decisions are deliberate rather
than discovered during Phase 8.

---

## 0. First, the scale reality check

Estimated size of this system at full adoption:

| Table | Rows |
|---|---|
| technology | ~30 |
| cycles (per technology, ~10) | ~300 |
| versions in use | ~400 |
| customers | ~30 |
| deployments | ~100 |
| upgrade actions | ~500 per year |
| notification log | ~10 000 per year |
| audit log | ~50 000 per year |

**Nothing here is a performance problem for PostgreSQL.** A sequential scan of
every table in this database costs less than a millisecond. That has one
important consequence:

> Optimise for correctness and for the ability to change, not for speed.

So: no partitioning, no materialised views, no denormalisation "for
performance", no caching layer. Add indexes on foreign keys and on `eol_date`,
and stop. Every recommendation below trades a little speed for a lot of
correctness, and that is the right trade at this size.

---

## 1. EOL dates belong to the cycle, not to the version ⚠️ most important

**The problem with the current design.** `TechnologyVersion` holds
`fullVersion` ("6.0.14"), `cycle` ("6.0") *and* the lifecycle dates
(`eolDate`, `releaseDate`, `activeSupportEnd`, `isLts`, `latestSupported`).

But endoflife.date publishes lifecycle data **per cycle**. MongoDB 6.0.14 and
6.0.29 are both cycle 6.0, and share exactly one EOL date: 2025-07-31.

If customer A runs 6.0.14 and customer B runs 6.0.29, the registry stores that
same date twice. That is an update anomaly, and it bites in three ways:

1. The nightly sync has to update N rows for one upstream fact; a partial
   failure leaves them disagreeing.
2. If someone sets one row to `eolSource = MANUAL`, the two rows now hold
   different EOL dates **for the same cycle**, and the dashboard contradicts
   itself with no way to tell which is right.
3. "How many cycles are we behind on?" cannot be answered without a
   `DISTINCT` over a field that should have been a table.

**Recommendation — split the entity:**

```
Technology            mongodb          identity, slug, cycleRule, eolField
  └── TechnologyCycle   6.0            ALL lifecycle data, synced from the API
        └── TechnologyVersion 6.0.14   what we actually run; an identifier
```

- `TechnologyCycle` owns `releaseDate`, `eolDate`, `activeSupportEnd`, `isLts`,
  `latestPatch`, `eolSource`, `lastSyncedAt`. One row per cycle, one upstream
  fact, one place to override manually.
- `TechnologyVersion` owns `fullVersion` and a foreign key to its cycle.
- Deployments and Lime versions may reference **either**, depending on how
  precisely they are tracked — most will reference a version.

**Cost:** one extra join in most queries, and a cycle row must exist before a
version can be added (the cycle is already derived automatically from the
version string, so this is invisible in the UI).

**Benefit:** the sync writes ~300 rows instead of ~400 with duplicates, manual
overrides are unambiguous, and a cycle with no version we run yet can still be
tracked — which is how "we should plan to move to 8.0" gets represented.

This is the one change I would insist on.

---

## 2. Resolving a deployment's effective components

PLAN section 7.3 says a deployment uses the components of its Lime version
*plus* its own overrides, and that "the service layer must exclude the Lime
default for that technology" when an override replaces it.

**The risk:** that rule is needed by the impact query, the customer components
endpoint, the dashboard, the inbox and the notification job. Implemented five
times, it will diverge, and a lifecycle tool that reports the wrong customers is
worse than no tool.

**Recommendation:** implement it **once**, as a database view, and have every
consumer read the view:

```sql
CREATE VIEW v_deployment_effective_component AS
SELECT DISTINCT ON (d.id, t.id)
       d.id AS deployment_id,
       t.id AS technology_id,
       c.id AS technology_cycle_id,
       src.source
FROM deployment d
JOIN ( ... overrides UNION ALL lime version defaults ... ) src ON ...
ORDER BY d.id, t.id, CASE src.source WHEN 'OVERRIDE' THEN 0 ELSE 1 END;
```

PostgreSQL's `DISTINCT ON` expresses "override wins per technology" directly.
The rule then exists in one place, is testable with SQL fixtures, and cannot
drift between modules.

---

## 3. Where the "EOL approaching" threshold lives

PLAN section 7.2 hardcodes 180 days in `v_version_status`, while
`STATUS_APPROACHING_DAYS` also sets it in `.env`. **Two sources of truth for one
policy** — change the variable and the view silently disagrees.

Confirmed working in PG 16: `CURRENT_DATE + 180` and `eol_date - CURRENT_DATE`
both evaluate as expected, so either approach is technically fine.

**Recommendation:** the view exposes only objective facts —

```sql
days_to_eol  = eol_date - CURRENT_DATE
is_eol       = eol_date <= CURRENT_DATE
```

— and the *band* ("approaching") is applied by one function in `src/lifecycle/`,
reading the configured threshold. Where SQL needs to filter by status, pass the
threshold as a query parameter.

Rationale: 180 days is policy, not data. Policy belongs with the other rules in
`lifecycle/`, where it is unit-tested, not frozen into a migration.

---

## 4. Primary keys

Verified: Prisma 6.19.3 accepts `@default(uuid(7))`; PostgreSQL 16 has **no**
native `uuidv7()` (that arrived in PG 18), but Prisma generates the value
client-side, so it works today. `gen_random_uuid()` is available for
database-side defaults.

| Option | Verdict |
|---|---|
| `uuid(4)` (current plan) | Random ordering fragments B-tree indexes on insert. Harmless at our size, but there is no reason to choose it |
| **`uuid(7)`** | **Recommended.** Same shape and safety, time-ordered so inserts stay local in the index, and sortable by creation time |
| `bigint` autoincrement | Smaller and faster, but exposes row counts in URLs and makes merging data between environments painful |

**Gotcha to plan for:** `AuditLog.id` is `BigInt`, and `JSON.stringify` throws
on a BigInt in Node. Either make it a UUID like everything else, or register a
`BigInt.prototype.toJSON` shim once during bootstrap. Discovering this from a
500 on `/audit-logs` is a waste of an afternoon.

---

## 5. Timestamps and dates

- Lifecycle dates (`eol_date`, `release_date`, `planned_date`) are calendar
  dates with no time: keep `@db.Date`. Correct in the current plan.
- **Gotcha:** Prisma's `DateTime` maps to `timestamp(3)` **without** time zone
  on PostgreSQL. With containers running `TZ=Asia/Colombo`, that is a source of
  quiet off-by-hours bugs. Use `@db.Timestamptz(3)` explicitly on every
  `created_at`, `updated_at`, `sent_at` and `last_synced_at`.
- Date-only values parsed from the API are anchored at UTC midnight (already
  done in `release-to-version.mapper.ts`).

---

## 6. Enums: PostgreSQL type or lookup table?

A PostgreSQL enum is type-safe and fast, but adding a value needs a migration
(`ALTER TYPE ... ADD VALUE`, which cannot run inside a transaction block) and
removing one is genuinely awkward.

| Enum | Likely to change? | Recommendation |
|---|---|---|
| `Role`, `ActionStatus`, `CommStatus`, `EolSource`, `Channel` | No — closed sets from the spec | PostgreSQL enum |
| `Environment` (DEV/UAT/PROD) | Possibly (STAGING, DR) | PostgreSQL enum; adding a value is a one-line migration |
| `ComponentType` | Likely, as new kinds of component appear | PostgreSQL enum, accepting occasional migrations |
| `DeploymentLocation` (EC2/CUSTOMER_SITE) | **Yes** — real deployments live in named places | Enum for the *kind*, plus a free-text `locationDetail` for the specific site. Otherwise every new hosting arrangement is a schema change |

---

## 7. Responsibility: one owner or many? — requirement gap

The requirements say the tool must map a technology to a "Responsible
team/person **(One or many)**". The schema in PLAN 7.1 gives `Deployment` a
single `teamId` and `UpgradeAction` a single `assigneeId`.

With a single foreign key, a deployment owned by both DevOps and the DBA team
forces a wrong choice — and since notification recipients are derived from
deployment ownership, **the second team is never told about an EOL**.

**Recommendation:** a join table, `deployment_owner(deployment_id, team_id,
is_primary)`. Keep a single `assignee` on an upgrade action (one person is
accountable for a task), but let ownership of a deployment be plural. The
`is_primary` flag preserves "who to escalate to" without another table.

---

## 8. Deletes: cascade, restrict, or archive?

The current plan cascades widely. Deleting a technology removes its versions,
which removes their upgrade actions, which removes the record that the upgrade
ever happened. For a system whose purpose is an audit trail of lifecycle
management, that is the wrong default.

**Recommendation:**

| Relationship | Behaviour |
|---|---|
| Join tables (`lime_version_component`, `deployment_component`, `team_member`) | `CASCADE` — these are pure links |
| Technology → cycles → versions | `RESTRICT` once anything references them |
| Technology, Customer, Deployment | **Soft delete** (`archived_at`), never physically removed |
| Logs (`audit_log`, `notification_log`, `eol_sync_log`) | Never cascade; keep with `SET NULL` |

Soft deletes complicate uniqueness — `name` must be unique only among live rows.
PostgreSQL handles this with a partial unique index:
`CREATE UNIQUE INDEX ... ON technology (name) WHERE archived_at IS NULL`.

---

## 9. Keep the history of EOL date changes

Vendors move EOL dates — extended support gets announced, or a date is pulled
forward. Today only the raw API response is kept, inside `eol_sync_log`.

The question "this was fine last month, why is it urgent now?" is exactly what
this tool exists to answer.

**Recommendation:** a small `technology_cycle_history` table written by the sync
whenever a value actually changes: `(cycle_id, field, old_value, new_value,
changed_at, source)`. Cheap to write, and it enables an "EOL date moved" alert,
which is more useful than the scheduled reminders.

---

## 10. Notification de-duplication key

The planned unique key is `(techVersionId, thresholdDays, recipient, channel)`.

If an EOL date moves, that key still matches, so the system stays silent about
a deadline that has genuinely changed. And a notification sent two years ago
permanently blocks the same threshold being announced again.

**Recommendation:** include the EOL date the notification was about:
`(cycle_id, eol_date, threshold_days, recipient, channel)`. A changed date
re-arms the alerts, which is the behaviour you want.

---

## 11. Version ordering

`'6.0.9' > '6.0.14'` as text. Sorting versions, and answering "are we behind the
latest supported release?", both need numeric comparison.

**Recommendation:** store `major`, `minor`, `patch` as integers alongside
`fullVersion`, populated by the same parser that derives the cycle. Index
`(technology_id, major, minor, patch)`. Simpler and more portable than a
`semver` extension or zero-padded sort keys.

---

## 12. Tooling notes found while researching

- `package.json#prisma` (where the seed command lives) is **deprecated and
  removed in Prisma 7**. Migrate to `prisma.config.ts` now rather than during an
  upgrade.
- Typed `view` blocks work in Prisma 6.19 behind `previewFeatures = ["views"]`,
  using `@unique` rather than `@id`. This gives type-safe reads of
  `v_version_status` instead of untyped `$queryRaw`.
- Views themselves must still be created by hand-written SQL inside a migration
  (`prisma migrate dev --create-only`); Prisma will not generate them.

---

## Summary of recommendations

| # | Decision | Recommendation | Impact if skipped |
|---|---|---|---|
| 1 | Cycle vs version | **Split `TechnologyCycle` out** | Contradictory EOL dates for one cycle |
| 2 | Effective components | One SQL view with `DISTINCT ON` | Five implementations that drift; wrong impact reports |
| 3 | Approaching threshold | Facts in the view, policy in `lifecycle/` | Env variable and view disagree |
| 4 | Primary keys | `uuid(7)`; avoid BigInt for audit id | Index fragmentation; a JSON serialisation crash |
| 5 | Timestamps | Explicit `@db.Timestamptz(3)` | Off-by-hours bugs under `TZ=Asia/Colombo` |
| 6 | Enums | Enum + free-text detail for location | A migration for every new hosting site |
| 7 | Ownership | Join table for deployment owners | Second owning team never notified |
| 8 | Deletes | Soft delete + restrict | Upgrade history destroyed by one delete |
| 9 | Date-change history | `technology_cycle_history` | Cannot explain why something became urgent |
| 10 | Notification key | Include the EOL date | Silence after a date moves |
| 11 | Version ordering | Numeric `major`/`minor`/`patch` | Wrong sort order; no "are we behind?" |
| 12 | Tooling | `prisma.config.ts`, typed views | Breaks on the Prisma 7 upgrade |

Items 1, 7 and 8 change the shape of the schema and should be settled before any
migration is written. The rest can be applied as the schema is built.

---

## Outcome — all twelve accepted, 2026-09-17

Built in migration `20260917070747_init`: 19 tables, 2 views, 1 check
constraint. Two notes on how the recommendations were actually implemented:

**Soft delete and unique names.** Item 8 proposed partial unique indexes so a
name is unique only among live rows. That was *not* done, because Prisma
generates migrations by diffing `schema.prisma` against a shadow database, so an
index added by hand-written SQL gets dropped by the next generated migration.
Plain `@unique` is used instead: an archived name stays reserved, and reusing it
means un-archiving the row rather than creating a duplicate — which is the
better workflow anyway, since two technologies called "MongoDB" is precisely
what should not happen.

**Views are created by hand-written SQL** inside the migration, and read through
typed `$queryRaw` in a repository rather than the `views` preview feature. Same
single-implementation guarantee, no dependency on a preview feature, and the
views stay queryable from psql and pgAdmin for ad-hoc reporting. Review the SQL
that `prisma migrate dev` generates before applying it, in case it proposes
dropping them.

**One rule the database enforces rather than the service layer:**
`upgrade_action_completed_date_check` makes a completed action require a
completion date, and a non-completed action forbid one. No code path can write a
half-finished record.
