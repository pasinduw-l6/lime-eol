# API Reference

Every endpoint the API serves today, with parameters, responses and errors.
Planned endpoints are listed at the end so the whole surface is visible in one
place.

- **Status:** current as of 2026-09-17
- **Base URL:** `http://localhost:3000/api/v1`
- **Interactive docs:** `http://localhost:3000/api/docs` · machine-readable: `/api/docs-json`
- **Verified by:** the Postman collection in [postman/](postman/) — 13 requests, 33 assertions, 0 failures
- **Update when:** an endpoint is added, changed or removed

---

## Conventions

| Topic | Rule |
|---|---|
| Format | JSON in, JSON out. `Content-Type: application/json` |
| Versioning | Every route sits under `/api/v1` |
| Authentication | Bearer JWT: `Authorization: Bearer <token>`. Not yet enforced — arrives in Phase 3. `/health` stays public |
| Unknown query parameters | Rejected with `400`, not ignored |
| Dates | Date-only values are `YYYY-MM-DD` in UTC. Timestamps are ISO 8601 |
| Lists | Paginated lists (from Phase 4) use `?page=1&pageSize=20&sort=field:asc` and return `{ items, total, page, pageSize }` |

### Error shape

Every error returns the same body:

```json
{ "statusCode": 404, "message": "No endoflife.date product with slug \"foo\"", "error": "Not Found" }
```

Validation failures return `message` as an array:

```json
{ "statusCode": 400, "message": ["eolField must be one of the following values: eol, eoas, eoes"], "error": "Bad Request" }
```

| Status | Meaning |
|---|---|
| `200` | Success |
| `400` | Invalid parameter or body |
| `401` | Missing or invalid token (from Phase 3) |
| `403` | Authenticated but the role is not allowed (from Phase 3) |
| `404` | The resource does not exist |
| `409` | Conflict, e.g. a duplicate name (from Phase 4) |
| `503` | A dependency is down — returned by `/health` when the database is unreachable |

---

## Endpoint summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | public | Application and database liveness |
| GET | `/eol/products` | public¹ | Search products in the lifecycle data source |
| GET | `/eol/categories` | public¹ | List product categories |
| GET | `/eol/tags` | public¹ | List product tags |
| GET | `/eol/products/{slug}` | public¹ | Release cycles and lifecycle dates for one product |
| GET | `/eol/products/{slug}/releases/latest` | public¹ | Newest cycle of a product |
| GET | `/eol/products/{slug}/releases/{cycle}` | public¹ | One specific cycle |

¹ Public today; these become role-protected when authentication lands in Phase 3.

---

## System

### `GET /health`

Application and database health. Used by Docker, by monitoring, and as the first
check that the stack is up.

**Parameters:** none.

**200 — healthy**

```json
{
  "status": "ok",
  "info": { "database": { "status": "up", "responseTimeMs": 8 } },
  "error": {},
  "details": { "database": { "status": "up", "responseTimeMs": 8 } }
}
```

**503 — a dependency is down.** Same shape, with `"status": "error"` and the
failing dependency under `error`. This is the check working, not the API
breaking.

---

## EOL data source

Live lookups against [endoflife.date](https://endoflife.date) API v1. These need
no database, which is why they work before Phase 2.

Responses are cached in memory for **one hour**, because the source regenerates
at most daily. The registry uses these endpoints to find the right product slug
and cycle when a technology is being registered.

### `GET /eol/products`

Search the products the data source tracks (475 at last count).

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `q` | query | string | no | Case-insensitive match on slug, label or alias |
| `category` | query | string | no | Restrict to a category. See `GET /eol/categories` |
| `tag` | query | string | no | Restrict to a tag. See `GET /eol/tags`. Ignored when `category` is set |

`category` and `tag` narrow the request at the source rather than filtering
locally, so they are much cheaper than fetching everything.

**200**

```json
[
  {
    "slug": "mongodb",
    "label": "MongoDB Server",
    "category": "database",
    "aliases": ["mongo"],
    "tags": ["database"]
  }
]
```

**Example**

```
GET /api/v1/eol/products?q=mongo
GET /api/v1/eol/products?category=database
```

### `GET /eol/categories`

**200** — an array of category names:

```json
["framework","server-app","service","lang","os","app","database","device","standard"]
```

### `GET /eol/tags`

**200** — an array of 88 tag names, for example `javascript-runtime`, `apache`,
`managed-kubernetes`.

### `GET /eol/products/{slug}`

All release cycles of one product, with the lifecycle dates already mapped to
the fields the registry stores.

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `slug` | path | string | **yes** | Product slug, e.g. `nodejs` |
| `eolField` | query | `eol` \| `eoas` \| `eoes` | no (default `eol`) | Which support phase counts as end of life |

**`eolField` explained** — different teams draw the line in different places:

| Value | Means | Use when |
|---|---|---|
| `eol` | End of security support | The default, and right for most technologies |
| `eoas` | End of active support | Your policy is not to run security-only builds |
| `eoes` | End of extended/commercial support | You pay for extended support. Falls back to `eol` when the product has none, which is most of them |

**200**

```json
{
  "slug": "nodejs",
  "label": "Node.js",
  "category": "framework",
  "aliases": ["node"],
  "tags": ["framework", "javascript-runtime"],
  "htmlUrl": "https://endoflife.date/nodejs",
  "releasePolicyUrl": "https://nodejs.org/en/about/previous-releases",
  "phaseLabels": { "eoas": "Active Support", "eol": "Security Support", "eoes": "Commercial Support" },
  "releases": [
    {
      "cycle": "24",
      "label": "24 (LTS)",
      "releaseDate": "2025-05-06",
      "isLts": true,
      "activeSupportEnd": "2026-10-20",
      "eolDate": "2028-04-30",
      "latestSupported": "24.21.0",
      "isMaintained": true,
      "daysToEol": 591
    }
  ]
}
```

**Release fields**

| Field | Type | Meaning |
|---|---|---|
| `cycle` | string | The cycle identifier. Matches `TechnologyVersion.cycle`. Major only for some products (`24`), major.minor for others (`6.0`) |
| `label` | string | Display name, e.g. `24 (LTS)` |
| `releaseDate` | date \| null | When the cycle was released |
| `isLts` | boolean | Long-term support cycle |
| `activeSupportEnd` | date \| null | End of active support (`eoasFrom` upstream) |
| `eolDate` | date \| null | End of life for the chosen `eolField`. `null` means the source has not published one |
| `latestSupported` | string \| null | Newest patch release in the cycle, e.g. `24.21.0` |
| `isMaintained` | boolean | Still receiving any support |
| `daysToEol` | number \| null | Days until `eolDate`. **Negative when already past** |

**404** — the slug does not exist:

```json
{ "statusCode": 404, "message": "No endoflife.date product with slug \"not-a-real-thing\"", "error": "Not Found" }
```

### `GET /eol/products/{slug}/releases/latest`

The newest cycle of a product — the upgrade target to suggest when planning an
action. Same parameters and same release shape as above, returning a single
release object rather than a product.

**200**

```json
{
  "cycle": "26",
  "label": "26 (Upcoming LTS)",
  "releaseDate": "2026-05-05",
  "isLts": false,
  "activeSupportEnd": "2027-10-27",
  "eolDate": "2029-04-30",
  "latestSupported": "26.9.0",
  "isMaintained": true,
  "daysToEol": 956
}
```

### `GET /eol/products/{slug}/releases/{cycle}`

One specific cycle. This is how a version already in the registry is checked
against the source.

| Parameter | In | Required | Description |
|---|---|---|---|
| `slug` | path | **yes** | Product slug, e.g. `mongodb` |
| `cycle` | path | **yes** | Cycle identifier, e.g. `6.0` |
| `eolField` | query | no | As above |

**200** — a release object. A cycle already past its EOL shows a negative
`daysToEol`:

```json
{ "cycle": "6.0", "releaseDate": "2022-07-31", "eolDate": "2025-07-31", "latestSupported": "6.0.29", "isMaintained": false, "daysToEol": -413 }
```

**404** — the product does not publish that cycle:

```json
{ "statusCode": 404, "message": "Product \"nodejs\" has no release cycle \"99\"", "error": "Not Found" }
```

---

## Upstream coverage

Which endoflife.date endpoints this API maps. 10 of 12.

| Upstream | Mapped to | Exposed as |
|---|---|---|
| `GET /products` | `listProducts()` | `GET /eol/products` |
| `GET /products/full` | `listProductsFull()` | internal — one 2.8 MB call for the nightly sync instead of one per technology |
| `GET /products/{p}` | `getProduct()` | `GET /eol/products/{slug}` |
| `GET /products/{p}/releases/{r}` | `getRelease()` | `GET /eol/products/{slug}/releases/{cycle}` |
| `GET /products/{p}/releases/latest` | `getLatestRelease()` | `GET /eol/products/{slug}/releases/latest` |
| `GET /categories` | `listCategories()` | `GET /eol/categories` |
| `GET /categories/{c}` | `listProductsByCategory()` | `GET /eol/products?category=` |
| `GET /tags` | `listTags()` | `GET /eol/tags` |
| `GET /tags/{t}` | `listProductsByTag()` | `GET /eol/products?tag=` |
| `GET /` | not mapped | A discovery index of the three collections; no data we need |
| `GET /identifiers`, `/identifiers/{type}` | not mapped | purl/CPE/repology identifiers serve SBOM and vulnerability matching, which is out of scope for phase 1 |

**Reliability.** The client applies a 10-second timeout, 3 retries with
exponential backoff, and retries only on `408`, `425`, `429` and `5xx` — never
on a `404`, which is an answer rather than a failure. Every response is
validated against a schema before use, so if the upstream shape changes the sync
fails loudly instead of writing `null` over good EOL dates. All of this is
configurable through `EOL_*` variables in `.env`.

---

## Planned endpoints

Not built yet. Listed so the finished surface is visible; each arrives with its
phase. Full definitions are in [PLAN.md](../PLAN.md) section 9.

| Phase | Endpoints |
|---|---|
| 3 — Auth | `POST /auth/dev-login`, `GET /auth/me` |
| 4 — Registry | `/technologies`, `/technologies/{id}/versions`, `/technologies/{id}/cycles`, `/versions`, `/versions/{id}`, `/lime-versions` |
| 5 — Mapping | `/customers`, `/customers/{id}/components`, `/deployments`, `/deployments/{id}/overrides`, `/versions/{id}/impact`, `/teams`, `/users` |
| 6 — Actions | `/upgrade-actions`, `/inbox` |
| 7 — Sync | `POST /sync/run`, `GET /sync/logs` |
| 8 — Dashboard | `/dashboard/summary`, `/dashboard/timeline`, `/search` |
| 9 — Notifications | `/settings/notification-rules`, `POST /notifications/test`, `/notifications/logs` |
| 10 — Reports | `/reports/registry`, `/reports/impact/{versionId}`, `/reports/actions`, `/reports/customer/{id}` |
| 11 — Admin | `/audit-logs` |

---

## Keeping this file accurate

The API documents itself at `/api/docs-json`; this file adds the context Swagger
cannot: why a parameter exists, what a field means in our domain, and what the
error means for the caller. When you add an endpoint:

1. Add Swagger decorators to the controller — `@ApiOperation`, `@ApiParam`, `@ApiOkResponse`.
2. Add a request to the Postman collection, with a test assertion.
3. Add a section here, and a row in the summary table.
4. Update the phase checklist and work log in `PLAN.md`.

To list the live surface at any time:

```bash
curl -s http://localhost:3000/api/docs-json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(Object.keys(JSON.parse(d).paths).join('\n')))"
```
