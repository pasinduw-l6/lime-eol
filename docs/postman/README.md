# Testing the API with Postman

## Import once

1. Postman → **Import** → drop in both files from this folder:
   - `lime-eol.postman_collection.json` — the requests
   - `lime-eol.local.postman_environment.json` — the local variables
2. Top-right environment selector → **Lime EOL - Local**.

## Run

Start the stack first:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Then run **System → Health**. Expected: `200` with

```json
{ "status": "ok", "info": { "database": { "status": "up", "responseTimeMs": 3 } } }
```

If the database is down you get `503` and `"status": "error"` — that is the
health check doing its job, not a broken API.

## Variables

| Variable | Meaning |
|---|---|
| `baseUrl` | `http://localhost:3000/api/v1` |
| `token` | JWT. Filled automatically by **Auth → Dev login** (Phase 3) and sent as a bearer token on every authenticated request. |

## As the API grows

Folders are labelled with the phase that implements them; anything from a
future phase returns `404` for now. New endpoints are added to this collection
in the same phase that builds them.

Alternative to importing by hand: the API publishes its OpenAPI document at
`http://localhost:3000/api/docs-json`, which Postman can import directly to
generate an always-current request list.
