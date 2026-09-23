# Accounts and sign-in

> **These are starting passwords, shared by agreement, and they are weak.**
> They exist so the team can get in during development. Change them before this
> tool holds anything that matters, and delete this file when you do — see
> [Before this goes anywhere real](#before-this-goes-anywhere-real).

## Who can sign in

Seven accounts are issued. There is no self-service registration: this tool
records who changed a customer's production estate, and an account anyone could
create for themselves would make that record worth very little.

### DevOps engineers — role `EDITOR`

Password for all six: **`yl123`**

| Email | Name |
| --- | --- |
| `dinith@lime-automation.com` | Dinith |
| `kushantha@linearsix.com` | Kushantha |
| `pamodha@linearsix.com` | Pamodha |
| `pasinduw@linearsix.com` | Pasindu W |
| `randula@linearsix.com` | Randula |
| `suran@linearsix.com` | Suran |

`EDITOR` is the working role: record version changes, add components, register
technologies, plan upgrade actions.

### Read-only — role `VIEWER`

| Email | Password | Name |
| --- | --- | --- |
| `lime@linearsix.com` | `lime` | Lime Viewer |

Sees everything, records nothing. The header marks the session **read only**.

## Where to sign in

<http://localhost:4200/login>

Email is matched case-insensitively and trimmed, so `Randula@linearsix.com`
works as well as `randula@linearsix.com`.

## What sign-up does

`/signup` is still there and still validates, but it is **not connected to the
database** and cannot create an account. It says so on the form. Accounts are
issued by running the seed — see [Issuing or resetting an
account](#issuing-or-resetting-an-account).

## How a password is stored

Never in plain text. Each password is hashed with **scrypt** — memory-hard, and
built into Node, so there is no native module to compile. Every account gets its
own random 16-byte salt, and the cost parameters are stored alongside the digest
so they can be raised later without invalidating existing passwords:

```
scrypt$16384$8$1$<base64 salt>$<base64 hash>
```

Two details that matter:

- Sign-in verifies a password even when the email is unknown, and answers with
  the same message either way. Replying faster, or differently, for an address
  that does not exist would tell an attacker which of these addresses are real.
- Digests are compared with `timingSafeEqual`, not `===`. A normal comparison
  returns at the first differing byte, and that timing difference is enough to
  recover a hash a character at a time.

See [`password.util.ts`](../backend/src/modules/auth/password.util.ts).

## Sessions

A successful sign-in returns a JWT signed with `DEV_JWT_SECRET`, valid for
**12 hours** — a working day, so nobody is signed out mid-change.

The browser keeps it in `localStorage` and sends it as `Authorization: Bearer
<token>` on every request. That puts the token where page scripts can read it,
which is the accepted trade-off for a first-party tool on an internal network;
the alternative is an httpOnly cookie, which needs CSRF handling the API does
not have yet.

`GET /api/v1/auth/me` re-reads the account from the database rather than
trusting the token's claims, so deactivating someone or changing their role
takes effect on their next request instead of whenever their token expires.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/auth/login` | Email and password in, session out |
| `GET` | `/api/v1/auth/me` | The account behind the current token |

```bash
curl -X POST http://localhost:4200/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"pasinduw@linearsix.com","password":"yl123"}'
```

## Issuing or resetting an account

Edit [`users.seed.ts`](../backend/prisma/seed/users.seed.ts), then run it. It
upserts on email, so a rerun re-issues the password without creating a second
account and without disturbing the changes already attributed to that person:

```bash
docker compose run --rm --no-deps \
  -v "$PWD/backend/prisma:/app/prisma" -v "$PWD/backend/src:/app/src" \
  -w /app api npx ts-node prisma/seed/users.only.ts
```

`users.only.ts` exists because the full seed also writes sample estate data,
which must not run against a database holding a real customer's environments.

To deactivate someone without deleting their history, set `is_active = false`.
Their recorded changes stay attributed to them; they simply cannot sign in.

## Before this goes anywhere real

Known gaps, in the order they matter:

1. **The API does not yet require a token.** Route guards in the browser decide
   what gets *rendered*; they are not access control. Every endpoint except
   `/auth/me` still answers an unauthenticated request. Until a global guard
   lands, this tool is only as protected as the network it sits on.
2. **`DEV_JWT_SECRET` is `yl123`** — five characters, in `.env`, and the same
   string as the shared password. Anyone who knows it can mint a token for any
   account. Replace it with 32+ random bytes.
3. **These passwords are shared and weak,** and `EDITOR` accounts can rewrite
   what a customer's production estate is recorded as running.
4. **This file lists them in plain text.** It is committed to the repository, so
   anyone with repository access has every account. Delete it once real
   passwords are set, and hand those out individually.
5. **There is no password change screen,** so a user cannot rotate their own
   password — only a reseed can.
