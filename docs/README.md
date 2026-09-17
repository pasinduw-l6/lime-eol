# Documentation

Everything written down about the Lime Technology Lifecycle & EOL Registry.
Start here.

**Project status — 2026-09-17**

| | |
|---|---|
| Phase | 1 of 13 complete; EOL data source connected ahead of schedule |
| Running | API, worker and PostgreSQL in Docker Desktop |
| Endpoints live | 7 |
| Unit tests | 28 passing |
| API tests | 13 requests, 33 assertions, 0 failures (Postman/newman) |
| Next | Phase 2 — database schema, migration, status view, seed data |

---

## The documents

| Document | Answers | Update when |
|---|---|---|
| [../PLAN.md](../PLAN.md) | What are we building, in what order, and where are we now? | Every session — sections 15 (tracker) and 16 (work log) |
| [../README.md](../README.md) | How do I start it and run the everyday commands? | The commands or the stack change |
| [folder-structure.md](folder-structure.md) | Where does this file belong, and what is each folder for? | A folder is added, removed or changes purpose |
| [api-reference.md](api-reference.md) | What endpoints exist, what do they take and return? | An endpoint is added, changed or removed |
| [findings.md](findings.md) | What did we learn about the external systems? | Something surprising turns up |
| [postman/](postman/) | How do I call the API by hand or run the whole suite? | An endpoint is added |
| [api-examples.http](api-examples.http) | Same, for the VS Code REST Client | An endpoint is added |
| [../backend/src/modules/README.md](../backend/src/modules/README.md) | What does each feature module own, and how is one laid out? | A module is added or its responsibility shifts |
| [diagrams/](diagrams/) | Architecture pictures | The architecture changes |

Two rules keep this set from rotting:

1. **One fact lives in one place.** Requirements and progress live in `PLAN.md`;
   endpoint detail lives in `api-reference.md`; folder purpose lives in
   `folder-structure.md`. Other documents link rather than repeat.
2. **Documentation is part of the work, not a follow-up.** A phase is not done
   until its documents are updated — same as build, lint and tests.

---

## Writing a status report

Everything a report needs, and where to take it from:

| Report section | Source |
|---|---|
| What the system does, and scope | `PLAN.md` sections 1 and 2 |
| Architecture and technology choices | `PLAN.md` section 2, `folder-structure.md` |
| Progress against plan | `PLAN.md` section 15 (progress tracker) |
| What was done this period | `PLAN.md` section 16 (work log), newest entry first |
| Decisions taken, and why | `PLAN.md` section 14 (risks and decisions log) |
| What works today | The status table above, plus `api-reference.md` |
| Evidence it works | Test counts above; regenerate with the commands below |
| Risks and unknowns | `PLAN.md` section 14 and `findings.md` |
| What is next | `PLAN.md` section 15, "Next step" |

### Regenerating the evidence

```bash
# Live endpoint list
curl -s http://localhost:3000/api/docs-json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(Object.keys(JSON.parse(d).paths).join('\n')))"

# Unit tests
docker build --target dev -t eol-backend-dev ./backend
docker run --rm eol-backend-dev npx jest

# Whole API suite (see postman/README.md for the Windows note)
docker run --rm -v "$(pwd)/docs/postman:/etc/newman" \
  --add-host=host.docker.internal:host-gateway \
  postman/newman:alpine run lime-eol.postman_collection.json \
  --env-var "baseUrl=http://host.docker.internal:3000/api/v1" \
  --env-var "docsUrl=http://host.docker.internal:3000/api/docs-json" \
  --folder "System" --folder "EOL data source"

# Service status
docker compose ps
```

---

## Reading order for someone new

1. `PLAN.md` sections 1–2 — what this is and how it is built.
2. `README.md` — start the stack.
3. `docs/api-reference.md` — call `/health`, then an `/eol/*` endpoint.
4. `docs/folder-structure.md` — find your way around the code.
5. `backend/src/modules/README.md` — the conventions to follow when adding a module.
