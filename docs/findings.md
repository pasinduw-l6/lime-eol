# Findings

Notes on external systems, surprises and decisions made while building. Newest
on top. Anything that changes the architecture also goes in PLAN.md section 14.

### 2026-09-17 — A product's cycle naming scheme can change over time
Docker Engine publishes `26.1` (major.minor) for older cycles but `27` and `28`
(major) for current ones. A single `cycleRule` per technology therefore cannot
always reproduce the upstream cycle name: deriving `28.5.2` under `MAJOR_MINOR`
gives `28.5`, which does not exist upstream.

Caught by a consistency check in the seed, which compares the derived cycle
against the declared one. Consequences:

- `Technology.cycleRule` is a **hint for suggesting** a cycle when a version is
  entered, not a guarantee.
- The Phase 7 sync must match a version to a cycle by looking it up in the
  product's published release list, falling back to derivation — never by
  trusting derivation alone.
- Keep that check in the seed; it is cheap and it found a real problem.

### 2026-09-17 — endoflife.date API v1 is Beta
The product endpoint is `GET https://endoflife.date/api/v1/products/{slug}/`
and needs no API key. Being Beta, the response shape can change, so the client
validates it with zod and the sync keeps existing data when a product fails.
Slugs must be verified against the site before being seeded.

### 2026-09-17 — Microsoft 365 connectors for Teams are retired
Incoming-webhook connectors are gone; Teams alerts go through Power Automate
**Workflows** webhooks posting Adaptive Cards. Each team stores its own URL in
`team.teams_webhook_url`, masked in API responses.
