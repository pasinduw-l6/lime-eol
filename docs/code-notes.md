# Code notes

Every comment that was in the source, extracted 28 September 2026.

These record *why* the code is the way it is — the reasoning behind choices
that are not obvious from reading it. Kept here so the source stays bare.

Directive comments (`eslint-disable`, `ts-expect-error` and the like) stayed
in the source, because removing those changes what the tooling does.

**947 comments** from **113 files**.

---

## backend/prisma/schema.prisma

`line 1`

```text
// Lime Technology Lifecycle & EOL Registry — database schema
```

`line 2`

```text
//
```

`line 3`

```text
// Design decisions behind this file are recorded in docs/db-design-notes.md
```

`line 4`

```text
// and PLAN.md section 14. The four that shape it most:
```

`line 5`

```text
//
```

`line 6`

```text
//   1. Lifecycle data lives on TechnologyCycle, not on each version, because
```

`line 7`

```text
//      endoflife.date publishes it per cycle. One upstream fact, one row.
```

`line 8`

```text
//   2. Deployments are owned by one *or many* teams (DeploymentOwner), so every
```

`line 9`

```text
//      responsible team is notified before an EOL.
```

`line 10`

```text
//   3. Reference data is archived (archivedAt), never deleted, so the record of
```

`line 11`

```text
//      upgrades survives. Only join tables cascade.
```

`line 12`

```text
//   4. uuid(7) keys (time-ordered), @db.Date for calendar dates and
```

`line 13`

```text
//      @db.Timestamptz(3) for instants.
```

`line 24`

```text
// ---------------------------------------------------------------------------
```

`line 25`

```text
// Enums
```

`line 26`

```text
// ---------------------------------------------------------------------------
```

`line 40`

```text
/// How a version string is reduced to its support cycle.
```

`line 41`

```text
/// MAJOR: 20.11.1 -> 20   ·   MAJOR_MINOR: 6.0.14 -> 6.0
```

`line 47`

```text
/// Which support phase this technology treats as end of life.
```

`line 78`

```text
/// Where a to-do item stands. Blocked is deliberately separate from not
```

`line 79`

```text
/// started: work nobody can proceed with is a different problem from work
```

`line 80`

```text
/// nobody has picked up, and only one of them needs chasing.
```

`line 113`

```text
/// Why a component changed. Auditors ask this before they ask what changed:
```

`line 114`

```text
/// an emergency patch and a planned upgrade are different kinds of event.
```

`line 124`

```text
// ---------------------------------------------------------------------------
```

`line 125`

```text
// Registry
```

`line 126`

```text
// ---------------------------------------------------------------------------
```

`line 128`

```text
/// A technology used in the Lime Platform: MongoDB, Node.js, RHEL, ...
```

`line 134`

```text
  /// endoflife.date product slug. Null for technologies it does not track.
```

`line 139`

```text
  /// Simple Icons slug and brand colour, resolved once when the technology is
```

`line 140`

```text
  /// registered. Stored rather than derived per render so the logo stays put if
```

`line 141`

```text
  /// the icon set renames something, and so every screen shows the same mark.
```

`line 145`

```text
  /// Set instead of deleting. Archived rows keep their name reserved; to reuse
```

`line 146`

```text
  /// a name, un-archive the row rather than creating a duplicate.
```

`line 159`

```text
/// One support cycle of a technology — MongoDB 6.0, Node.js 24.
```

`line 160`

```text
/// All lifecycle dates live here, because the data source publishes them per
```

`line 161`

```text
/// cycle. This is the row the nightly sync writes to.
```

`line 165`

```text
  /// Cycle identifier as the source names it: "24", "6.0".
```

`line 167`

```text
  /// Display label from the source, e.g. "24 (LTS)".
```

`line 170`

```text
  /// End of life for this technology's configured eolField.
```

`line 176`

```text
  /// Newest patch release in this cycle, e.g. "6.0.29".
```

`line 179`

```text
  /// MANUAL rows are never overwritten by the sync.
```

`line 198`

```text
/// A specific build we actually run: 6.0.14. Carries no lifecycle dates —
```

`line 199`

```text
/// those belong to its cycle.
```

`line 204`

```text
  /// Parsed for correct ordering: '6.0.9' sorts before '6.0.14' numerically,
```

`line 205`

```text
  /// not as text. Populated by the same parser that derives the cycle.
```

`line 224`

```text
/// Audit of lifecycle values that changed, so "why did this become urgent?"
```

`line 225`

```text
/// has an answer. Written by the sync only when a value actually moves.
```

`line 241`

```text
// ---------------------------------------------------------------------------
```

`line 242`

```text
// Lime releases
```

`line 243`

```text
// ---------------------------------------------------------------------------
```

`line 260`

```text
/// The component set a Lime release ships with.
```

`line 273`

```text
// ---------------------------------------------------------------------------
```

`line 274`

```text
// Customers, deployments and ownership
```

`line 275`

```text
// ---------------------------------------------------------------------------
```

`line 294`

```text
/// One customer installation of the Lime platform — the unit engineers work
```

`line 295`

```text
/// in. A customer may run more than one (a second brand, a separate region),
```

`line 296`

```text
/// so this is deliberately not the same record as the customer.
```

`line 302`

```text
  /// Which Lime release this customer is on. Differs per project.
```

`line 319`

```text
/// Who is staffed on a project. Plural on purpose — notifications go to all of
```

`line 320`

```text
/// them, and is_lead marks who to escalate to.
```

`line 334`

```text
/// One environment of one customer: "Acme UAT".
```

`line 343`

```text
  /// The specific site or account, e.g. "eu-west-1" or "Acme DC, Colombo".
```

`line 344`

```text
  /// Free text so a new hosting arrangement is not a schema change.
```

`line 366`

```text
/// A deployment may be owned by several teams; every owner is notified.
```

`line 367`

```text
/// is_primary marks who to escalate to.
```

`line 381`

```text
/// A component this deployment runs *instead of* its Lime version's default.
```

`line 382`

```text
/// Resolution is defined once, in v_deployment_effective_component.
```

`line 395`

```text
/// What actually changed in an environment, and when.
```

`line 396`

```text
///
```

`line 397`

```text
/// Append-only: corrections are new rows, never edits, because history that
```

`line 398`

```text
/// can be rewritten is not history. Version strings are stored alongside the
```

`line 399`

```text
/// foreign keys so a change still reads after a version row is removed.
```

`line 406`

```text
  /// Denormalised so history survives the version being deleted.
```

`line 411`

```text
  /// Change request or ticket this was carried out under.
```

`line 413`

```text
  /// Runbook, PR or pipeline run that evidences it.
```

`line 415`

```text
  /// Position in this environment's chain, 1-based and gap-free.
```

`line 417`

```text
  /// SHA-256 over this entry and the one before it. A silently edited or
```

`line 418`

```text
  /// deleted row breaks the chain, which /history/verify reports.
```

`line 421`

```text
  /// Set when this entry exists to correct an earlier one. Entries are never
```

`line 422`

```text
  /// edited or deleted; a mistake is answered with a compensating entry.
```

`line 424`

```text
  /// When it happened in the environment — not when someone typed it in.
```

`line 425`

```text
  /// Reports use this; recordedAt only says when the paperwork caught up.
```

`line 445`

```text
// ---------------------------------------------------------------------------
```

`line 446`

```text
// Teams and users
```

`line 447`

```text
// ---------------------------------------------------------------------------
```

`line 453`

```text
  /// Power Automate Workflows webhook. Masked in API responses.
```

`line 471`

```text
  /// scrypt digest, stored as "scrypt$N$r$p$salt$hash". Null for accounts that
```

`line 472`

```text
  /// sign in through Entra, which never hold a password here.
```

`line 501`

```text
// ---------------------------------------------------------------------------
```

`line 502`

```text
// Upgrade tracking
```

`line 503`

```text
// ---------------------------------------------------------------------------
```

`line 505`

```text
/// Work to move off a cycle that is reaching end of life.
```

`line 506`

```text
/// Targets a cycle, because that is what goes EOL; affected deployments are
```

`line 507`

```text
/// listed explicitly.
```

`line 517`

```text
  /// The issue key as a person types it, e.g. OPS-1042. Kept even when the
```

`line 518`

```text
  /// mirror below is stale or Jira is unreachable.
```

`line 519`

```text
  ///
```

`line 520`

```text
  /// Written only by the issue-tracker link flow, never by the plan form. It
```

`line 521`

```text
  /// once had two writers, and editing a plan could silently point this at a
```

`line 522`

```text
  /// different issue than jiraIssueId and the mirror below — which then failed
```

`line 523`

```text
  /// as "issue does not exist" on the next call.
```

`line 525`

```text
  /// Jira's own immutable id. The key changes if an issue moves project; this
```

`line 526`

```text
  /// does not, so the link survives.
```

`line 529`

```text
  /// Mirrored from Jira, never edited here. A cache: if it disagrees with Jira,
```

`line 530`

```text
  /// Jira wins and the next sync corrects it.
```

`line 532`

```text
  /// to-do, indeterminate or done. Jira's own grouping, which survives a
```

`line 533`

```text
  /// workflow being renamed.
```

`line 539`

```text
  /// Why the last sync failed, shown in the UI. Never holds a credential.
```

`line 560`

```text
/// One item on an upgrade's to-do list.
```

`line 561`

```text
///
```

`line 562`

```text
/// Ordered and worked through in sequence. Timings are recorded rather than
```

`line 563`

```text
/// typed: startedAt and completedAt give the real duration, which is the only
```

`line 564`

```text
/// honest basis for estimating the next upgrade of the same thing.
```

`line 569`

```text
  /// Set when this environment is done. A rollout runs DEV, then UAT, then
```

`line 570`

```text
  /// PROD over weeks, and one status across all three hides which is left.
```

`line 581`

```text
// ---------------------------------------------------------------------------
```

`line 582`

```text
// Notifications
```

`line 583`

```text
// ---------------------------------------------------------------------------
```

`line 587`

```text
  /// 180, 90, 30, 0 days before EOL.
```

`line 598`

```text
/// One row per thing actually sent. The unique key includes the date the alert
```

`line 599`

```text
/// was about, so a moved EOL date re-arms the notifications instead of being
```

`line 600`

```text
/// silently suppressed.
```

`line 605`

```text
  /// The date the alert was about: the EOL date, or an action's planned date
```

`line 606`

```text
  /// for an overdue reminder (threshold -1).
```

`line 623`

```text
// ---------------------------------------------------------------------------
```

`line 624`

```text
// Operational logs
```

`line 625`

```text
// ---------------------------------------------------------------------------
```

`line 643`

```text
/// Who changed what. uuid rather than bigint: JSON.stringify throws on BigInt
```

`line 644`

```text
/// in Node, and this table is served over the API.
```

`line 650`

```text
  /// CREATE | UPDATE | DELETE | ARCHIVE | SYNC | LOGIN
```

`line 663`

```text
/// A sub-task of a linked Jira issue, mirrored so the board renders without a
```

`line 664`

```text
/// request to Jira on every page load.
```

`line 665`

```text
///
```

`line 666`

```text
/// Read-only by construction: nothing in this application writes to it except
```

`line 667`

```text
/// the sync, and the UI offers no way to edit a row. The work is managed in
```

`line 668`

```text
/// Jira; this table only remembers what Jira last said.
```

`line 672`

```text
  /// e.g. OPS-1043
```

`line 677`

```text
  /// to-do, indeterminate or done
```

`line 681`

```text
  /// Jira's order within the parent, so the mirror lists them as Jira does.
```

## backend/prisma/seed/notification-rules.seed.ts

`line 3`

```text
/** Notify 180, 90 and 30 days before end of life, and on the day itself. */
```

## backend/prisma/seed/sample-data.seed.ts

`line 3`

```text
/**
 * Siyapatha — the first real project.
 *
 * Three environments running one stack. PROD's versions are the ones recorded
 * by the team; DEV and UAT mirror them until someone records otherwise, which
 * is the honest default: assume drift has not been measured rather than
 * inventing numbers.
 */
```

`line 29`

```text
// ---- people ----
```

`line 64`

```text
// ---- customer and project ----
```

`line 94`

```text
// ---- the versions this project runs ----
```

`line 111`

```text
// ---- environments ----
```

## backend/prisma/seed/seed.ts

`line 7`

```text
/**
 * Seeds reference data and a small sample estate.
 *
 * Every step upserts, so running it twice changes nothing and it is safe
 * against a database that already holds real data.
 */
```

## backend/prisma/seed/technologies.seed.ts

`line 10`

```text
/**
 * The technologies the Lime Platform actually runs on.
 *
 * Every slug and every date below was verified against endoflife.date on
 * 2026-09-22. The nightly sync keeps API-sourced cycles current; cycles marked
 * MANUAL are ones the source no longer publishes, and the sync must never
 * overwrite them.
 */
```

`line 29`

```text
/** Builds actually deployed somewhere. */
```

`line 106`

```text
// endoflife.date no longer publishes cycles this old, so the dates are
```

`line 107`

```text
// entered by hand from the Kubernetes release history and marked
```

`line 108`

```text
// MANUAL: the sync must not clear them.
```

`line 193`

```text
// The parser that derives a cycle also fills the sort columns, so seed
```

`line 194`

```text
// data exercises the same code path as the API.
```

## backend/prisma/seed/users.only.ts

`line 4`

```text
/**
 * Issues accounts without touching anything else.
 *
 * The full seed also writes sample estate data, which must not run against a
 * database holding a real customer's environments.
 */
```

## backend/prisma/seed/users.seed.ts

`line 4`

```text
/**
 * The people who may sign in.
 *
 * Accounts are issued here rather than through self-service registration: this
 * tool records who changed a customer's production estate, and an account that
 * anyone could create for themselves would make that record worthless.
 *
 * Passwords are the agreed starting ones and are meant to be changed. They are
 * hashed on the way in, so the database never holds the plain text even though
 * the starting values are written down elsewhere.
 */
```

`line 26`

```text
/** A read-only account, for anyone who needs to look without recording. */
```

`line 37`

```text
// Upserted on email so a rerun re-issues the password without creating a
```

`line 38`

```text
// second account, and without disturbing the changes already attributed to
```

`line 39`

```text
// this person.
```

## backend/src/app.module.ts

`line 18`

```text
/**
 * API entry module. Feature modules are added here as phases land.
 * Scheduled jobs deliberately live in WorkerModule only.
 */
```

`line 37`

```text
/**
   * Authentication then authorisation, in that order: EditorGuard reads
   * request.user, which JwtAuthGuard is what puts there.
   *
   * Registered globally so the API is closed by default. Opening a route
   * takes an explicit @Public(), which is visible in review; forgetting a
   * decorator now fails safe instead of exposing an endpoint.
   */
```

## backend/src/bootstrap/security.setup.ts

`line 5`

```text
/**
 * HTTP hardening: secure headers and a CORS policy limited to the web app.
 * Rate limiting on auth endpoints joins this in Phase 11.
 */
```

## backend/src/bootstrap/shutdown.ts

`line 3`

```text
/**
 * Resolves when the process is asked to stop.
 *
 * The worker has no HTTP server, so until cron jobs are registered nothing
 * keeps the event loop alive and the process would exit immediately. Awaiting
 * this keeps it running and lets Nest's shutdown hooks close cleanly.
 */
```

## backend/src/bootstrap/swagger.setup.ts

`line 6`

```text
/**
 * Keeps documentation wiring out of main.ts (single responsibility).
 */
```

## backend/src/bootstrap/validation.setup.ts

`line 3`

```text
/**
 * Request payload rules applied to every endpoint: unknown properties are
 * rejected rather than silently ignored, and payloads are transformed into
 * their DTO classes so types are real at runtime.
 */
```

## backend/src/common/utils/ttl-cache.ts

`line 6`

```text
/**
 * Minimal in-memory cache with per-entry expiry.
 *
 * Used to keep repeated lookups off the endoflife.date API within a sync run
 * and between UI requests. Process-local on purpose: the data is public,
 * cheap to refetch, and not worth a Redis dependency.
 */
```

## backend/src/config/env.validation.ts

`line 7`

```text
/**
 * Treats a blank value as absent.
 *
 * A key left empty in an .env template arrives as '', not undefined, so
 * `.optional()` alone does not cover it and the underlying check runs against
 * the empty string — which is how `JIRA_BASE_URL=` became "Invalid URL" rather
 * than "not configured". Anything a person is expected to leave blank until
 * they have a value for it goes through here.
 */
```

`line 25`

```text
// ---- General ----
```

`line 33`

```text
// ---- Database ----
```

`line 36`

```text
// ---- Auth ----
```

`line 37`

```text
/// dev  = email and password issued by this API (local work only)
```

`line 38`

```text
/// entra = Microsoft, with the URLs derived from the tenant id
```

`line 39`

```text
/// oidc  = any other provider, e.g. Keycloak, via explicit URLs
```

`line 45`

```text
/// Used when AUTH_MODE=oidc. The issuer as the provider states it,
```

`line 46`

```text
/// its key set, and the audience it stamps on tokens for this API.
```

`line 51`

```text
// ---- EOL sync ----
```

`line 56`

```text
// Client tuning for PLAN section 10.2 (timeout, retries, polite pacing).
```

`line 63`

```text
// ---- Notifications ----
```

`line 66`

```text
/// Renders and records what would be sent, without making the request.
```

`line 68`

```text
/// Power Automate trigger URL. Carries a sig= credential.
```

`line 76`

```text
// ---- Jira ----
```

`line 77`

```text
// All four are optional: with none of them set the app runs against a null
```

`line 78`

```text
// adapter, reports "not connected" and stays fully usable. The registry
```

`line 79`

```text
// must never depend on Jira being reachable.
```

`line 80`

```text
/// e.g. https://linearsix.atlassian.net — no trailing path.
```

`line 82`

```text
/// The account the API token belongs to. Cloud Basic auth is email:token.
```

`line 84`

```text
/// Carries full access as that user. Treated like TEAMS_WEBHOOK_URL: env
```

`line 85`

```text
/// only, never committed, never logged, never returned by an endpoint.
```

`line 87`

```text
/// Where upgrade epics are created, e.g. KAN.
```

`line 89`

```text
/// Scoped tokens are restricted to chosen scopes and must be sent through
```

`line 90`

```text
/// Atlassian's gateway; classic tokens carry full account access and go to
```

`line 91`

```text
/// the site URL. The two are indistinguishable as strings, so which one it
```

`line 92`

```text
/// is has to be stated rather than detected. Classic tokens are being
```

`line 93`

```text
/// phased out, so scoped is the default.
```

`line 95`

```text
/// How often the worker reconciles linked issues. Jira is a cache here.
```

`line 98`

```text
/// Serves invented issues so the integration can be shown without access
```

`line 99`

```text
/// to a real Jira. Never a fallback for missing credentials: it has to be
```

`line 100`

```text
/// turned on deliberately, and the panel says so on screen.
```

`line 103`

```text
// Invented issues must never reach a real deployment. The same rule
```

`line 104`

```text
// AUTH_MODE=dev follows.
```

`line 109`

```text
// Partial credentials are worse than none: the app would look connected and
```

`line 110`

```text
// fail on every call. Either all four, or none.
```

`line 124`

```text
// The app must refuse to start with AUTH_MODE=dev in production (PLAN section 5).
```

`line 164`

```text
/**
 * The validated, coerced environment. Config namespaces read from here rather
 * than from process.env, so nothing bypasses the schema.
 */
```

## backend/src/config/namespaces/auth.config.ts

`line 24`

```text
/**
     * The provider, reduced to the three things a token check needs.
     *
     * Entra fills these from the tenant id because its URLs are predictable;
     * anything else states them outright. The strategy reads only this, so it
     * never learns which provider it is talking to.
     */
```

## backend/src/config/namespaces/index.ts

`line 13`

```text
/** Every namespace loaded by AppConfigModule. */
```

## backend/src/config/namespaces/jira.config.ts

`line 19`

```text
/// Which of the four are still blank, for the setup checklist. Reports
```

`line 20`

```text
/// only whether each is set, never what it is.
```

`line 32`

```text
/// The env schema enforces all-four-or-none, so one check answers whether
```

`line 33`

```text
/// the real adapter can do anything at all.
```

## backend/src/config/namespaces/notification.config.ts

`line 11`

```text
/// True until someone deliberately turns it off: the safe default for
```

`line 12`

```text
/// something that posts into a company channel.
```

`line 16`

```text
/// Where a card points back to. Deep links carry the technology and cycle
```

`line 17`

```text
/// as query params, which opens the plan form already filled in.
```

## backend/src/jobs/jira-sync.job.ts

`line 6`

```text
/**
 * Keeps the Jira mirror current.
 *
 * Polling rather than webhooks: Atlassian would have to reach this application
 * to deliver one, and it runs on an internal network. If that changes, a
 * webhook endpoint can replace this and the rest of the design is unaffected —
 * which is the point of the mirror being a cache.
 *
 * Lives in the worker, never the API, for the same reason the notification
 * pass does: a page load must not trigger outbound traffic.
 */
```

`line 32`

```text
// Logged rather than silent, so "the board never updates" is never a
```

`line 33`

```text
// mystery.
```

## backend/src/jobs/jobs.module.ts

`line 8`

```text
/**
 * Scheduled work. Imported by WorkerModule only — the API must never run jobs.
 */
```

## backend/src/jobs/notifications.job.ts

`line 6`

```text
/**
 * The morning pass.
 *
 * Lives in the worker, never the API: a notification must not be a side effect
 * of someone loading a page. Two switches stand between this and a company
 * Teams channel — NOTIFY_ENABLED, and NOTIFY_DRY_RUN, which defaults to true.
 */
```

`line 28`

```text
// Logged rather than silent: "nothing arrived" should never be a mystery.
```

## backend/src/jobs/worker-heartbeat.service.ts

`line 6`

```text
/**
 * Keeps the worker process alive and reports liveness.
 *
 * A worker has no HTTP server; without at least one active timer Node would
 * exit as soon as bootstrap finished. The scheduled jobs from Phase 7 onward
 * register alongside this one.
 */
```

## backend/src/lifecycle/version.util.spec.ts

`line 42`

```text
// Docker's cycles are 18.09 and 19.03, not 18.9 and 19.3. Rebuilding the
```

`line 43`

```text
// string from parsed numbers would silently invent a cycle that upstream
```

`line 44`

```text
// has never published.
```

`line 51`

```text
// The reason major/minor/patch are stored as integers.
```

## backend/src/lifecycle/version.util.ts

`line 11`

```text
/**
 * Splits a version string into its numeric parts.
 *
 * Stored alongside the original string so versions sort numerically:
 * as text, '6.0.9' sorts after '6.0.14', which is wrong.
 *
 * Suffixes are ignored: '1.30.2-rc1' parses as 1.30.2.
 */
```

`line 33`

```text
/**
 * Reduces a version to the support cycle the data source publishes dates for.
 *
 * MAJOR:       20.11.1 -> '20'    (Node.js, RHEL, Angular)
 * MAJOR_MINOR: 6.0.14  -> '6.0'   (MongoDB, Kubernetes, OpenSSL)
 */
```

`line 46`

```text
// Built from the captured text, not from the parsed numbers: Docker ships
```

`line 47`

```text
// zero-padded minors (18.09, 19.03, 20.10), and rebuilding "09" from the
```

`line 48`

```text
// number 9 would produce a cycle that does not exist upstream.
```

`line 56`

```text
/** Orders two versions numerically. Negative when a is older than b. */
```

## backend/src/modules/auth/auth.module.ts

`line 15`

```text
// The signing key comes from the validated config namespace rather than
```

`line 16`

```text
// process.env, so a missing DEV_JWT_SECRET fails at startup, not at the
```

`line 17`

```text
// first sign-in attempt.
```

`line 29`

```text
/**
     * Exactly one strategy, chosen by AUTH_MODE, both registered under the
     * passport name 'jwt'.
     *
     * Registering both would have them fight over the name. Choosing here
     * means the guards, and every controller, never learn where a token
     * came from: they read request.user.role and that is all.
     */
```

## backend/src/modules/auth/auth.service.ts

`line 8`

```text
/** A working day, so nobody is signed out mid-change. */
```

`line 22`

```text
// Verified even when the user is missing, and answered with one message
```

`line 23`

```text
// either way: replying faster, or differently, for an unknown address tells
```

`line 24`

```text
// an attacker which of these addresses are real.
```

`line 58`

```text
/**
   * The account behind a token.
   *
   * Re-read rather than taken from the token's claims, so deactivating someone
   * or changing their role takes effect on their next request instead of when
   * their token happens to expire.
   */
```

## backend/src/modules/auth/current-user.decorator.ts

`line 3`

```text
/** Whatever the active strategy put on the request. */
```

`line 10`

```text
/**
 * The signed-in account, from the verified token.
 *
 * This replaced an `x-acting-user` header the client set itself. That header
 * decided `recordedById` on the change history — the hash-chained record the
 * whole verification story rests on — so anyone could attribute a version
 * change to anyone else, and the chain would preserve the lie faithfully.
 *
 * Safe to treat as present: the global JwtAuthGuard rejects anonymous callers
 * before a handler runs, so only a @Public() route could see this undefined.
 */
```

## backend/src/modules/auth/guards/editor.guard.ts

`line 10`

```text
/** Methods that only read. Everything else changes something. */
```

`line 13`

```text
/**
 * Viewers may read the registry; they may not change it.
 *
 * The rule comes from the HTTP method rather than a decorator on each route.
 * Fifty-odd endpoints would each need annotating, and the way this kind of
 * check fails in practice is the one route nobody remembered — a method-based
 * rule cannot be forgotten, and a new mutating endpoint is protected the
 * moment it is written.
 *
 * Anything needing a finer rule than "editors may write" gets its own guard;
 * this is the floor, not the ceiling.
 */
```

`line 47`

```text
// JwtAuthGuard runs first and rejects anonymous callers, so a missing user
```

`line 48`

```text
// here means the guards are registered in the wrong order.
```

## backend/src/modules/auth/guards/jwt-auth.guard.ts

`line 6`

```text
/**
 * Requires a valid token on every route that has not opted out.
 *
 * Registered globally, so the default is closed. Before this, only /auth/me
 * carried a guard and every other endpoint in the API — including the ones
 * that delete projects and users — accepted anonymous calls.
 */
```

## backend/src/modules/auth/password.util.ts

`line 9`

```text
// Typed explicitly: promisify collapses scrypt's overloads onto the one without
```

`line 10`

```text
// options, which is the variant that cannot set the cost parameters.
```

`line 19`

```text
/**
 * Password hashing with scrypt.
 *
 * scrypt ships with Node and is memory-hard, so there is no native module to
 * build in the Alpine image and no chance of a plain digest creeping in. The
 * parameters are stored with the hash, which is what allows them to be raised
 * later without invalidating every existing password.
 */
```

`line 27`

```text
// CPU/memory cost
```

`line 28`

```text
// block size
```

`line 29`

```text
// parallelisation
```

`line 51`

```text
/**
 * Whether a password matches a stored digest.
 *
 * Compared with timingSafeEqual rather than `===`: a byte-by-byte comparison
 * returns early at the first difference, and that timing difference is enough
 * to recover the hash a character at a time.
 */
```

## backend/src/modules/auth/public.decorator.ts

`line 5`

```text
/**
 * Opens one route to unauthenticated callers.
 *
 * Authentication is on by default for the whole API, so this is the only way
 * in. Deliberately an opt-out rather than an opt-in: a new endpoint that
 * nobody remembered to annotate should be closed, not open, which is the way
 * round this API had it before.
 */
```

## backend/src/modules/auth/strategies/jwt.strategy.ts

`line 12`

```text
/**
 * Validates the tokens this API issues.
 *
 * Only the local signing key: Entra tokens arrive with a different issuer and
 * are verified against its JWKS, which is a separate strategy for when
 * AUTH_MODE=entra lands.
 */
```

`line 30`

```text
// Whatever this returns becomes request.user.
```

## backend/src/modules/auth/strategies/oidc.strategy.ts

`line 8`

```text
/**
 * Claims we rely on, across providers.
 *
 * Entra puts the sign-in address in `preferred_username` and only sometimes
 * populates `email`; Keycloak populates `email`. Both are checked rather than
 * assuming one, because a missing address here means everyone silently drops
 * to viewer.
 */
```

`line 24`

```text
/**
 * Sign-in delegated to an identity provider.
 *
 * Registered under the same passport name as the dev strategy, so the guards
 * never learn where a token came from — they read `request.user.role` either
 * way. Swapping providers is configuration.
 *
 * Deliberately generic rather than Entra-specific: the issuer and key set are
 * configuration, so the same code serves Entra or Keycloak. Only the URLs
 * differ, which is the whole reason this is not worth writing twice.
 *
 * What it does NOT do is trust the provider for authorisation. The token says
 * who someone is; this registry decides what they may do, by looking the
 * address up in its own user table. Anyone the provider will authenticate but
 * we do not know becomes a viewer — they can read, and change nothing.
 */
```

`line 58`

```text
// Keys are fetched from the provider and cached. Rate limiting matters:
```

`line 59`

```text
// without it a burst of tokens signed by an unknown key would become a
```

`line 60`

```text
// burst of outbound requests.
```

`line 68`

```text
// Both must be checked. A signature alone only proves the provider
```

`line 69`

```text
// issued the token — not that it was issued for this API.
```

`line 87`

```text
// Better to refuse than to hand out a viewer session to a token we
```

`line 88`

```text
// cannot attribute to anyone.
```

`line 100`

```text
// Known to the directory, unknown to us: read-only. Matching on address
```

`line 101`

```text
// rather than the provider's own subject id is what lets the same user
```

`line 102`

```text
// table survive a change of tenant or provider.
```

## backend/src/modules/deployments/deployments.controller.ts

`line 40`

```text
// From the verified token, never from the request body or a header: this
```

`line 41`

```text
// id is written into the tamper-evident history as who did it.
```

## backend/src/modules/deployments/deployments.service.ts

`line 14`

```text
/**
 * Changing what an environment runs, and remembering that it changed.
 *
 * The write and the history entry happen in one transaction: an environment
 * whose recorded state moved without a matching history row would be worse
 * than no history at all.
 */
```

`line 61`

```text
// Our own software has no upstream to import from, so its cycles are
```

`line 62`

```text
// created as versions are recorded. Nobody should have to register a
```

`line 63`

```text
// Lime release before deploying it.
```

`line 68`

```text
// For anything tracked upstream a cycle is only ever created from published
```

`line 69`

```text
// data. Inventing one would put a component into the estate with no
```

`line 70`

```text
// end-of-life date — the exact blind spot this tool exists to remove.
```

`line 77`

```text
// Reuse the version row if we already know it; otherwise record it.
```

`line 116`

```text
// Sequence and hash are computed inside the transaction so two
```

`line 117`

```text
// simultaneous recordings cannot claim the same position; the unique
```

`line 118`

```text
// index on (deployment_id, sequence) is the backstop.
```

`line 178`

```text
/**
   * Which published cycle a version belongs to.
   *
   * Derivation from `cycleRule` is only a hint: Docker ships 18.09 under a
   * major.minor scheme and 27, 28 under a major one, so no single rule maps
   * both. The published cycle always wins — the longest known cycle that the
   * version sits under — and derivation is the fallback when nothing matches.
   */
```

`line 199`

```text
// Registered cycles alone are still a reasonable basis.
```

`line 210`

```text
/**
   * A dateless cycle for a technology nobody publishes dates for.
   *
   * Deliberately no eolDate: it resolves to UNKNOWN throughout, which reads as
   * "no published date" rather than pretending the version is supported
   * forever.
   */
```

`line 232`

```text
/**
   * Registers a cycle the source publishes but we have never deployed, with
   * the source's own dates. Returns null when the source does not know it.
   */
```

`line 294`

```text
/** Recomputes the chain and reports whether anything was altered. */
```

`line 318`

```text
/** The change log as CSV, which is how auditors want to receive it. */
```

`line 356`

```text
/**
   * Upgrade targets: every version newer than the one running now.
   *
   * Merges what the registry already knows with what the lifecycle source
   * publishes, so a cycle we have never deployed still appears — with its real
   * end-of-life date rather than a blank. Older versions are left out: this
   * picker exists to move forward, and a downgrade is rare enough to type by
   * hand.
   */
```

`line 408`

```text
// Cycles the source publishes but we have never deployed.
```

`line 419`

```text
// The registry alone is still a usable answer; never fail the picker
```

`line 420`

```text
// because an external source is unreachable.
```

`line 449`

```text
/** Quotes a CSV cell only when it needs it. */
```

## backend/src/modules/deployments/history.util.ts

`line 3`

```text
/**
 * Tamper evidence for the change log.
 *
 * Each entry hashes its own content together with the hash of the entry before
 * it, so the entries in one environment form a chain. Editing or deleting a
 * row in the database without going through the API breaks every hash after
 * it, and /history/verify reports exactly where.
 *
 * This does not prevent tampering — anyone with database access can rewrite
 * the chain wholesale. It makes quiet, single-row tampering detectable, which
 * is what an auditor actually asks for.
 */
```

`line 20`

```text
/** YYYY-MM-DD */
```

`line 24`

```text
/**
 * The exact string that gets hashed.
 *
 * Kept deliberately narrow and stable: the facts of the change, not its
 * annotations. A typo fixed in a note must not invalidate the chain, and the
 * backfill in migration 20260922130920 builds the same string in SQL.
 */
```

`line 60`

```text
/** Sequence numbers whose stored hash does not match a recomputation. */
```

`line 65`

```text
/** Recomputes the whole chain and reports where it stops matching. */
```

## backend/src/modules/eol-sync/adapters/endoflife-date.client.ts

`line 22`

```text
/** Responses change at most daily upstream, so an hour of caching is safe. */
```

`line 25`

```text
/** Upstream failures worth retrying — transient, not "you asked for nothing". */
```

`line 47`

```text
/**
 * endoflife.date API v1 adapter.
 *
 * Owns transport concerns only — URLs, timeouts, retries, caching and response
 * validation — and hands back domain types. No business rules live here.
 */
```

`line 142`

```text
// A 404 here means "no such cycle", which is an answer, not a failure.
```

`line 150`

```text
/** Drops cached responses so the next call hits the network. */
```

`line 217`

```text
// A non-retryable status (e.g. 400) will fail identically next time.
```

## backend/src/modules/eol-sync/adapters/endoflife-date.schema.ts

`line 3`

```text
/**
 * Wire format of endoflife.date API v1 (schema_version 1.2.x).
 *
 * The API is Beta, so every response is validated before use: an unexpected
 * shape must fail loudly during sync rather than silently write nulls over
 * good EOL dates. Unknown properties are ignored, so additive changes upstream
 * do not break us.
 */
```

`line 12`

```text
/** ISO date, date-only: "2028-04-30". */
```

`line 62`

```text
/** Every v1 response wraps its payload in this envelope. */
```

`line 73`

```text
/** Categories, tags and identifiers are all listed as { name, uri }. */
```

## backend/src/modules/eol-sync/eol-lookup.service.ts

`line 15`

```text
/**
 * Read-only lifecycle lookups against the external source.
 *
 * Deliberately has no database dependency: this is what the registry uses to
 * discover slugs and cycles when a technology is being added. Writing the data
 * into technology_version is EolSyncService's job (Phase 7).
 */
```

`line 35`

```text
// Let the source narrow by category or tag — far cheaper than pulling all
```

`line 36`

```text
// 475 products and filtering here.
```

## backend/src/modules/eol-sync/eol-sync.controller.ts

`line 66`

```text
// Declared before the :cycle route so "latest" is not read as a cycle name.
```

## backend/src/modules/eol-sync/eol-sync.module.ts

`line 7`

```text
/**
 * Binds the EOL_DATA_SOURCE port to the endoflife.date adapter.
 * Swapping providers, or faking one in tests, means changing this line only.
 */
```

## backend/src/modules/eol-sync/mappers/release-to-version.mapper.ts

`line 3`

```text
/**
 * The lifecycle fields a TechnologyVersion takes from the data source.
 * Matches the API-owned columns in the Prisma model (Phase 2).
 */
```

`line 16`

```text
/**
 * Picks the date a technology treats as its end of life.
 *
 * Which phase counts differs per product: for most it is `eol`, but a product
 * with paid extended support may track `eoes`, and a team that will not run
 * security-only builds may track `eoas`. Technology.eolField decides.
 */
```

`line 43`

```text
// Date-only values are anchored at UTC midnight so the stored DATE does not
```

`line 44`

```text
// shift when the container runs in Asia/Colombo.
```

`line 63`

```text
/** Finds the release matching a registered version's cycle. */
```

## backend/src/modules/eol-sync/ports/eol-data-source.port.ts

`line 1`

```text
/**
 * The lifecycle data source the registry depends on.
 *
 * Consumers depend on this interface, never on endoflife.date directly, so the
 * provider can be swapped (or faked in tests) without touching sync logic.
 */
```

`line 9`

```text
/** Which date field a technology treats as its end of life. */
```

`line 13`

```text
/** Slug used to address the product, e.g. "nodejs". */
```

`line 27`

```text
/** One support cycle of a product, e.g. Node.js "24". */
```

`line 29`

```text
/** Cycle identifier — matches TechnologyVersion.cycle. */
```

`line 36`

```text
/** End of active support. */
```

`line 38`

```text
/** End of life / security support. */
```

`line 40`

```text
/** End of extended/commercial support. */
```

`line 47`

```text
/** What this product calls each support phase, for display. */
```

`line 55`

```text
/** Every product the source knows about, without release detail. */
```

`line 58`

```text
/**
   * Every product *with* its releases, in a single request.
   *
   * Preferred by the nightly sync: one call instead of one per technology,
   * which removes the per-product pacing delay entirely. The payload is large
   * (~2.8 MB), so this is for background work, not for serving a UI request.
   */
```

`line 67`

```text
/** One product with all of its release cycles. */
```

`line 70`

```text
/** A single cycle, or null when the product has no such cycle. */
```

`line 73`

```text
/** The most recent cycle of a product, used to suggest an upgrade target. */
```

`line 76`

```text
/** Category names, e.g. database, framework, os. */
```

`line 79`

```text
/** Products in one category — cheaper than filtering the full list. */
```

`line 82`

```text
/** Tag names, e.g. javascript-runtime, apache. */
```

`line 85`

```text
/** Products carrying one tag. */
```

## backend/src/modules/health/prisma.health.ts

`line 5`

```text
/**
 * Single responsibility: report whether the database answers a trivial query.
 */
```

## backend/src/modules/issue-tracker/adapters/demo.adapter.ts

`line 10`

```text
/**
 * Invented issues, for showing the integration without access to a Jira.
 *
 * This is a demonstration, not test data. It exists so the whole flow — link,
 * mirror, sync, unlink — can be walked through and reviewed before anyone has
 * credentials, and it runs through exactly the same service, endpoints, mirror
 * table and panel the real adapter does. Swapping to real Jira changes one
 * environment variable and nothing else.
 *
 * Four things keep it from ever being mistaken for real:
 *
 * - It is bound only when JIRA_DEMO=true, never as a fallback for missing
 *   credentials. Forgetting to configure Jira yields "not connected".
 * - The environment schema refuses to start with it on in production.
 * - Every key it mints is prefixed DEMO, so even a screenshot reads as fake.
 * - The panel shows a badge saying the issues are not real.
 *
 * What it writes goes only to the jira_subtask mirror, which is a cache by
 * design: unlinking deletes those rows and no registry table is touched.
 */
```

`line 45`

```text
// A reserved key that always fails, so the error path can be shown too:
```

`line 46`

```text
// a link that breaks is as much a part of the flow as one that works.
```

`line 61`

```text
// The parent tracks its children: still open while any remain.
```

`line 89`

```text
/**
   * Pretends to create, and says so.
   *
   * Returning the issue without persisting anything is the honest behaviour
   * here: the next sync rebuilds the list from the fixed breakdown, so a demo
   * creation visibly does not stick. Better that than writing invented rows
   * into the mirror and letting them look permanent.
   */
```

`line 112`

```text
/**
   * The breakdown, derived from the key so a re-sync does not reshuffle it.
   *
   * Sub-task numbers hang off the parent's own number, so DEMO-101 and
   * DEMO-205 read as different pieces of work rather than the same list twice.
   */
```

`line 139`

```text
/**
 * A realistic shape for a platform upgrade: three done, one running, five
 * waiting — enough to exercise the progress bar, all three status colours and
 * the strikethrough at once.
 *
 * The last step points back at this registry, which is the whole argument for
 * the two tools existing side by side: Jira records that someone did the work,
 * and only the registry records that the deployed version actually changed.
 */
```

## backend/src/modules/issue-tracker/adapters/jira.adapter.ts

`line 13`

```text
/** Jira Cloud caps a page at 100; we ask for that and follow the cursor. */
```

`line 16`

```text
/**
 * Jira Cloud, REST API v3.
 *
 * Four things here are not obvious and are easy to get wrong:
 *
 * - Search is `/rest/api/3/search/jql`. The old `/rest/api/3/search` has been
 *   removed, not merely deprecated, and paging is a `nextPageToken` cursor
 *   rather than `startAt`. Most tutorials still show the old one.
 * - Auth is Basic with `email:apiToken`, which is Cloud's scheme. Data Center
 *   uses a bare bearer PAT instead, which is why this adapter is Cloud-only
 *   and a second adapter would be needed for Data Center.
 * - A scoped token and a classic one are both opaque strings, but they are
 *   sent to different hosts: scoped tokens go through Atlassian's gateway at
 *   api.atlassian.com and need the site's cloud id, classic tokens go to the
 *   site itself. Nothing in the token says which it is, so the type is
 *   configured rather than sniffed.
 * - v3 wants rich text as ADF (nested JSON), not a string; a plain string in
 *   `description` is a 400. Hence `toAdf` on the one write path here.
 *
 * The token is never logged and never returned. Errors carry status codes and
 * Jira's own message, both of which are safe; the Authorization header is not.
 */
```

`line 42`

```text
/** Resolved once. A site's cloud id does not change. */
```

`line 45`

```text
/** Sub-task issue type id, per project. Differs per project and per site. */
```

`line 66`

```text
// Cheapest authenticated call that proves both reachability and that the
```

`line 67`

```text
// credentials are accepted.
```

`line 76`

```text
// The two token types are sent to different hosts, so the wrong setting
```

`line 77`

```text
// fails as a 401 that reads like bad credentials. Saying which one was
```

`line 78`

```text
// assumed turns a guessing game into a one-line fix.
```

`line 99`

```text
// `parent = X` covers both sub-tasks and the children of an epic on
```

`line 100`

```text
// team-managed projects, which is why it is used rather than `subtasks`.
```

`line 120`

```text
// `isLast` is absent on older responses, so the cursor is the condition.
```

`line 137`

```text
// The project comes from the parent rather than JIRA_PROJECT_KEY: a plan
```

`line 138`

```text
// may be linked to an issue that lives somewhere else entirely, and the
```

`line 139`

```text
// child has to be created beside its parent.
```

`line 150`

```text
// v3 rejects a plain string here — rich text has to be ADF.
```

`line 165`

```text
// Read it back rather than assembling the response from what we sent:
```

`line 166`

```text
// Jira applies its own defaults, and the status is one of them.
```

`line 170`

```text
/**
   * The id of the project's sub-task type.
   *
   * Issue type ids differ per project and per site, so they cannot be
   * hardcoded. Cached because it only changes if someone edits the project's
   * issue type scheme.
   */
```

`line 213`

```text
/**
   * Where REST calls go, which depends on the kind of token.
   *
   * A scoped token is rejected at the site URL and a classic one is rejected
   * at the gateway, so getting this wrong produces a 401 that looks like bad
   * credentials rather than a wrong address — which is why the type is
   * configured explicitly and named in the error below.
   */
```

`line 228`

```text
/**
   * The site's cloud id, from its own public tenant-info endpoint.
   *
   * Unauthenticated on purpose: it runs before the token is ever used, so a
   * failure here is clearly "the site URL is wrong" rather than "the
   * credentials are wrong". Cached for the life of the process.
   */
```

`line 262`

```text
/**
   * A write. Deliberately not folded into `request`: reads retry freely, and a
   * create that is retried after an ambiguous failure can leave two issues
   * behind. This one tries once.
   */
```

`line 324`

```text
// 401/403/404 will not fix themselves — bad credentials are bad every
```

`line 325`

```text
// time, and a missing issue stays missing. Only throttling and server
```

`line 326`

```text
// faults are worth another attempt.
```

`line 344`

```text
// Deliberately does not include the URL or any header: this message is
```

`line 345`

```text
// stored on the action and shown in the UI.
```

`line 350`

```text
/** Jira's category keys, mapped to ours. */
```

`line 365`

```text
/** Jira's own error text when it gives one, so a 400 says what was wrong. */
```

`line 387`

```text
/** Honours Retry-After when Jira throttles, else backs off. */
```

`line 400`

```text
/**
 * Plain text as an Atlassian Document Format paragraph per line.
 *
 * v3 returns 400 for a plain string in `description`, so even one sentence has
 * to be wrapped. Blank lines are dropped rather than becoming empty paragraphs.
 */
```

## backend/src/modules/issue-tracker/adapters/null.adapter.ts

`line 8`

```text
/**
 * The tracker when none is configured.
 *
 * It exists so the registry runs with an empty .env: no Jira credentials means
 * the panel reports "not connected" and every other part of the application is
 * untouched. Tracking end-of-life dates must never depend on Jira being set up,
 * let alone reachable.
 *
 * It refuses rather than returning empty results, because silently returning
 * nothing would look like an issue with no sub-tasks.
 */
```

## backend/src/modules/issue-tracker/dto/link-issue.dto.ts

`line 21`

```text
/**
 * A step to add under the linked issue.
 *
 * Note what is absent: no status, no time, no comments. Those are Jira's to
 * own, and offering them here would rebuild the very thing this replaced.
 */
```

## backend/src/modules/issue-tracker/issue-tracker.module.ts

`line 11`

```text
/**
 * Binds ISSUE_TRACKER to one of three adapters: the demo, real Jira, or
 * nothing at all.
 *
 * Choosing at bind time rather than inside an adapter means an unconfigured
 * deployment has no Jira code in its path, and the panel's "not connected"
 * state is a property of the wiring rather than a branch repeated in every
 * method.
 *
 * Demo takes precedence over real credentials on purpose. Someone who has
 * turned it on wants invented issues; silently preferring the live Jira
 * because credentials happen to be present would be the surprising outcome,
 * and would post a demo walkthrough at a real project. It is logged as a
 * warning every start so it can never be on without anyone noticing.
 */
```

## backend/src/modules/issue-tracker/issue-tracker.service.ts

`line 16`

```text
/** Jira keys look like ABC-123. Checked here so a typo fails before a request. */
```

`line 29`

```text
/**
   * Whether anything could be fetched right now.
   *
   * Reports that credentials exist, never what they are — the same rule the
   * Teams webhook follows. `reachable` costs a request, so it is only run when
   * something is configured.
   */
```

`line 47`

```text
/// The panel badges itself off this, so invented issues always announce
```

`line 48`

```text
/// themselves on screen.
```

`line 50`

```text
/// Which environment variables are still blank, so setting Jira up later
```

`line 51`

```text
/// is a checklist rather than guesswork. Names only — never values.
```

`line 59`

```text
/**
   * Points an upgrade action at an issue that already exists.
   *
   * The issue is fetched before anything is written, so a bad key or an issue
   * nobody can see fails loudly instead of storing a link that never resolves.
   */
```

`line 98`

```text
/**
   * Forgets the link. The Jira issue is left completely alone — this tool does
   * not delete other people's work.
   */
```

`line 127`

```text
/**
   * Refreshes one action's mirror from Jira.
   *
   * A failure is recorded on the row rather than thrown: the panel should be
   * able to say "last synced an hour ago, and the last attempt failed because
   * X" instead of showing nothing at all.
   */
```

`line 150`

```text
// Replaced wholesale rather than merged: a sub-task deleted in Jira
```

`line 151`

```text
// must disappear here, and diffing to discover that costs more than
```

`line 152`

```text
// rewriting a handful of rows.
```

`line 196`

```text
/**
   * Refreshes every linked action. Run by the worker, never by the API.
   *
   * Sequential on purpose: Jira Cloud rate-limits by cost, and a burst of
   * parallel requests across twenty plans is exactly what trips it.
   */
```

`line 223`

```text
/**
   * Adds a step to the linked issue.
   *
   * The only write this application makes into the tracker, and it is
   * deliberately one-way: the sub-task is created over there and everything
   * afterwards — status, comments, time — happens over there too. Creating
   * work is not the same as owning it.
   *
   * Unlike `sync`, a failure throws rather than being recorded on the row.
   * Someone is standing at the form waiting to hear whether it worked.
   */
```

`line 258`

```text
// Re-read, so the mirror holds what Jira actually has rather than what we
```

`line 259`

```text
// think we sent.
```

`line 266`

```text
// Jira's JQL index lags creation by a second or two, so the search above
```

`line 267`

```text
// can come back without the issue that was just made. Without this, a step
```

`line 268`

```text
// someone adds disappears until the next scheduled pass — up to fifteen
```

`line 269`

```text
// minutes of looking like it failed. The row is written from the create
```

`line 270`

```text
// response, and the next sync reconciles it either way.
```

`line 299`

```text
/** Who the tracker will let you assign work to on this issue. */
```

`line 310`

```text
// An empty picker is a better failure than a broken form.
```

`line 316`

```text
/** What the panel renders. Reads the mirror only — never calls Jira. */
```

## backend/src/modules/issue-tracker/ports/issue-tracker.port.ts

`line 1`

```text
/**
 * Where the work is actually managed.
 *
 * Consumers depend on this, never on Jira directly — the same shape as
 * EOL_DATA_SOURCE and NOTIFICATION_CHANNEL. If the company ever moves to Azure
 * DevOps or Linear, that is another adapter bound to this symbol rather than a
 * rewrite of the service.
 */
```

`line 11`

```text
/**
 * Jira's own status grouping.
 *
 * Deliberately not the status name: workflows get renamed and differ per
 * project, but the category is stable, so this is what the UI colours by.
 */
```

`line 20`

```text
/** Jira's immutable id. Survives an issue moving project. */
```

`line 22`

```text
/** What a person types and reads, e.g. OPS-1042. */
```

`line 29`

```text
/** Present for sub-tasks, absent for the epic or task above them. */
```

`line 33`

```text
/**
 * What a new child issue needs.
 *
 * The description is plain text: the tracker's own format is the adapter's
 * problem, so callers never build Atlassian Document Format by hand.
 */
```

`line 42`

```text
/** ISO date, or null to leave it unset. */
```

`line 44`

```text
/** The tracker's own account id, not one of ours. Null leaves it open. */
```

`line 48`

```text
/** Someone who can be given work on a particular issue. */
```

`line 55`

```text
/** Named in the UI, so a panel says where the work lives. */
```

`line 58`

```text
/** False when nothing is configured — the UI says so rather than failing. */
```

`line 61`

```text
/** Throws if the issue does not exist or cannot be read. */
```

`line 64`

```text
/** Sub-tasks of an issue, in Jira's own order. */
```

`line 67`

```text
/**
   * Adds a child under an existing issue.
   *
   * The only write this application makes. It creates work in the tracker and
   * then forgets about it — status, comments and time all stay over there, so
   * this stops short of becoming a second place to manage the same task.
   */
```

`line 76`

```text
/** Who can be given work on this issue, as the tracker sees it. */
```

`line 79`

```text
/** A quick reachability and credential check for the status endpoint. */
```

## backend/src/modules/notifications/adapters/teams.adapter.ts

`line 8`

```text
/** A hung flow must not stall the morning run. */
```

`line 12`

```text
/**
 * Posts an Adaptive Card through a Power Automate workflow.
 *
 * This is the replacement for the retired Office 365 "Incoming Webhook"
 * connector, and the payload differs: the flow expects a message with an
 * adaptive-card attachment, not the old MessageCard.
 */
```

`line 33`

```text
// Dry run stops before the request, not after: the point is that nothing
```

`line 34`

```text
// leaves this machine.
```

`line 62`

```text
// A 4xx will not fix itself — a bad signature is bad on every attempt.
```

`line 63`

```text
// Only throttling and server faults are worth trying again.
```

`line 83`

```text
// The URL is never included: it carries the signature, and this message
```

`line 84`

```text
// ends up in the notification log.
```

`line 89`

```text
/** The exact body the Power Automate flow receives. */
```

`line 147`

```text
// Without this block the <at> tag renders as plain text and nobody is
```

`line 148`

```text
// pinged — the failure mode that looks like it worked.
```

`line 169`

```text
/** Honours Retry-After when Power Automate throttles, else backs off. */
```

## backend/src/modules/notifications/notifications.module.ts

`line 7`

```text
/**
 * Binds NOTIFICATION_CHANNEL to the Teams adapter.
 *
 * Adding email or Slack is another provider bound to the same symbol, not a
 * change to the service — which is why the service never mentions Teams.
 */
```

## backend/src/modules/notifications/notifications.renderer.ts

`line 19`

```text
/**
 * Turning a deadline into something worth reading at 08:00.
 *
 * No ticket reference anywhere: there is no Jira integration yet, and a card
 * that prints a key nobody created is noise. The plan line names the person,
 * which is the part that decides whether anyone acts. When tickets arrive this
 * is the one place that changes.
 */
```

`line 49`

```text
// Named, or plainly unowned. "None" is the finding, not a missing value.
```

`line 78`

```text
/**
 * One card instead of many.
 *
 * No mention: a summary is not a request of any one person, and pinging
 * someone for six things at once trains them to ignore the seventh.
 */
```

`line 131`

```text
/** Two units, as people say them: "7 years and 1 month". */
```

## backend/src/modules/notifications/notifications.service.ts

`line 14`

```text
/** Above this, one summary goes out instead of a card each. */
```

`line 17`

```text
/** How often something already unsupported is repeated. */
```

`line 30`

```text
/**
 * Deciding what to announce, and remembering that it was announced.
 *
 * The dedup key is enforced by a unique index rather than by this code, so two
 * runs overlapping cannot double-post. It includes the end-of-life date, which
 * is what makes a moved deadline re-arm every threshold instead of being
 * silently suppressed.
 */
```

`line 48`

```text
/**
   * Everything inside a notice period that has not been announced yet.
   *
   * Read straight from the estate: cycles that something is actually running,
   * with the environments running them and whoever is answerable.
   */
```

`line 74`

```text
// One entry per cycle, carrying every environment that runs it — a card
```

`line 75`

```text
// per environment would say the same thing three times.
```

`line 122`

```text
/**
   * Whoever should answer for each one.
   *
   * There is no upgrade-action API yet, so nothing is ever "assigned" — every
   * card falls to the project lead. When actions are persisted this is where
   * the assignee takes over.
   */
```

`line 146`

```text
// The sign-in address; a display name alone cannot be mentioned.
```

`line 154`

```text
/** What has already gone out, so the same thing is not announced twice. */
```

`line 175`

```text
// Something already unsupported is repeated weekly; every other
```

`line 176`

```text
// threshold is announced once and then stays quiet.
```

`line 191`

```text
/**
   * The whole run: find, filter, render, send, record.
   *
   * Safe to call by hand — with NOTIFY_DRY_RUN on it renders and logs without
   * a single request leaving the machine.
   */
```

`line 221`

```text
// One summary rather than a wall of cards. Six at once into the only
```

`line 222`

```text
// channel the team has is how a channel gets muted on its first day.
```

`line 240`

```text
/** Sends one card and records the outcome against everything it covered. */
```

`line 257`

```text
// A dry run must not claim anything was announced. Recording it would mark
```

`line 258`

```text
// every deadline as sent, and the first real run would then find nothing
```

`line 259`

```text
// to say — the rehearsal would have consumed the performance.
```

`line 264`

```text
// Otherwise recorded either way. A failure that leaves no trace is
```

`line 265`

```text
// indistinguishable from a quiet week, which is the worst thing this tool
```

`line 266`

```text
// could do.
```

`line 292`

```text
/** The log, newest first, for the bell. */
```

`line 313`

```text
/** Whether anything could actually be delivered right now. */
```

`line 318`

```text
// Never the URL itself: it carries the signature.
```

`line 326`

```text
/** The tightest notice period a cycle has fallen inside. */
```

## backend/src/modules/notifications/ports/notification-channel.port.ts

`line 1`

```text
/**
 * Where a notification goes.
 *
 * Consumers depend on this, never on Power Automate directly, so adding email
 * or Slack later is another provider rather than a rewrite — the same shape as
 * EOL_DATA_SOURCE.
 */
```

`line 10`

```text
/** One fact row on a card. */
```

`line 17`

```text
/** The Teams sign-in address. A display name alone cannot be mentioned. */
```

`line 27`

```text
/**
 * A notification, before it knows what it will be rendered into.
 *
 * Deliberately not an Adaptive Card: email and Slack need the same facts in a
 * different shape, and a model that is already a Teams card cannot give them
 * one.
 */
```

`line 35`

```text
/** Drives the colour band, not the wording. */
```

`line 42`

```text
/** Digest only: the grouped lines under each heading. */
```

`line 47`

```text
/** Named in the log, so a row says where it went without holding the URL. */
```

`line 49`

```text
/** Throws on failure. The caller records that, it does not swallow it. */
```

## backend/src/modules/projects/projects.controller.ts

`line 50`

```text
// Every component becomes an INSTALL in the history, attributed to whoever
```

`line 51`

```text
// is signed in rather than to whoever the client claimed to be.
```

## backend/src/modules/projects/projects.service.ts

`line 19`

```text
/** Our own product, tracked as a component of every environment. */
```

`line 22`

```text
/**
 * Reads projects with everything the UI needs in one call: environments, the
 * components each runs, and the lifecycle state of those components.
 *
 * Deliberately one query per screen rather than one per row — the client
 * should not have to fan out to render a list.
 */
```

`line 87`

```text
/**
   * Creates a project, its environments, and what each of them runs.
   *
   * Components are installed through the same path a later upgrade takes, so
   * every environment begins with a complete change history rather than
   * appearing fully formed with no record of how it got that way.
   */
```

`line 102`

```text
// Technologies must exist first: a stack entry naming something unknown
```

`line 103`

```text
// would create an environment with a component nobody tracks.
```

`line 152`

```text
// Lime itself is a component of every environment. It is what we sell, so
```

`line 153`

```text
// which release a customer is on matters at least as much as the versions
```

`line 154`

```text
// underneath it — and tracking it here means it gets the same per
```

`line 155`

```text
// environment history as everything else, rather than one field on the
```

`line 156`

```text
// project that cannot say DEV is ahead of PROD.
```

`line 188`

```text
/**
   * Everything recorded across a project's environments, newest first.
   *
   * The calendar needs one stream, not one call per environment: a project
   * with three environments would otherwise fan out three requests and stitch
   * them together in the browser.
   */
```

`line 196`

```text
// The id column is a UUID, so passing a code like "SYP" to it is rejected
```

`line 197`

```text
// by the driver before any row is compared — look it up by shape.
```

`line 233`

```text
/**
   * Registers Lime itself, once, so a new project never fails for want of it.
   *
   * No endoflife.date slug: nobody publishes support dates for our own
   * product, so its cycles carry none and read as "no published date" rather
   * than pretending a release is supported forever.
   */
```

`line 255`

```text
/**
   * Replaces who is staffed on a project.
   *
   * Sent whole rather than as add/remove calls: the picker already knows the
   * final list, and two people editing staffing at once should not be able to
   * interleave into a set neither of them chose.
   */
```

`line 290`

```text
// The first named is the lead unless one is chosen, so a project is never
```

`line 291`

```text
// left with nobody answerable for it.
```

`line 411`

```text
/** Counts each technology+version once, however many environments run it. */
```

## backend/src/modules/technologies/data/product-icons.ts

`line 1`

```text
/**
 * endoflife.date slug -> Simple Icons slug and brand colour.
 *
 * Generated by scripts/gen-product-icons.py. Matched on name, label and
 * alias, then by dropping vendor prefixes (amazon-rds-mysql is MySQL) and
 * trailing words (ansible-core is Ansible). Products Simple Icons does not
 * carry are absent and render as a lettered tile: 309 of
 * 477 products have a logo.
 */
```

## backend/src/modules/technologies/dto/create-technology.dto.ts

`line 25`

```text
/**
 * Registers one of the products endoflife.date publishes.
 *
 * The slug is the only required field: everything else is read from the product
 * and may be overridden. A technology cannot be invented here — one with no
 * published lifecycle dates would be a component nobody can track.
 */
```

## backend/src/modules/technologies/product-type.util.ts

`line 14`

```text
/**
 * Products that run containers, and products that schedule them.
 *
 * endoflife.date files both under generic categories — Docker Engine is "app",
 * Kubernetes is "server-app" — so the distinction the estate actually cares
 * about has to be named here.
 */
```

`line 45`

```text
/** Matched as a word inside the slug: amazon-msk is Kafka, amazon-mq-rabbitmq is RabbitMQ. */
```

`line 59`

```text
/**
 * What kind of component a published product is.
 *
 * A suggestion, not a verdict: the form shows it and the engineer can change
 * it. Ordered most specific first, because a product can carry several tags —
 * Kubernetes is tagged both `cncf` and `server-app`.
 */
```

`line 89`

```text
// java-runtime, php-runtime, javascript-runtime, python-runtime, ruby-runtime
```

`line 99`

```text
/**
 * Whether versions of this product map to a cycle by major or major.minor.
 *
 * Read from the cycles the product actually publishes rather than assumed:
 * MongoDB ships cycle "8.0", Docker ships "28". Getting this wrong puts a
 * component in a cycle that was never published, which is how a deployment
 * ends up with no end-of-life date.
 */
```

`line 118`

```text
/** The Simple Icons logo for a product, when one exists. */
```

## backend/src/modules/technologies/technologies.controller.ts

`line 11`

```text
/**
 * The registry: technologies and their support cycles, including cycles
 * entered by hand for products endoflife.date no longer publishes.
 */
```

## backend/src/modules/technologies/technologies.module.ts

`line 7`

```text
// Registering a technology imports its cycles, so the registry depends on
```

`line 8`

```text
// the lifecycle source port rather than reaching for the client directly.
```

## backend/src/modules/technologies/technologies.service.ts

`line 22`

```text
/**
 * The registry: technologies and their support cycles.
 *
 * Registering a technology pulls its published cycles in the same call. A
 * technology with no cycles cannot be deployed anywhere — `changeComponent`
 * refuses a version whose cycle has no end-of-life date — so importing later
 * would leave the registry holding entries nobody can use.
 */
```

`line 54`

```text
/**
   * Registers one of the products endoflife.date publishes.
   *
   * The slug is the input; name, component type, cycle rule and logo are all
   * read from the product. A technology invented here would have no published
   * lifecycle dates, which is the blind spot this tool exists to remove — so
   * the catalogue is the only way in, and its cycles are imported in the same
   * call.
   */
```

`line 134`

```text
/**
   * Our own software, and anything else nobody publishes dates for.
   *
   * No slug, so nothing to sync and no cycles to import: its versions exist to
   * record what is running where, not to warn about support ending. Cycles are
   * created as versions are recorded, so nobody has to register a Lime release
   * before deploying it.
   */
```

`line 174`

```text
/**
   * The whole endoflife.date catalogue, which is what you may add.
   *
   * Returned in full rather than searched server-side: it is a few hundred
   * products, so the picker filters as you type without a request per keystroke.
   * Each row carries its logo and a suggested component type, so choosing a
   * product fills the form instead of asking the engineer to restate it.
   */
```

`line 210`

```text
/** Already registered — shown as such rather than offered twice. */
```

`line 217`

```text
/** Every cycle the source publishes for a slug, with its real dates. */
```

`line 240`

```text
// Registration still stands; the nightly sync will pick the cycles up.
```

`line 286`

```text
// Falls back to the catalogue mark when the row predates the icon columns.
```

`line 312`

```text
/** The catalogue's mark for a slug, for rows registered before icons were stored. */
```

## backend/src/modules/upgrade-actions/upgrade-actions.service.ts

`line 16`

```text
/**
 * What the team intends to do about a deadline, and whether it happened.
 *
 * The part worth having is the second half. A ticket system will happily show
 * "done" while production still runs the old version; this holds the plan and
 * the recorded change side by side, so the claim can be checked against the
 * estate rather than believed.
 */
```

`line 88`

```text
// Sent whole rather than as a delta: the picker knows the final list, and
```

`line 89`

```text
// two people editing coverage at once should not interleave into a set
```

`line 90`

```text
// neither of them chose.
```

`line 130`

```text
/**
   * Marks one environment done.
   *
   * Per environment rather than per action: a rollout reaches DEV weeks before
   * PROD, and "in progress" cannot say which is left. The action completes on
   * its own once every environment has.
   */
```

`line 174`

```text
/**
   * Whether the estate actually moved.
   *
   * For each environment an action covers, looks for a recorded change of that
   * technology onto the target cycle. This is what separates "somebody ticked
   * a box" from "production is on the new version".
   */
```

`line 203`

```text
// Either the exact version planned, or anything in a newer cycle — an
```

`line 204`

```text
// upgrade that overshot the target still satisfies the intent.
```

`line 226`

```text
/** The estate agrees this environment moved. */
```

`line 254`

```text
/// Mirrored from Jira by the issue-tracker sync. Carried here so a
```

`line 255`

```text
/// board of twenty plans draws from one request rather than twenty.
```

`line 264`

```text
/**
       * Marked complete with nothing recorded against it. The finding no
       * ticket system can produce, because it does not know what is deployed.
       */
```

`line 270`

```text
/** The plan itself finishes after support ends. */
```

`line 307`

```text
/**
 * What the state actually is, rather than what someone selected.
 *
 * Progress and dates are facts; a dropdown anyone can set to "Completed" is
 * not. Only PLANNED and DEFERRED survive as genuine human decisions.
 */
```

## backend/src/modules/users/users.controller.ts

`line 5`

```text
/**
 * The people who can be staffed on a project.
 *
 * Separate from the project payload on purpose: the engineer picker needs
 * everyone who *could* be assigned, and reading them off the projects only ever
 * returns the people already assigned — a closed loop that makes it impossible
 * to add anyone new.
 */
```

`line 25`

```text
// Deactivated accounts keep their rows so history stays attributed to
```

`line 26`

```text
// them, but they are not offered for new work.
```

`line 41`

```text
/** Whether they can record changes, or only look. */
```

## backend/src/prisma/prisma.service.ts

`line 9`

```text
/**
 * Owns the database connection lifecycle and nothing else.
 * Consumers depend on this service, never on PrismaClient construction.
 */
```

## backend/src/worker.module.ts

`line 7`

```text
/**
 * Worker entry module: same codebase, no HTTP surface.
 * Cron jobs (EOL sync, notifications) register in JobsModule from Phase 7 on.
 */
```

## frontend/src/app/app.config.ts

`line 15`

```text
/**
 * Zoneless: every state change goes through signals, so Angular is notified
 * explicitly rather than by patching the runtime. State is updated with
 * .set()/.update(), never by mutating a field in place.
 */
```

`line 24`

```text
// Auth first: the token goes on before anything else touches the request.
```

## frontend/src/app/app.routes.ts

`line 5`

```text
/**
 * Two groups: the auth pages, which own the whole window, and everything else,
 * which renders inside the signed-in chrome.
 *
 * Older paths redirect, so links shared before the consolidation still work.
 */
```

`line 49`

```text
// Query params bind straight to the component's inputs, so
```

`line 50`

```text
// /plan?technology=…&cycle=… opens the form already filled in.
```

`line 63`

```text
// consolidated away
```

## frontend/src/app/app.ts

`line 4`

```text
/**
 * Root component.
 *
 * Deliberately empty: the signed-in chrome lives in Shell, reached through a
 * layout route, so sign-in and sign-up can render as full pages rather than
 * inside a navigation bar.
 */
```

## frontend/src/app/core/api.ts

`line 4`

```text
/**
 * The API, as the UI sees it.
 *
 * These shapes are what /api/v1/projects and /api/v1/technologies return; the
 * backend resolves lifecycle state server-side, so nothing here recomputes
 * what the database already knows.
 */
```

`line 77`

```text
/** Simple Icons slug and brand colour, resolved when it was registered. */
```

`line 84`

```text
/**
 * One product endoflife.date publishes.
 *
 * The registry can only hold these: a technology invented locally would have no
 * published lifecycle dates, which is the blind spot this tool exists to close.
 */
```

`line 99`

```text
/** The local name it is already registered under, or null. */
```

`line 103`

```text
/** Someone who can be staffed on a project. */
```

`line 110`

```text
/** False for viewers, who can look but not record. */
```

`line 116`

```text
/** Whether anything could actually be delivered. Never carries the webhook URL. */
```

`line 125`

```text
/** One send attempt, successful or not. */
```

`line 138`

```text
/** One environment an action covers, with whether the estate agrees it moved. */
```

`line 145`

```text
/** A recorded change confirms this environment is on the new version. */
```

`line 158`

```text
/** Computed from progress and dates — OVERDUE and IN_PROGRESS are facts. */
```

`line 165`

```text
/** Mirrored from Jira, so the board needs no extra request per plan. */
```

`line 174`

```text
/** Marked complete with no recorded change behind it. */
```

`line 176`

```text
/** The plan finishes after support ends. */
```

`line 181`

```text
/** Jira's own status grouping. Survives a workflow being renamed. */
```

`line 184`

```text
/** One sub-task, as Jira last reported it. Read-only here by design. */
```

`line 194`

```text
/**
 * The mirrored issue behind a plan.
 *
 * Everything here is a cache of Jira, refreshed by the worker. It is served
 * from our own database, so the panel still renders when Jira is unreachable —
 * `syncError` is how it says so.
 */
```

`line 215`

```text
/** Someone Jira will accept as an assignee. Not one of our engineer records. */
```

`line 221`

```text
/** Whether Jira could be reached. Never carries the token. */
```

`line 227`

```text
/** Issues are invented. The panel must say so on screen. */
```

`line 229`

```text
/** Which JIRA_* variables are still blank. Names only, never values. */
```

`line 261`

```text
/**
 * One thing that happened on a project, from any of its environments.
 *
 * The backend flattens every environment's history into one stream so the
 * calendar does not have to fan out a request per environment and interleave
 * the results itself.
 */
```

`line 271`

```text
/** The day it took effect, which is what the agenda sorts by. */
```

`line 289`

```text
/** False when the cycle comes from the source but is not in our registry. */
```

`line 298`

```text
/** Records the version an environment now runs, and the change itself. */
```

`line 318`

```text
/** Creates a project, its environments and what each of them runs. */
```

`line 337`

```text
/**
   * Registers a catalogue product. Name, type, cycle rule and logo come from
   * the product; every published cycle is imported in the same call, so it is
   * deployable immediately.
   */
```

`line 353`

```text
/**
   * The whole endoflife.date catalogue, loaded once and filtered in the browser.
   *
   * A few hundred rows, so a request per keystroke would be wasteful — and the
   * list is the same for everyone, which makes it worth caching for the session.
   */
```

`line 365`

```text
/** Every recorded change across a project, newest first. Accepts id or code. */
```

`line 376`

```text
/** Recomputes the hash chain, so the UI can say whether it is intact. */
```

`line 387`

```text
/** Upgrade targets: versions newer than the one running, grouped by cycle. */
```

`line 396`

```text
/** Replaces who is staffed on a project, as the complete list. */
```

`line 407`

```text
// ---- upgrade actions ------------------------------------------------------
```

`line 423`

```text
/** Marks one environment done; the action completes once all of them are. */
```

`line 435`

```text
/** The mirrored Jira issue for a plan. Reads our cache, never Jira. */
```

`line 440`

```text
/** Points a plan at an issue that already exists. Fails if Jira cannot read it. */
```

`line 448`

```text
/** Pulls this plan's issue and sub-tasks from Jira now. */
```

`line 456`

```text
/** Forgets the link. The Jira issue itself is left alone. */
```

`line 463`

```text
/** Who Jira will let you assign this issue's children to. */
```

`line 470`

```text
/** Creates a step in Jira under the linked issue, and returns the mirror. */
```

`line 520`

```text
// The catalogue's "already registered" marks go stale on every add.
```

## frontend/src/app/core/auth.guard.ts

`line 5`

```text
/**
 * Keeps the signed-out off the app.
 *
 * A convenience, not a control: the API is what actually has to refuse an
 * unauthenticated request, and guarding routes in the browser only decides
 * what gets rendered.
 */
```

`line 20`

```text
// Remember where they were headed, so signing in lands them there rather
```

`line 21`

```text
// than dumping them on the overview.
```

`line 27`

```text
/** Sends an already-signed-in visitor away from the sign-in page. */
```

## frontend/src/app/core/celebration.service.ts

`line 4`

```text
/**
 * Every recorded version change is celebrated.
 *
 * The picture does not vary — recording a change is the job, and doing the job
 * gets the reward. What varies is the line underneath, which says what the
 * change actually bought: clearing the last risk in an environment reads
 * differently from a routine patch, even though both earn the same grin.
 */
```

`line 20`

```text
/** Long enough to register, short enough not to be in the way. */
```

`line 44`

```text
/** Reads the change and picks the line that fits it. */
```

`line 50`

```text
/** Where the component stood before the change. */
```

`line 52`

```text
/** Days until the version it moved onto goes end of life. */
```

`line 54`

```text
/** Statuses of everything else in the environment, to spot a clean sweep. */
```

`line 83`

```text
// Recorded and worth a grin, but the line stays honest: moving between two
```

`line 84`

```text
// unsupported versions has not fixed anything yet.
```

## frontend/src/app/core/diff.ts

`line 3`

```text
/**
 * Line diffing for environment revisions.
 *
 * Each environment is a JSON document, each save is a revision, and history is
 * read as a diff — the form DevOps already know from code review. Serialisation
 * is normalised first so a diff only ever shows real changes, never key order
 * or whitespace noise.
 */
```

`line 21`

```text
/** Deterministic serialisation: fixed key order, so diffs stay meaningful. */
```

`line 47`

```text
/**
 * Longest-common-subsequence line diff.
 *
 * O(n·m), which is irrelevant at a few hundred lines and keeps the output
 * minimal — a changed version string shows as one removal and one addition,
 * not a rewritten block.
 */
```

`line 100`

```text
/** Collapses long runs of unchanged lines, the way a code review does. */
```

`line 131`

```text
/** One token of a line, flagged when it differs from its counterpart. */
```

`line 144`

```text
/**
 * Word-level diff of two lines.
 *
 * A version bump changes a few characters in a long line; highlighting the
 * whole line hides which. This narrows the highlight to the tokens that
 * actually moved.
 */
```

`line 203`

```text
/**
 * Lays a line diff out as two columns, pairing each removed line with the
 * added line that replaced it so word highlighting has something to compare.
 */
```

`line 260`

```text
/** Drops long runs of untouched lines, leaving a few for context. */
```

`line 300`

```text
/**
 * The human summary of a revision: what actually changed in the estate, as
 * opposed to which lines moved. This is what feeds reporting later.
 */
```

`line 363`

```text
/** Numeric version comparison, so 6.0.9 sorts before 6.0.14. */
```

## frontend/src/app/core/lifecycle.ts

`line 1`

```text
/**
 * Lifecycle rules, kept in one place exactly as they are on the backend
 * (src/lifecycle). The notice horizon is policy, not data: it comes from
 * STATUS_APPROACHING_DAYS and is applied here, never frozen into a query.
 */
```

`line 45`

```text
/** Signed, with a true minus sign: −681 d. Never bare "681". */
```

`line 66`

```text
/** Text colour per status. Supported deliberately has no colour of its own. */
```

## frontend/src/app/core/models.ts

`line 1`

```text
/**
 * Mirrors the backend DTOs so the mock layer can be swapped for generated
 * types from /api/docs-json without reshaping any component.
 */
```

`line 23`

```text
/** A technology in the registry. Cycles hang off it. */
```

`line 29`

```text
/** endoflife.date slug; null for things it does not track. */
```

`line 32`

```text
/** Simple Icons slug and brand colour, resolved when it was registered. */
```

`line 38`

```text
/** One support cycle — where all lifecycle dates live (see db-design-notes). */
```

`line 61`

```text
/** A DevOps engineer. Projects are staffed, and staffing drives the inbox. */
```

`line 67`

```text
/** False for viewers, who can be shown but not staffed on work. */
```

`line 74`

```text
/**
 * One customer's Lime installation — the unit engineers actually work in.
 *
 * A customer may run more than one (a second brand, a separate region), so
 * this is deliberately not the same record as the customer.
 */
```

`line 85`

```text
/** Which Lime release this customer is on — differs per project. */
```

`line 107`

```text
/** One machine or service in an environment. */
```

`line 113`

```text
/** Position on the canvas, kept in the JSON so an arrangement survives. */
```

`line 125`

```text
/**
 * The editable unit: one customer environment as data.
 * This is what a DevOps engineer edits, either as JSON or on the canvas.
 */
```

`line 135`

```text
/**
 * One saved state of an environment — a commit.
 *
 * History is kept as full snapshots rather than deltas: a snapshot always
 * renders, can be diffed against any other revision, and answers "what was
 * running on this date?" without replaying anything.
 */
```

## frontend/src/app/core/motion.ts

`line 4`

```text
/**
 * Motion, used sparingly and on purpose.
 *
 * This is an operations tool, not a landing page: one orchestrated moment when
 * a screen arrives, and movement when data actually changes. Anything a CSS
 * transition can do is left to CSS — GSAP is here for the two things it
 * cannot: interpolating a number, and orchestrating a stagger.
 */
```

`line 14`

```text
/**
   * Whether movement is welcome, read fresh each time.
   *
   * This service is a singleton, so registering gsap.matchMedia contexts here
   * accumulated one per component instance and re-ran old animations against
   * elements that no longer existed. Checking the query directly keeps every
   * call self-contained.
   */
```

`line 26`

```text
/** Counts a number up to its value. */
```

`line 49`

```text
/** Reveals a set of elements in sequence — the one arrival moment. */
```

`line 70`

```text
/** Grows bars from their baseline when the underlying data changes. */
```

`line 83`

```text
// Transforms are cleared so nothing is left composited afterwards.
```

## frontend/src/app/core/registry.store.ts

`line 17`

```text
/** Everything, or one project. The switcher writes this. */
```

`line 48`

```text
/**
 * Application state.
 *
 * Reads come from the API and are held in linked signals, so the server is the
 * source of truth but the UI can still edit locally. Anything the API does not
 * serve yet — upgrade actions, environment revisions — lives in plain signals
 * and is clearly marked as unsaved in the screens that write it.
 */
```

`line 63`

```text
/** True while writes are not yet persisted anywhere. */
```

`line 66`

```text
// ---- server-derived state ------------------------------------------------
```

`line 137`

```text
/**
   * Everyone who could be staffed, from the accounts API.
   *
   * Previously read off the projects themselves, which meant the picker only
   * ever offered people who were already assigned — a closed loop in which
   * nobody new could be added to anything.
   */
```

`line 155`

```text
/**
   * Upgrade actions, from the API.
   *
   * The Plan screen owns the writes; this is the read every other screen uses
   * — the Overview inbox to say whether a deadline has a plan, the Calendar to
   * place it on the timeline.
   */
```

`line 168`

```text
// The derived one: OVERDUE and IN_PROGRESS are facts about progress,
```

`line 169`

```text
// not something anybody typed.
```

`line 182`

```text
// ---- client-only state (no API yet) --------------------------------------
```

`line 197`

```text
/** Deployments in scope — what every screen reads. */
```

`line 211`

```text
/** The API's own view of a project, for screens that want it whole. */
```

`line 317`

```text
// ---- writes (local until the write API lands) -----------------------------
```

`line 436`

```text
// ---- revision history (awaiting a write API) ------------------------------
```

`line 518`

```text
/** Short unique id for records created in the browser. */
```

## frontend/src/app/core/relative-time.ts

`line 3`

```text
/**
 * Human phrasing for lifecycle dates.
 *
 * "Ends in 1 week and 6 days" tells an engineer whether to act this sprint;
 * "2026-10-01" makes them do the arithmetic. Both are shown — the phrase to
 * judge by, the date to plan by.
 */
```

`line 15`

```text
/** Two-unit duration, as people actually say it. */
```

`line 47`

```text
/** "Ends in 1 year", "Ended 1 year and 5 months ago", or "—". */
```

`line 80`

```text
/** Cell tint per tone, matching the status palette used everywhere else. */
```

## frontend/src/app/core/session.ts

`line 19`

```text
/**
 * Who is signed in.
 *
 * Kept in localStorage so a refresh does not sign you out mid-change. That
 * puts the token where page scripts can read it, which is the accepted
 * trade-off for a first-party tool on an internal network — the alternative is
 * an httpOnly cookie, which needs CSRF handling the API does not have yet.
 */
```

`line 48`

```text
// Private browsing, or site data blocked. Signing out of this tab is
```

`line 49`

```text
// still the important half.
```

`line 58`

```text
// The session still works for this tab; it just will not survive a
```

`line 59`

```text
// refresh.
```

`line 64`

```text
/** Reads a stored session, ignoring one that has already expired. */
```

`line 84`

```text
/**
 * Sends the token on every request, and reacts when the API rejects it.
 *
 * Now that the whole API requires a token, an expired one turns every panel on
 * the page into a silent failure at once. Treating 401 as "you are signed out"
 * sends someone back to the login screen instead of leaving them looking at an
 * app that has quietly stopped loading anything.
 *
 * 403 is left alone: a viewer being refused a write is a working system
 * telling them something true, not a broken session.
 */
```

## frontend/src/app/core/theme.ts

`line 7`

```text
/**
 * Light or dark, remembered.
 *
 * Starts from the operating system's preference, so the first visit matches
 * what the person already chose for everything else; an explicit pick wins
 * from then on.
 */
```

`line 26`

```text
// Private browsing or blocked storage: the theme still applies for
```

`line 27`

```text
// this session, it just will not be remembered.
```

`line 44`

```text
// Fall through to the system preference.
```

## frontend/src/app/features/actions/actions.ts

`line 34`

```text
/**
 * The work half of the tool.
 *
 * Deadlines are facts; these are what the team does about them. Unlike a ticket
 * board, each one is checked against what the estate actually records — a plan
 * marked complete with no matching change is shown as such rather than taken at
 * its word.
 */
```

`line 94`

```text
<!-- Two zoom levels on the same data: the board to work from, the list to
         scan when there are more plans than fit in four columns. -->
```

`line 139`

```text
<!-- create / edit -->
```

`line 262`

```text
/**
   * Bound from ?technology= and ?cycle=, so "Plan upgrade" on the Overview
   * opens this form already filled in.
   */
```

`line 278`

```text
// Read and write the draft untracked. As a dependency, this effect
```

`line 279`

```text
// reopened the form the moment it was closed.
```

`line 461`

```text
/**
   * Closes the form and drops the query params that opened it, so returning to
   * the same cycle from the Overview opens it again.
   */
```

## frontend/src/app/features/auth/auth-layout.ts

`line 12`

```text
/**
 * The frame both auth pages sit in.
 *
 * Two halves: what the tool is for on the left, the form on the right. The left
 * half is decoration on a phone and is dropped there rather than stacked, so the
 * form is the first thing on screen at every width.
 */
```

`line 25`

```text
<!-- brand half -->
```

`line 30`

```text
<!-- the lime in the mark, bled into the corner -->
```

`line 64`

```text
<!-- Bled past the panel padding so the logos run edge to edge and read
             as a passing stream rather than a boxed-in list. -->
```

`line 82`

```text
<!-- form half -->
```

`line 84`

```text
<!-- No theme switch here: these two pages are dark either way, and a
             control that appears to do nothing is worse than none. -->
```

`line 148`

```text
// kill(), not revert(): reverting a .from() would leave the panel invisible.
```

`line 152`

```text
/**
   * Deliberately fixed, not live figures.
   *
   * This page is shown to someone who is not signed in; reading real counts out
   * of the estate here would leak how many customers there are and what is
   * failing, to anyone who loads the URL.
   */
```

## frontend/src/app/features/auth/login.ts

`line 7`

```text
/**
 * Sign in.
 *
 * The form and its validation only; there is no auth API yet, so submitting a
 * valid form goes straight to the overview. Everything the server will need is
 * already gathered here, so wiring it up later is one call in `submit`.
 */
```

`line 103`

```text
/** Where to go after signing in, set by the guard that sent them here. */
```

`line 125`

```text
// Errors appear once the field has been left or the form pushed, never while
```

`line 126`

```text
// the first character is still being typed.
```

## frontend/src/app/features/auth/sign-up.ts

`line 6`

```text
/** Length is what makes a passphrase hard, so that is what the meter measures. */
```

`line 74`

```text
<!-- Four segments rather than a word: it shows progress while typing
               without pretending to score the password precisely. -->
```

`line 106`

```text
<!-- Accounts are issued by an administrator, not self-service: this
             tool records who changed a customer's production estate, and an
             account anyone could create would make that record worthless. -->
```

`line 159`

```text
/** 0–4, driven mostly by length with a nudge for variety. */
```

`line 226`

```text
// Deliberately not wired to the API. The form validates so it is ready for
```

`line 227`

```text
// the day registration is opened up, but it cannot create an account today.
```

## frontend/src/app/features/auth/tech-marquee.ts

`line 3`

```text
/**
 * Logos of things the registry tracks, sliding past.
 *
 * Hardcoded rather than read from the API: this sits on a page nobody has
 * signed in to yet, and the estate's real contents are not public. These are
 * simply well-known products endoflife.date publishes.
 *
 * CSS rather than GSAP. A marquee is one constant linear translation with no
 * timeline to orchestrate, so keyframes run it on the compositor and cost
 * nothing per frame; a JS ticker here would be more code doing less well.
 */
```

`line 45`

```text
<!-- The list is rendered twice and the track slides exactly half its
           width, so the second copy lands where the first began and the loop
           has no seam. -->
```

`line 126`

```text
/** Which row of logos, and which way it travels. */
```

`line 130`

```text
/** The row twice over, which is what makes the loop seamless. */
```

## frontend/src/app/features/calendar/calendar.ts

`line 41`

```text
/**
 * Calendar, as an agenda.
 *
 * A month grid is built for dense daily events; lifecycle work is a handful a
 * year, so a grid would be mostly empty cells. This lists only months that
 * contain something and names the quiet stretches between them — an empty
 * quarter is information, not blank space.
 */
```

`line 84`

```text
<!-- One definition, used above a month heading, between two rows, or at the
         end — so the line looks identical wherever now happens to fall. -->
```

`line 104`

```text
<!-- Today belongs above the heading when the month's own first entry is
             what comes next: under it, the line reads as though today fell in
             that month. -->
```

`line 111`

```text
<!-- month heading, with a rule running to the count -->
```

`line 125`

```text
<!-- $first is already handled above the heading. -->
```

`line 208`

```text
// Projects arrive asynchronously and the scope switcher can change which
```

`line 209`

```text
// ones are in view, so the fetch is reactive rather than a one-shot in the
```

`line 210`

```text
// constructor — which would run before any project id existed.
```

`line 222`

```text
// One call per project in scope — usually one, since engineers work
```

`line 223`

```text
// inside a single customer installation.
```

`line 238`

```text
/** Everything, from three sources, on one timeline. */
```

`line 243`

```text
// what has already been done
```

`line 271`

```text
// what is planned
```

`line 292`

```text
// what is coming whether we like it or not
```

`line 330`

```text
/**
   * The entry the "today" line sits above — the first thing not yet behind us.
   *
   * Null when everything in view has already happened, in which case the line
   * is drawn after the last group instead, so the reader is never left
   * wondering which side of now they are on.
   */
```

`line 346`

```text
/** Grouped by month. Months with nothing in them are simply not listed. */
```

## frontend/src/app/features/environments/add-component.ts

`line 10`

```text
/**
 * Add a technology this environment was not known to run.
 *
 * Deliberately the same write as an upgrade — one endpoint, one history chain —
 * so a component that appears later in an environment's life is as traceable as
 * one recorded on day one. The only difference is that there is no "from"
 * version, which the backend records as an INSTALL.
 */
```

`line 163`

```text
/** A first record is rarely an upgrade, so that is not the default here. */
```

`line 171`

```text
/** Who the entry will be attributed to: the signed-in account. */
```

`line 187`

```text
/** Only what is not already recorded here — the rest is an upgrade, not an add. */
```

`line 201`

```text
// Versions are fetched per technology, and no currentVersion is passed:
```

`line 202`

```text
// there is nothing installed to be newer than, so the whole published
```

`line 203`

```text
// history is fair game — including a deliberately older version.
```

`line 279`

```text
/** Runs the callback once the goose has had its full time on screen. */
```

`line 289`

```text
/** Says what committing to this cycle actually buys you. */
```

## frontend/src/app/features/environments/environments.ts

`line 17`

```text
/**
 * Environments.
 *
 * One card per technology rather than per server: engineers think in "what
 * version of MongoDB is this customer on", and the answer should be readable
 * without opening anything. The card's top edge carries its support status,
 * so a wall of cards reads as a risk summary at a glance.
 */
```

`line 70`

```text
<!-- environment tabs -->
```

`line 160`

```text
<!-- one card per technology -->
```

`line 224`

```text
<!-- The same action as the header button, where the eye already
                   is after reading the stack. -->
```

`line 269`

```text
/** Respects the project switcher: one project, or all of them. */
```

`line 288`

```text
// Default to production: the environment that matters most.
```

`line 297`

```text
// ---- components / history ------------------------------------------------
```

`line 308`

```text
/** History is fetched only when asked for — most visits never open it. */
```

## frontend/src/app/features/environments/history.ts

`line 14`

```text
/**
 * Revision history for one environment.
 *
 * Commits on the left, a side-by-side diff on the right, with the exact tokens
 * that changed highlighted inside the line. A version bump should read as
 * "8.2.12 became 8.3.11", not as two rewritten lines.
 */
```

`line 26`

```text
<!-- commits -->
```

`line 57`

```text
<!-- diff -->
```

`line 109`

```text
<!-- before -->
```

`line 121`

```text
<!-- after -->
```

## frontend/src/app/features/environments/update-component.ts

`line 19`

```text
/**
 * Record the version an environment now runs.
 *
 * Two fields do the real work: the version, and the date it actually happened.
 * Engineers record upgrades days after the window, and a history dated by when
 * the paperwork caught up is worthless for reporting.
 */
```

`line 144`

```text
<!-- the last few, as context while recording. The full trail lives on
             the environment, where it has room to grow. -->
```

`line 195`

```text
/** Who the entry will be attributed to: the signed-in account. */
```

`line 213`

```text
/** Only this technology's changes, newest first. */
```

`line 258`

```text
// The write is already done; this only holds the modal open so the
```

`line 259`

```text
// goose is on screen long enough to be seen. Against a warm cache the
```

`line 260`

```text
// server answers in about 20ms, which would be a flicker.
```

`line 282`

```text
/** Runs the callback once the goose has had its full time on screen. */
```

`line 292`

```text
/**
   * What this change earned, worked out before the reload lands.
   *
   * Everything needed is already on screen: where the component stood, which
   * cycle the new version belongs to, and how the rest of the environment is
   * doing — so there is no second request just to decide whether to cheer.
   */
```

`line 334`

```text
/** Security patches and rollbacks should stand out in a long list. */
```

`line 349`

```text
/** Says what moving to this cycle actually buys you. */
```

## frontend/src/app/features/lifecycle/lifecycle-page.ts

`line 5`

```text
/**
 * Lifecycle — when support ends.
 *
 * Two views of the same question: the timeline of what we run, and the
 * registry of what we track. They were separate tabs; they belong together,
 * because you look one up to understand the other.
 */
```

## frontend/src/app/features/notifications/notification-preview.ts

`line 7`

```text
/** The notice thresholds, as seeded in notification_rule. */
```

`line 14`

```text
/** The Teams sign-in address. A display name alone cannot be mentioned. */
```

`line 27`

```text
/** Red past end of life, amber inside the notice window. */
```

`line 34`

```text
/** Deep links rendered as card actions. */
```

`line 39`

```text
/**
 * What the 08:00 run would send, worked out from the data already on screen.
 *
 * Deliberately computed in the browser: this is a preview, and it must not
 * depend on a notification service that does not exist yet. When the service
 * lands it becomes the same calculation server-side, and this page becomes a
 * window onto it rather than its own implementation.
 */
```

`line 52`

```text
/**
   * Which notice a cycle currently falls under.
   *
   * A real run fires on the day a threshold is crossed and then stays quiet.
   * A preview cannot know what was already sent, so it shows the band each
   * cycle sits in today — which is what the next run would announce for
   * anything not yet notified.
   */
```

`line 131`

```text
// Most urgent first, which is also the order they would be sent in.
```

`line 135`

```text
/** Grouped by threshold, because that is how the rules are configured. */
```

`line 147`

```text
/**
   * Who gets pinged.
   *
   * The assignee when there is a plan, the project lead when there is not —
   * someone has to own the gap. Never the whole team: six mentions on twenty
   * cards is how a channel gets muted.
   */
```

`line 171`

```text
// The API does not return engineer emails on the project payload yet, so
```

`line 172`

```text
// this resolves through the accounts list.
```

`line 196`

```text
// One action. Ticket links arrive when Jira does.
```

`line 205`

```text
/** The exact Adaptive Card body a run would POST. */
```

## frontend/src/app/features/overview/overview.ts

`line 39`

```text
/**
 * Overview.
 *
 * Three questions, one per panel, and deliberately not the same question
 * twice: when support ends, which customers carry the risk, and what needs a
 * decision today.
 */
```

`line 51`

```text
<!-- headline -->
```

`line 132`

```text
<!-- needs you: the one panel that asks for a decision -->
```

`line 192`

```text
<!-- panels: equal columns, each header / body / footer -->
```

`line 194`

```text
<!-- 1. when support ends -->
```

`line 202`

```text
<!-- y axis -->
```

`line 240`

```text
<!-- 2. who carries it -->
```

`line 297`

```text
<!-- 3. are we gaining or losing ground -->
```

`line 365`

```text
// Re-grow the columns whenever the horizon changes: the movement is the
```

`line 366`

```text
// feedback that the chart responded.
```

`line 436`

```text
/**
   * One column per month, plus a leading bucket for everything already past
   * end of life — otherwise the most urgent work is the one thing the chart
   * cannot show.
   */
```

`line 505`

```text
/** Which customers actually carry the risk — the panel that replaced a heatmap. */
```

`line 524`

```text
/**
   * The things asking for a decision, stated as consequences.
   *
   * "Unsupported for 7 years" lands where "−2588 d" does not: the number is
   * precise but says nothing about whether to care. The signed day count still
   * exists on the Schedule for people doing arithmetic.
   */
```

`line 562`

```text
/**
   * Upgrades completed against cycles that expired, month by month.
   *
   * The honest measure of whether the team is gaining ground: doing three
   * upgrades in a quarter means nothing if five cycles went out of support in
   * the same period. Upgrades come from the revision history, so this counts
   * what was actually recorded, not what was planned.
   */
```

`line 625`

```text
/** Raw counts behind the bars, kept separate so totals stay readable. */
```

## frontend/src/app/features/projects/projects.ts

`line 10`

```text
/** Lime releases offered when creating or editing a project. */
```

`line 15`

```text
/**
 * Projects.
 *
 * One row per customer installation, with the Lime release it runs, who is
 * staffed on it and how much of its stack is out of support. Built as a
 * searchable, filterable list rather than a card wall, because the number of
 * projects grows with sales.
 */
```

`line 42`

```text
<!-- add project -->
```

`line 177`

```text
<!-- what every environment starts with -->
```

`line 243`

```text
<!-- filters -->
```

`line 269`

```text
<!-- list -->
```

`line 356`

```text
<!-- the selected project's environments and their technologies -->
```

`line 359`

```text
<!-- manage: edit, environments, delete -->
```

`line 522`

```text
/** Versions already known for a technology, offered as suggestions. */
```

`line 571`

```text
// ---- manage an existing project -----------------------------------------
```

`line 623`

```text
/**
   * Staffing is saved to the database; the rest is still local.
   *
   * Name, Lime version and status have no update endpoint yet, so they are held
   * in the browser as before. Who is assigned does persist — it decides whose
   * name appears against a customer's environments, which is not something to
   * lose on refresh.
   */
```

`line 715`

```text
// Pull the server's copy and focus the new project.
```

`line 731`

```text
/** Selecting a project scopes the whole app to it. */
```

## frontend/src/app/features/registry/registry.ts

`line 39`

```text
/**
 * Registry.
 *
 * The reference data everything else hangs off: what technologies we track,
 * the cycles under them — including ones endoflife.date does not publish, so
 * internal components can be tracked the same way — and who is on the team.
 */
```

`line 69`

```text
<!-- technologies -->
```

`line 164`

```text
<!-- team: real accounts, not editable here -->
```

`line 204`

```text
<!-- catalogue picker: the only way a technology enters the registry -->
```

`line 212`

```text
<!-- confirm what was picked, with everything already filled in -->
```

`line 346`

```text
<!-- technology form: editing only; adding goes through the catalogue -->
```

`line 401`

```text
<!-- cycle form -->
```

`line 502`

```text
// ---- catalogue -----------------------------------------------------------
```

`line 516`

```text
/**
   * Matching products, narrowed as you type.
   *
   * Filtered here rather than server-side: the catalogue is a few hundred rows
   * loaded once, so a request per keystroke would buy nothing. Already-added
   * products stay in the list, shown as added, so it is clear they exist.
   */
```

`line 554`

```text
/** Fills the confirm step from the product, so nothing has to be restated. */
```

`line 575`

```text
// Cycles are what make it deployable; say so if none arrived.
```

`line 595`

```text
/** Editing is still local: the registry has no update endpoint yet. */
```

## frontend/src/app/features/schedule/schedule.ts

`line 16`

```text
/** endoflife.date product slugs for the technologies in the registry. */
```

`line 48`

```text
/**
 * The schedule: one row per cycle in use, each ending on its EOL date.
 *
 * Position carries urgency before colour does — anything left of the today
 * rule is already out of support. The dashed rule is the notice horizon
 * (STATUS_APPROACHING_DAYS); a bar ending before it is what "EOL near" means.
 */
```

`line 183`

```text
<!-- month gridlines and year labels -->
```

`line 197`

```text
<!-- the notice horizon: bars ending left of this are "EOL near" -->
```

`line 206`

```text
<!-- today -->
```

`line 334`

```text
/** 'estate' for the cross-customer timeline, otherwise a technology name. */
```

`line 337`

```text
/**
   * Bound from ?status= by withComponentInputBinding, so the Overview's status
   * bands link straight into a filtered schedule and the filter survives a
   * refresh or a shared URL.
   */
```

`line 354`

```text
/** Technologies in the registry, worst first, with a count of risky cycles. */
```

## frontend/src/app/features/schedule/technology-view.ts

`line 12`

```text
/** Shape returned by GET /api/v1/eol/products/:slug. */
```

`line 38`

```text
/**
 * Every release cycle of one technology, in the shape the team already reads
 * on endoflife.date — a support-phase chart over a date axis, then the release
 * table.
 *
 * What this adds over the public site: the rows we actually run are marked,
 * with how many environments are on them, so a support window turns into our
 * problem rather than a fact about the world.
 */
```

`line 81`

```text
<!-- support phases -->
```

`line 157`

```text
<!-- release table -->
```

`line 237`

```text
/** Live call to our own API, which proxies and caches endoflife.date. */
```

`line 244`

```text
/** Versions of this technology actually deployed, by cycle. */
```

`line 283`

```text
/** Unmaintained releases are folded away unless asked for, or in use. */
```

`line 294`

```text
// ---- chart geometry ------------------------------------------------------
```

## frontend/src/app/shared/celebrate.ts

`line 11`

```text
/** Brand colours only, so a burst still looks like the product. */
```

`line 20`

```text
/**
 * The reward for recording a change.
 *
 * Mounted once in the shell and driven by a signal, so any screen can set one
 * off without owning the animation. Never blocks: pointer events pass straight
 * through, and it leaves on its own, so there is nothing to dismiss.
 */
```

`line 80`

```text
// Springs up rather than fading in: this is the one moment in the tool
```

`line 81`

```text
// that is allowed to be pleased with itself.
```

`line 104`

```text
/**
   * A burst of brand-coloured squares, built and torn down in place.
   *
   * Hand-rolled rather than pulled from a library: it is forty divs and one
   * tween, and a dependency for that would outweigh it.
   */
```

`line 137`

```text
// Removed on completion; leaving forty absolutely positioned nodes behind
```

`line 138`

```text
// on every upgrade would accumulate for the life of the session.
```

## frontend/src/app/shared/change-timeline.ts

`line 23`

```text
/**
 * Version history as a timeline.
 *
 * Entries thread onto one line so the eye follows the sequence rather than
 * reading a table row by row, and the dot's colour says why each change
 * happened before any of the text is read.
 */
```

`line 36`

```text
<!-- the thread -->
```

## frontend/src/app/shared/jira-panel.ts

`line 10`

```text
/**
 * The work behind a plan, as Jira holds it.
 *
 * Deliberately read-only. Jira owns task breakdown — sub-tasks, worklogs,
 * permissions, an audit trail — and a second place to edit the same work would
 * only split the team's attention and go stale. Every row here opens Jira.
 *
 * What it shows is a mirror served from our own database, refreshed by the
 * worker. That is why it still renders when Jira is unreachable: the panel says
 * when it last synced and what went wrong, rather than showing nothing.
 */
```

`line 27`

```text
<!-- Invented issues always announce themselves. Nobody looking at this
           screen, or a screenshot of it, should have to wonder. -->
```

`line 41`

```text
<!-- the issue -->
```

`line 107`

```text
<!-- the breakdown, exactly as Jira has it -->
```

`line 145`

```text
<!-- Add a step. Creates it in Jira; everything after that is Jira's. -->
```

`line 186`

```text
<!-- not linked -->
```

`line 219`

```text
<!-- So that setting Jira up later is a checklist, not guesswork. -->
```

`line 251`

```text
/** Whether linking is even possible, from the integration status endpoint. */
```

`line 260`

```text
/** Drives the badge. Issues must never be invented without the panel saying so. */
```

`line 292`

```text
/** Jira's account list. Ours cannot be used — different identity system. */
```

`line 359`

```text
// Assignable users are per issue, so a freshly linked issue needs its
```

`line 360`

```text
// own list rather than whatever the last one had.
```

`line 375`

```text
/** Coloured by Jira's category, not its status name, which varies per project. */
```

`line 393`

```text
/** "synced 4 min ago" — how stale the mirror is, which the panel must admit. */
```

## frontend/src/app/shared/modal.ts

`line 12`

```text
/**
 * Dialog used by every create/edit form, so they behave identically:
 * Escape closes, the backdrop closes, the panel does not, and the heading is
 * announced.
 */
```

`line 62`

```text
/** Wider than the default for content that needs two columns. */
```

`line 70`

```text
/**
   * The sheet springs up rather than appearing, which is what makes a dialog
   * feel like it came from somewhere.
   *
   * Only the panel moves. Animating the blurred backdrop as well meant
   * compositing a full-screen blur on every frame, and an interrupted tween
   * could leave it stuck at opacity 0 — an invisible layer still swallowing
   * clicks, which is exactly how a close button appears to "not work".
   */
```

`line 97`

```text
// kill(), not revert(): reverting a .from() would restore its start state,
```

`line 98`

```text
// leaving the panel invisible on the way out.
```

## frontend/src/app/shared/notification-menu.ts

`line 13`

```text
/**
 * The bell, and what it drops down.
 *
 * A log of what this tool actually announced — read from the API, not from a
 * fixture. Follows the pattern every web tool has settled on: newest first,
 * unread in bold, relative times for recent entries and absolute ones for
 * older, a count meaning "new since you last looked", and one place to clear
 * it.
 *
 * The channel status stays pinned in the panel rather than a settings screen:
 * a drawer should not be the only place something important is said, and
 * "not connected" is important.
 */
```

`line 76`

```text
<!-- real state, from /notifications/status -->
```

`line 146`

```text
// Newest first, which is what everyone expects and what makes the count
```

`line 147`

```text
// mean anything.
```

`line 161`

```text
/** A failed send turns the badge red: it is not just new, it is wrong. */
```

`line 166`

```text
/**
   * Whether anything can actually get out, in the order that matters.
   *
   * A failed send is reported ahead of configuration, because a channel that
   * was working and stopped is more urgent than one never set up.
   */
```

`line 226`

```text
// Reopened after a run, the panel should show it.
```

`line 239`

```text
// Site data blocked. Cleared for this tab, back next reload — better
```

`line 240`

```text
// than refusing to clear at all.
```

`line 253`

```text
/** Relative while it is recent, absolute once it stops being "ago". */
```

## frontend/src/app/shared/plan-board.ts

`line 12`

```text
/** Nothing can be moved into this one. */
```

`line 34`

```text
/**
 * Every plan on one board, along its own lifecycle rather than Jira's.
 *
 * The columns are deliberately not Jira statuses. Copying Jira's board would
 * leave no honest answer to "why not just open Jira?" — these four stages are
 * ours, and only this registry can put a card in the last one.
 *
 * Verified is locked. Nothing drags into it and no button puts it there: a
 * plan arrives once every environment it covers has a recorded version change
 * behind it. That rule is the reason this tool exists beside a ticket board,
 * so it is expressed as an interaction rather than a paragraph.
 */
```

`line 77`

```text
<!-- Tags carry identity, never status, so they stay neutral. -->
```

`line 105`

```text
<!-- Where the estate actually is: one dot per environment. -->
```

`line 186`

```text
// Most urgent first within a column; anything without a date sinks.
```

`line 210`

```text
/**
   * Jira progress, or nothing.
   *
   * Absent rather than zero when no issue is linked: an empty bar reads as
   * "no progress", which is a different claim from "nobody has broken this
   * down yet".
   */
```

`line 254`

```text
/**
 * Which column a plan belongs in.
 *
 * Read in order: evidence beats a tick, a tick beats a ticket, and a ticket
 * beats an intention.
 */
```

## frontend/src/app/shared/plan-card.ts

`line 7`

```text
/**
 * One planned upgrade.
 *
 * Built to four rules, in this order:
 *
 * 1. The deadline is the headline. This registry exists because support runs
 *    out; on the previous card that fact was a grey fragment wedged between
 *    the Jira key and the assignee, and for in-house products with no
 *    published date it did not appear at all.
 * 2. Typography carries the hierarchy, not boxes. The old card wrapped
 *    everything in bordered pills, which gave a status, a day count and three
 *    environments the same visual weight as each other.
 * 3. Colour means status and nothing else. A rail, a day count and three
 *    evidence dots are the only coloured things here, so they actually read.
 * 4. A field earns its place only if it changes a decision.
 *
 * The three bands follow status, then movement, then owners and links — the
 * order someone reads them in when deciding whether this needs attention.
 */
```

`line 32`

```text
<!-- Urgency, before a single word is read. -->
```

`line 39`

```text
<!-- ── what, whose, and by when ─────────────────────────────── -->
```

`line 56`

```text
<!-- The deadline, sized like it matters. -->
```

`line 77`

```text
<!-- ── what actually happened ───────────────────────────────── -->
```

`line 123`

```text
<!-- ── the work, in Jira ────────────────────────────────────── -->
```

`line 126`

```text
<!-- ── who owns it, and what you can do ─────────────────────── -->
```

`line 135`

```text
<!-- Only the states the rest of the card cannot already show. -->
```

`line 162`

```text
/** Which installations this touches — the thing the old card never said. */
```

`line 176`

```text
/** The number, in the largest type on the card. */
```

`line 180`

```text
// In-house products have no published date. Saying so is better than a
```

`line 181`

```text
// dash, which reads as missing data rather than a property of the thing.
```

`line 197`

```text
/**
   * The derived status, but only when it says something the card does not.
   *
   * The day count already conveys overdue and the Jira strip conveys progress,
   * so repeating those would be decoration. Completed and deferred are states
   * nothing else here expresses.
   */
```

`line 221`

```text
/** Green only for a change the estate actually confirms. */
```

## frontend/src/app/shared/plan-detail.ts

`line 7`

```text
/**
 * One plan, opened from the board.
 *
 * Laid out as plan against reality, because the gap between them is the only
 * thing here Jira could not tell you. Everything below that divider is the
 * Jira panel unchanged — the same list, the same add form.
 *
 * Note what it ends with rather than contains: comments and attachments are a
 * link to Jira, not a thread and an uploader. Rebuilding those would recreate
 * the parallel task system this replaced, and there is nowhere to put a file.
 */
```

`line 29`

```text
<!-- how far the work has got, as Jira reports it -->
```

`line 119`

```text
<!-- the work itself, mirrored from Jira, with the add form -->
```

`line 161`

```text
/** Null when nothing is linked — an empty bar would claim no progress. */
```

## frontend/src/app/shared/plan-timeline.ts

`line 5`

```text
/** Position across the ribbon, 0–100. */
```

`line 9`

```text
/** A target that lands after its own end of life. */
```

`line 20`

```text
/**
 * Every plan on one date axis.
 *
 * This is the view a ticket board cannot give you, because Jira does not know
 * when support ends. Two marks per plan — the date it is meant to land, and
 * the date its support runs out — so "will we make it" is answered by
 * position rather than by reading two fields and subtracting.
 *
 * A target sitting to the right of its own end-of-life mark is drawn in the
 * overdue colour. That is `planTooLate` as geometry.
 */
```

`line 37`

```text
<!-- month ticks -->
```

`line 54`

```text
<!-- today -->
```

`line 68`

```text
<!-- one mark per date that matters -->
```

`line 92`

```text
/** Every date on the axis, so the range covers all of them and today. */
```

`line 111`

```text
// A single date would give a zero-width axis; give it a season either way.
```

`line 152`

```text
/** A month tick wherever one starts inside the range, thinned if crowded. */
```

`line 175`

```text
// Beyond about a year the labels collide, so show every other one.
```

## frontend/src/app/shared/shader-background.ts

`line 13`

```text
/**
 * Flowing colour behind the whole app.
 *
 * One fullscreen triangle and one fragment shader, drawn by OGL — about 12 KB,
 * against ~150 KB for Three.js, which would be a lot of library for a single
 * quad.
 *
 * Deliberately slow and low-contrast. This sits behind live data that someone
 * reads all day, so it has to be atmosphere rather than something the eye keeps
 * returning to.
 */
```

`line 24`

```text
/* glsl */
```

`line 35`

```text
/* glsl */
```

`line 124`

```text
/** Brand palette per theme, as the shader wants it: 0-1 linear-ish RGB. */
```

`line 134`

```text
// A whiter ground than the theme's own, so the green has something to read
```

`line 135`

```text
// against rather than a grey that swallows it.
```

`line 137`

```text
// Darker than the flow's dark-theme counterparts, not lighter. A pale
```

`line 138`

```text
// green on a near-white ground has almost no contrast to spend; these are
```

`line 139`

```text
// close to the light theme's own accent and lime tokens.
```

`line 143`

```text
// Much higher than the dark theme's: the light background is only visible
```

`line 144`

```text
// in the gutters at the rim, so the flow has to survive out there.
```

`line 165`

```text
// Follows the theme switch. Read once at startup, the canvas stayed navy
```

`line 166`

```text
// behind a light interface — the background and the cards disagreeing about
```

`line 167`

```text
// which theme was on.
```

`line 208`

```text
// Half resolution. The image is all soft gradients, so nobody can tell,
```

`line 209`

```text
// and it quarters the work on a high-DPI screen.
```

`line 213`

```text
// No WebGL — a locked-down machine, or a browser with it disabled. The
```

`line 214`

```text
// app keeps its flat token background and nothing else changes.
```

`line 245`

```text
// One frame, then nothing: a still image rather than a blank rectangle.
```

`line 260`

```text
// Releases the GL context rather than waiting for the browser to collect
```

`line 261`

```text
// it; they are a limited resource and leaking one breaks the next canvas.
```

`line 265`

```text
/** Runs only while the tab is visible, so a background tab costs nothing. */
```

`line 303`

```text
// Redrawn immediately so a resize is not a frame of stale image.
```

## frontend/src/app/shared/tech-icon.ts

`line 4`

```text
/** Tint per component type, so a technology with no logo still reads as itself. */
```

`line 17`

```text
/**
 * The real logo of a technology.
 *
 * The mark comes from the registry, which resolved it against Simple Icons when
 * the technology was registered — so every one of the 477 products
 * endoflife.date publishes can carry its own logo rather than only the handful
 * that were once hardcoded here.
 *
 * Simple Icons carries about two thirds of that catalogue. The rest fall back
 * to a lettered tile tinted by component type: deliberate, consistent, and
 * never a broken image.
 */
```

`line 34`

```text
<!-- Our own product carries our own mark; Simple Icons has no entry for
           it, and a lettered "L" tile for the thing we sell reads as an
           oversight.

           The symbol, not the full wordmark: at 2.27:1 the logo fits a square
           slot by height, rendering under half as tall as the square brand
           logos beside it. -->
```

`line 79`

```text
/**
   * Overrides the registry lookup, for a product that is not registered yet —
   * the catalogue picker draws rows the registry has never heard of.
   */
```

## frontend/src/app/shared/working.ts

`line 3`

```text
/**
 * How long the goose stays up, whatever the server does.
 *
 * A save against a warm cache finishes in about 20ms, and something that
 * appears and vanishes that fast reads as a glitch rather than feedback. The
 * caller holds its modal open for at least this long so the panel is actually
 * seen — see `update-component.ts`.
 */
```

`line 13`

```text
/** Shown while a change is being written. */
```

## frontend/src/app/shell.ts

`line 11`

```text
/**
 * The signed-in chrome: brand, project switcher, sections, theme, identity.
 *
 * A layout route rather than the root component, so the sign-in and sign-up
 * pages can own the whole window instead of appearing inside a navigation bar
 * that leads nowhere until you have an account.
 *
 * The project switcher is the most-used control here: engineers work inside
 * one customer installation at a time, and picking one scopes every screen.
 */
```

`line 26`

```text
<!-- Deferred until the browser is idle: this is decoration, and OGL should
         not sit in the critical path of showing someone what is expiring. The
         ground colour is already on <html>, so there is nothing to see arrive. -->
```

`line 46`

```text
<!-- project switcher -->
```

`line 130`

```text
<!-- light / dark -->
```

`line 141`

```text
<!-- sun -->
```

`line 147`

```text
<!-- moon -->
```

`line 154`

```text
<!-- who is signed in: every recorded change is attributed to them -->
```

`line 186`

```text
<!-- mounted once, fired from anywhere -->
```

## frontend/src/styles.css

`line 3`

```text
/* ---------------------------------------------------------------------------
   Lime Lifecycle — dark product theme.

   Every screen reads from these tokens, so the palette is the skin: changing
   the values here re-skins the whole app without touching a component.

   Urgency is still carried by position on the time axis and by a signed day
   count (−681 d) before colour does any work, so the theme stays readable
   without colour vision.
--------------------------------------------------------------------------- */
```

`line 14`

```text
/* Surfaces: the navy of the Lime wordmark, deepened into a ground.
     Not a neutral near-black — the whole app should feel like the logo. */
```

`line 21`

```text
/* text */
```

`line 26`

```text
/* Brand: the teal→lime gradient of the mark, split into roles. */
```

`line 33`

```text
/* Status. Warm hues only, so nothing competes with the brand teal/lime —
     except "good", which *is* the brand lime: healthy things look like Lime. */
```

`line 39`

```text
/* The platform's own UI face first — SF on Apple, Segoe on Windows — which
     is most of where the iOS feel comes from. Plex Mono stays for figures,
     because tabular alignment is a job, not a style. */
```

`line 56`

```text
/* ---------------------------------------------------------------------------
   Light theme.

   Same brand, inverted: the wordmark navy becomes the ink it was drawn as, and
   the teal and lime are darkened enough to stay readable on white — the values
   that glow on navy are far too pale here.
--------------------------------------------------------------------------- */
```

`line 66`

```text
/* Softened deliberately: pure white surfaces on a near-white ground glare
     over a long session. The cards sit just off white, on a ground with
     enough depth that they still read as raised. */
```

`line 89`

```text
/* The logo's wordmark is navy: it needs a light plate on the dark theme and
   none at all on the light one. */
```

`line 102`

```text
/* ---------------------------------------------------------------------------
   Sign in and sign up are dark in both themes.

   They are the product's front door and the only screen that is all brand: the
   teal-to-navy gradient and the white logo plate are the mark itself, and there
   is no washed-out version of them worth showing. Re-declaring the dark tokens
   on this scope means every utility inside resolves to them, whatever the root
   theme is set to.
--------------------------------------------------------------------------- */
```

`line 137`

```text
/* The navy wordmark needs its plate back, which the light theme takes away. */
```

`line 159`

```text
/* The ground colour lives on html so the shader canvas, which sits behind
     the page at -z-10, is not painted over. It also means the correct colour
     is already there before WebGL starts, and stays if it never does. */
```

`line 170`

```text
/* Tailwind v4's reset does not restore the pointer cursor on buttons, and the
   browser default for <button> is the plain arrow — so without this nothing
   clickable looks clickable. */
```

`line 181`

```text
/* Figures that must align down a column: day counts, versions, dates. */
```

`line 187`

```text
/* Lensed glass.

   Four inset highlights on opposing diagonal edges, an inner core shade and an
   outer drop — the bevel stack that makes an edge look ground rather than
   drawn. Paired with the sheen on ::after below.

   Three parts of the usual recipe are deliberately left out. `filter:
   contrast(3)` on a wrapper would crush every colour inside it, and these cards
   carry red and amber that mean "past end of life"; `backdrop-filter` per card
   is the blur-per-frame that made this app stutter; and blurred ::before/::after
   caustics would add two more blurred layers to each of the twenty-odd cards on
   a screen. The bevel and the sheen are pure box-shadow and gradient, so they
   cost nothing and carry most of the look. */
```

`line 237`

```text
/* Overlay panels are opaque, not glass.

   Translucency works over the shader, which is a soft gradient with nothing to
   read. Over live content it is just unreadable — the text behind shows
   through the text in front. There are only ever one or two of these on screen,
   so unlike cards they can afford a real backdrop blur, which is what keeps
   them feeling like the same material. */
```

`line 245`

```text
/* Fully opaque, and a step lighter than the cards behind it. At 97% the
     three per cent still showed through on the dark theme, and because the
     panel was the same navy as the cards there was no edge either — it read as
     glass laid over text. An overlay has to win against whatever it covers. */
```

`line 264`

```text
/* No diagonal glare on an overlay: it lands across the content rather than an
   empty pane, which is exactly what made the small buttons wash out. */
```

`line 270`

```text
/* Scrolls, without the bar. The content is obviously a list and the panel is
   obviously cut off, so the bar only adds a rail through the layout. */
```

`line 283`

```text
/* The sheen below needs a positioned ancestor — but only where the card is not
   already positioned by a utility. This file is unlayered, so it outranks
   Tailwind: a blanket `position: relative` beat `.absolute` on the project
   dropdown, dropping it back into the layout and stretching the header. */
```

`line 291`

```text
/* The diagonal glare across two opposite corners, which is what reads as a
   curved pane catching a light source. A gradient, not a blurred layer. */
```

`line 322`

```text
/* A card sitting inside another must not stack two translucent layers into
   something opaque — it gets the faintest fill and leans on its border.

   Overlays are excluded. The notification dropdown and the project switcher
   are cards rendered inside the header, which is itself a card, so this rule
   matched them and forced them to 34% — the exact opposite of what a panel
   laid over live content needs. It also outranked .popover, which is why
   raising that rule's opacity changed nothing. */
```

`line 334`

```text
/* The same treatment for the smaller rounded surfaces, so the whole interface
   is made of one material rather than glass panes holding solid boxes.

   The filled variants are excluded by name. Left in, the light theme's
   descendant selector outranked .btn-primary, which lost its accent fill and
   kept its white text — an invisible button. */
```

`line 351`

```text
/* For controls built from utility classes rather than .btn — the project
   switcher, the theme toggle, the identity chip. Adding .glass gives them the
   same material without inheriting .btn's padding and type size. */
```

`line 354`

```text
/* The fill sits in the components layer, which Tailwind's utilities layer
   overrides. Unlayered (and worse, !important) it beat every `hover:bg-*` and
   `[class.bg-ink]` on the elements it was added to — hovering "Plan upgrade"
   did nothing, and a selected environment tab lost its fill. */
```

`line 369`

```text
/* Accent-tinted glass, for a call to action that should still read as the
     same material. Setting `border-accent` on plain .glass instead replaced
     the glass edge with a flat outline — which on the dark theme left nothing
     but an outline, since the fill barely differs from the card behind it. */
```

`line 425`

```text
/* Buttons and pills are the capsules the effect suits best, so they get the
   same bevel stack, scaled down to their size. */
```

`line 449`

```text
/* Interactive glass lifts on hover. Also in the components layer, so an
   element carrying its own hover:bg-* still wins. */
```

`line 458`

```text
/* Tinted with the brand rather than merely lighter: on a pale ground, a
     slightly paler pale is not a state change anyone can see. */
```

`line 472`

```text
/* The filled variants stay solid accent, defined further down. They are the
   emphasis in a screen made of glass, and a call to action you can read at a
   glance is worth more here than another translucent panel. */
```

`line 476`

```text
/* bg-elevated is used inline all over the app for inner tiles and chips. */
```

`line 481`

```text
/* The bar stays put and the content slides under it, frosted. */
```

`line 490`

```text
/* Navigation pills. The active one inverts, as in a segmented control. */
```

`line 524`

```text
/* Form controls, so every create/edit form looks and behaves the same. */
```

`line 558`

```text
/* Calendar event chip: tinted to its kind, readable at 10px, truncating
   rather than wrapping so a day cell keeps its rhythm. */
```

`line 572`

```text
/* Day cells: quiet by default, lifting on hover so the grid feels live. */
```

`line 590`

```text
/* Diff rendering: whole-line tint for the change, stronger tint for the exact
   tokens that moved, so a version bump reads at a glance. */
```

`line 627`

```text
/* The press is the feedback, as on a phone. */
```

`line 647`

```text
/* The mark’s gradient, reused wherever a brand flourish earns its place. */
```

---

## Comments inside template literals

CSS in Angular `styles:` blocks and GLSL shader source.

---

## Comments inside template literals

CSS in Angular `styles:` blocks and GLSL shader source.

### frontend/src/app/features/auth/tech-marquee.ts

`line 50`

```text
/* Logos fade out at both ends rather than being cut off mid-stroke. */
```

### frontend/src/app/features/auth/tech-marquee.ts

`line 78`

```text
/* A fixed cell width, not a gap: each item then occupies exactly the same
       space, so translating half the track is precisely one full copy. */
```

### frontend/src/app/shared/change-timeline.ts

`line 94`

```text
/* Entries rise into place in sequence, which reads as the timeline being
       drawn. Held to one short movement; the global reduced-motion rule
       flattens it to nothing. */
```

### frontend/src/app/shared/shader-background.ts

`line 34`

```text
/** How much of the flow survives at the edges of the screen. */
```

### frontend/src/app/shared/shader-background.ts

`line 39`

```text
  // Classic 2D value noise. Cheap, and smooth enough once layered.
```

### frontend/src/app/shared/shader-background.ts

`line 59`

```text
/** Layered noise. Four octaves is plenty at this scale and stays cheap. */
```

### frontend/src/app/shared/shader-background.ts

`line 73`

```text
    // Aspect-corrected, so the flow does not stretch on a wide monitor.
```

### frontend/src/app/shared/shader-background.ts

`line 79`

```text
    // Domain warping: noise displacing the lookup of more noise, which is what
```

### frontend/src/app/shared/shader-background.ts

`line 80`

```text
    // turns flat clouds into something that looks like it is flowing.
```

### frontend/src/app/shared/shader-background.ts

`line 92`

```text
    // The ground tinted toward the brand colours — teal through the middle of
```

### frontend/src/app/shared/shader-background.ts

`line 93`

```text
    // the range, lime at the peaks.
```

### frontend/src/app/shared/shader-background.ts

`line 98`

```text
    // Settled toward the flat ground at the edges, so cards near the rim keep
```

### frontend/src/app/shared/shader-background.ts

`line 99`

```text
    // their contrast. The light theme keeps far more of it: the margins are
```

### frontend/src/app/shared/shader-background.ts

`line 100`

```text
    // exactly where its background shows between cards, and flattening them
```

### frontend/src/app/shared/shader-background.ts

`line 101`

```text
    // there hides the effect where it is most needed.
```

### frontend/src/app/shared/shader-background.ts

`line 105`

```text
    // A little dither. Eight-bit gradients this wide band badly without it.
```

### frontend/src/app/shared/working.ts

`line 31`

```text
/* The drawing is black line art on white, which is invisible on the dark
       theme. Inverting it there keeps one asset working in both. */
```
