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

## Running the whole collection headlessly

No local install needed — newman runs in a container. From the repository root:

```bash
docker run --rm -v "$(pwd)/docs/postman:/etc/newman" \
  --add-host=host.docker.internal:host-gateway \
  postman/newman:alpine run lime-eol.postman_collection.json \
  --env-var "baseUrl=http://host.docker.internal:3000/api/v1" \
  --env-var "docsUrl=http://host.docker.internal:3000/api/docs-json" \
  --folder "System" --folder "EOL data source"
```

On Git Bash for Windows prefix the command with `MSYS_NO_PATHCONV=1` and use
`$(pwd -W)`, otherwise the volume path is mangled. `host.docker.internal` is how
the container reaches the API published on your host; from Postman on the host
the default `localhost` values are correct.

Last run: 13 requests, 33 assertions, 0 failures.

## As the API grows

Folders are labelled with the phase that implements them; anything from a
future phase returns `404` for now. New endpoints are added to this collection
in the same phase that builds them.

Alternative to importing by hand: the API publishes its OpenAPI document at
`http://localhost:3000/api/docs-json`, which Postman can import directly to
generate an always-current request list.
