# Findings

Notes on external systems, surprises and decisions made while building. Newest
on top. Anything that changes the architecture also goes in PLAN.md section 14.

### 2026-09-17 — endoflife.date API v1 is Beta
The product endpoint is `GET https://endoflife.date/api/v1/products/{slug}/`
and needs no API key. Being Beta, the response shape can change, so the client
validates it with zod and the sync keeps existing data when a product fails.
Slugs must be verified against the site before being seeded.

### 2026-09-17 — Microsoft 365 connectors for Teams are retired
Incoming-webhook connectors are gone; Teams alerts go through Power Automate
**Workflows** webhooks posting Adaptive Cards. Each team stores its own URL in
`team.teams_webhook_url`, masked in API responses.
