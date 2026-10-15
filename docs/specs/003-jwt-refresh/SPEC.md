# spec: Refresh Token — Rotation

## Context

Login (spec 002) is merged and returns an access token only. Spec 002 lists refresh token handling and delivery as out of scope: there are no refresh tokens yet.

This spec introduces them. A client can exchange a refresh token for a new access token and a new refresh token without re-entering credentials, and each refresh token can only be used once.

## Goal

After logging in, a client holds a refresh token. It can exchange it for a new access token and a new refresh token. The refresh token it presented can never be used again.

## Why server-side state is required

Single-use tokens cannot be stateless: a pure JWT stays valid until it expires, whatever the server wants. The server must remember which tokens it issued and which were already used. This spec therefore introduces a `RefreshToken` table and **changes the login response** (see "Impact on existing behavior").

## In scope

- `POST /auth/refresh` — refresh token → new access token + new refresh token
- `RefreshToken` table (hashed storage)
- Single-use: a refresh token that was already exchanged is rejected
- Login issues and persists a refresh token (new field in its response)
- New environment variables for the refresh token

## Out of scope (future specs)

- **Revocation, as one later spec:** `POST /auth/logout` and reuse detection (presenting an already-used token kills the session). Decision already taken for that spec: **logout revokes the whole family**. This follows this one closely, see "Known limitations"
- Cleanup of expired rows: a near-term follow-up, not a someday item (see "Known limitations")
- `/me` endpoint (exposes the user's profile, including role)
- Guards / route protection / RBAC (`004-guards-rbac`)
- httpOnly cookie transport for the refresh token: to be specified in a later spec
- Rate limiting on `/auth/refresh`

## Behavior

### Token model

|                    | Access token                     | Refresh token                            |
| ------------------ | -------------------------------- | ---------------------------------------- |
| Format             | signed JWT (HS256, `JWT_SECRET`) | signed JWT (HS256, `JWT_REFRESH_SECRET`) |
| Payload            | `{ sub, role, iat, exp }`        | `{ sub, jti, iat, exp }`                 |
| Expiry             | `JWT_EXPIRES_IN` (existing)      | `JWT_REFRESH_EXPIRES_IN` (required)      |
| Stored server-side | no                               | yes (hash only), `jti` = row `id`        |

- `jti` is the `id` of the `RefreshToken` row for this exact token
- No role, no email in the refresh payload

### Schema

```prisma
model RefreshToken {
  id         String    @id @default(uuid())  // = jti
  familyId   String                          // shared by every token descended from one login
  userId     String
  tokenHash  String                          // sha256 of the raw token, never the token itself
  expiresAt  DateTime                        // planned end of life, fixed at creation, equal to the JWT exp
  revokedAt  DateTime?                       // set when the server ends the token early
  replacedBy String?                         // id of the token issued when this one was exchanged
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([familyId])
}
```

- `familyId` is written but not yet read. It is groundwork so the revocation spec needs no migration.
- Hashing is **SHA-256**, not argon2. The token is a high-entropy string, not a human password, so a slow hash adds cost without adding security, and the lookup must be fast.
- A refresh token is valid only if `revokedAt IS NULL` **and** `expiresAt > now()`.
- Vocabulary the revocation spec relies on:
  - **used** = `revokedAt` and `replacedBy` are both set (the token was exchanged)
  - **revoked** = `revokedAt` is set and `replacedBy` is null (ended by the server without being exchanged; written only by the future revocation spec)

### Transport

The refresh token is sent in the JSON body and returned in the JSON body. Token extraction should stay in one small isolated function so a cookie transport can be added later without touching the token logic.

### `POST /auth/refresh`

**Request body**

```json
{ "refreshToken": "<jwt>" }
```

Validated via `RefreshDto` (`class-validator`): non-empty string. Global `ValidationPipe` rules apply (`whitelist`, `forbidNonWhitelisted`).

**Success: 200**

```json
{ "accessToken": "<jwt>", "refreshToken": "<jwt>" }
```

**Processing order**

1. Verify the JWT with `JWT_REFRESH_SECRET`, **pinning `algorithms: ['HS256']`**. Bad signature, wrong algorithm or expired: 401.
2. Validate the payload shape: `sub` and `jti` must be strings. A validly signed token with a malformed payload: 401.
3. Load the `RefreshToken` row by `jti`. Not found: 401. (This also covers a deleted user, because `onDelete: Cascade` removes their tokens.)
4. Compare `sha256(presentedToken)` with `tokenHash` (constant-time). Mismatch: 401. Both sides are compared as raw 32-byte digest buffers (`Buffer.from(hex, 'hex')`), and a stored `tokenHash` whose decoded length is not 32 bytes counts as a mismatch: `crypto.timingSafeEqual` throws a `RangeError` on unequal lengths, which would otherwise surface as a 500.
5. `revokedAt` already set, or `expiresAt` in the past: 401. (The `expiresAt` check is defense in depth, since step 1 already rejects an expired JWT and `expiresAt` equals `exp`. Covered by a unit test with a mocked repository.)
6. Load the user by `sub`. Not found: 401. This branch is a defense that is practically unreachable (only in a race with a user deletion) and is covered by a unit test with a mocked repository.
7. Prepare the new token **before** touching the DB:
   1. generate the new id (this will be the new `jti`)
   2. compute the new `expiresAt` from `JWT_REFRESH_EXPIRES_IN`
   3. sign the new refresh token with that `jti` and an `exp` equal to `expiresAt`
   4. compute `sha256(newRefreshToken)`
   5. sign the new access token with the user's **current** role
8. In **one transaction**: conditionally mark the old row used (`UPDATE ... SET revokedAt = now(), replacedBy = newId WHERE id = ? AND revokedAt IS NULL`), then insert the new row (`id = newId`, same `familyId`, `tokenHash`, `expiresAt`). If the conditional update touches 0 rows, another request won the race: the insert is skipped, nothing is written, and the response is 401. A token signed in step 7 and then discarded because the race was lost is never returned to anyone.
9. Return the pair.

**Failure: 401** (same body for every failure above, whatever the cause)

```json
{
  "statusCode": 401,
  "message": "invalid refresh token",
  "error": "Unauthorized"
}
```

This is produced by a single `InvalidRefreshTokenError` (`auth/errors/`), mapped to 401 in `STATUS_BY_ERROR` in `DomainExceptionFilter`, the same mechanism as `InvalidCredentialsError`. Every failure path throws that one error, so the body cannot diverge. Any other exception thrown while verifying (e.g. a `JsonWebTokenError`) is caught and converted to it.

**Implementation note.** `JwtModule` is currently registered with `JWT_SECRET` only. Refresh signing and verification pass their own `secret`, `algorithms` and `expiresIn` per call (in `TokenIssuerService` or a sibling service in `auth/services/`), so access and refresh secrets are never mixed.

### Impact on existing behavior

**The login response contract changes.** `POST /auth/login` now returns `{ accessToken, refreshToken }` instead of `{ accessToken }`. Spec 002's out-of-scope line on refresh tokens is lifted by this spec. Internally, login:

- generates a new `familyId`
- generates the row id (the `jti`), computes `expiresAt`, signs the refresh token with them, hashes it, **then** inserts the row (same ordering as step 7 above)

**Register is unchanged.** It does not issue a refresh token. A newly registered user logs in to obtain one.

### Environment variables

| Variable                 | Required            | Purpose                                     |
| ------------------------ | ------------------- | ------------------------------------------- |
| `JWT_SECRET`             | yes (existing)      | signs/verifies access tokens                |
| `JWT_EXPIRES_IN`         | existing, unchanged | access token TTL (not renamed in this spec) |
| `JWT_REFRESH_SECRET`     | yes (new)           | signs/verifies refresh tokens               |
| `JWT_REFRESH_EXPIRES_IN` | yes (new)           | refresh token TTL                           |

- Both new values are read with `getOrThrow`, so the app refuses to boot if `JWT_REFRESH_SECRET` or `JWT_REFRESH_EXPIRES_IN` is missing. The lifetime is a security setting: there is no silent default.
- `.env` and the example env file are updated with the new variables.

## Security requirements

- Only the SHA-256 hash of a refresh token is stored; the raw token is never persisted, logged, or returned except in the response that issues it
- Every refresh failure returns the same 401 body. The response is identical; the **response time is not**: a token rejected on its signature is refused before any DB query, later failures cost one or two queries. This is accepted. Only a holder of a validly signed token reaches the DB steps, so this is not an oracle for outsiders
- Access and refresh tokens use different secrets; an access token sent to `/auth/refresh` is rejected
- Verification pins the algorithm (`HS256`) and validates the payload shape
- The role in the new access token is always read from the DB at refresh time, never copied from a previous token. If a user's role changed between login and refresh, the new access token reflects the change
- `userId` comes from the verified token, never from the request body
- Hash comparison is constant-time (`crypto.timingSafeEqual`) on equal-length digest buffers; a malformed stored hash is a mismatch, not a 500
- Responses never contain `tokenHash`, `passwordHash` or any user field

## Error handling

| Condition                                              | Response                     |
| ------------------------------------------------------ | ---------------------------- |
| Missing/empty `refreshToken`                           | 400, validation detail       |
| Extra field in body                                    | 400 (`forbidNonWhitelisted`) |
| Bad signature, wrong algorithm, expired, malformed JWT | 401 "invalid refresh token"  |
| Valid signature but malformed payload                  | 401 "invalid refresh token"  |
| Unknown `jti` (includes deleted user) or hash mismatch | 401 "invalid refresh token"  |
| Token already used                                     | 401 "invalid refresh token"  |
| User not found at step 6 (race)                        | 401 "invalid refresh token"  |
| Access token sent to `/auth/refresh`                   | 401 "invalid refresh token"  |

## Success criteria

- [x] Login returns `{ accessToken, refreshToken }` and creates a `RefreshToken` row; the stored value is a hash, not the token
- [x] The row's `expiresAt` equals the refresh token's JWT `exp`
- [x] `/auth/refresh` with a valid token returns 200 and a new, different pair
- [x] The token used is marked used (`revokedAt` and `replacedBy` both set) and the new row has the same `familyId`
- [x] Chained refresh: the refresh token returned by a refresh can itself be refreshed, and the `familyId` is unchanged
- [x] Two separate logins produce different `familyId`s; a refresh keeps the one of its login
- [x] Presenting the same refresh token a second time returns 401
- [x] Two concurrent refreshes with the same token: exactly one succeeds
- [x] An expired refresh token returns 401
- [x] A tampered refresh token returns 401
- [x] A token signed with the wrong secret returns 401
- [x] A token signed with a different algorithm returns 401
- [x] A validly signed token with a malformed payload (`sub` or `jti` missing or not a string) returns 401
- [x] A token with a valid signature and an existing `jti` but a hash mismatch returns 401
- [x] An access token sent to `/auth/refresh` returns 401
- [x] Deleted user: their tokens are gone with them and refresh returns 401
- [x] The "user not found" branch (step 6) returns 401 (unit test, mocked repository)
- [x] A row whose `expiresAt` is in the past but whose JWT is still valid returns 401 (step 5, unit test, mocked repository)
- [x] A stored `tokenHash` of the wrong length returns 401, not 500 (unit test)
- [x] A lost race (conditional update touches 0 rows) writes no new row
- [x] The refresh token's lifetime is sliding: each refresh issues a token valid for a fresh `JWT_REFRESH_EXPIRES_IN` (see Decisions)
- [x] All 401 responses have the exact same body
- [x] The new access token contains `sub` and the user's current `role`
- [x] If the user's role is changed in the DB after login, the access token issued by the next refresh carries the new role
- [x] The app fails to start if `JWT_REFRESH_SECRET` or `JWT_REFRESH_EXPIRES_IN` is missing
- [x] Response bodies never contain `tokenHash`, `passwordHash` or any user field

## Known limitations

- **Rotation without reuse detection.** A thief who rotates a stolen token first keeps a working chain, and the legitimate user's next attempt just gets a 401 with nothing revoked. This spec must not ship to production alone: the revocation spec (logout + reuse detection) should follow right after.
- **`revokedAt` uses the application clock.** It is set with `new Date()` in the repository, like `expiresAt` (the JWT `exp`), while `createdAt` uses the database clock. Nothing in this spec compares it to a time (validity only checks `revokedAt IS NULL`, and the race is settled by the conditional update), so skew between instances is harmless here. A reuse grace window in the revocation spec would compare a clock to `revokedAt`: it must either tolerate that skew or move the write to the database clock (`now()`, via raw SQL).
- **Table growth.** Every login and every refresh adds a row, and the access token lasts only 15 minutes, so the table grows fast. Expired-row cleanup is out of scope here but is a near-term follow-up.

## Decisions

- **Sliding session lifetime.** Every rotation grants a fresh `JWT_REFRESH_EXPIRES_IN` (7 days in the example env files), so an active user never has to log in again. The flip side: a stolen chain that keeps rotating never expires either. An absolute per-family cap (for example a `familyExpiresAt` column copied from the first token and checked at every refresh) is deliberately not part of this spec. It is revisited in the revocation spec, since it touches the same table and the same risk.
- **Transport:** JSON body only (see "Transport").
- **Role:** stays in the access token and is re-read from the DB at every refresh.

## Recap

**Shipped:** branch `feature/003-jwt-refresh` (12 commits, pushed). PR: not opened yet (`gh` was not authenticated). Login returns `{ accessToken, refreshToken }` and persists a hashed `RefreshToken` row; `POST /auth/refresh` rotates single-use tokens within a family; every failure answers the same 401. 165 unit tests and 65 e2e tests pass, coverage 100% statements/functions/lines and 81.81% branches. The follow-up that must come next is the revocation spec (logout and reuse detection), see "Known limitations".

### Architecture

- **Name the sensitive lookup.** The repository method that returns the stored hash is `findByIdWithTokenHash`, not `findById`, the same rule as `findByEmailWithPasswordHash`. `create` returns `void` so the hash never travels back out.
- **Sign before touching the database.** The row id is the `jti`, so it is generated first, the token is signed, then hashed, then persisted. A lost race wastes a signature but writes nothing.
- **Settle races in SQL, not in code.** One transaction does a conditional update (`WHERE revokedAt IS NULL`) and then the insert. `rotate` returns a boolean and the use case throws the domain error, so the repository stays free of business errors.
- **The row is authoritative.** The use case loads the user by `row.userId`, not by the JWT's `sub`. The hash match already ties the token to its row.
- **A malformed stored hash is a mismatch, not an error.** `timingSafeEqual` throws on unequal lengths, which would answer 500 for exactly one kind of input.
- **Classify verification failures.** A bad token (`JsonWebTokenError` and subclasses) is routine and not logged. Anything else is a server fault: log the stack, still answer the same 401. A validly signed token that doesn't match its hash logs one error with the `jti`, never the token or the hash.
- **Keep the secrets apart.** `JwtModule` stays registered with `JWT_SECRET` only. Refresh signing passes its own `secret`, `algorithm` and `expiresIn` per call, so the two can't be mixed.
- **Not every action needs a use case.** There is no "create refresh token" use case: login's private `startSession` issues and persists the first token.

### Naming

- `RotateRefreshTokenUseCase`, `RefreshTokenIssuerService`, `TokenHasherService`, `InvalidRefreshTokenError`.
- The 401 message is lowercase (`invalid refresh token`) to match `invalid credentials`.

### Test conventions

- **One test per branch, not one per call.** The first draft of the rotate spec had 21 tests, most of them asserting a single call argument. Merged down to 13 with the same branch coverage. Test behavior and the arguments that matter (`rotate`, role, family), not every internal call.
- **Don't write an e2e test that stubs what it tests.** A "fails to start" check that replaces `ConfigService` with a throwing stub only repeats the unit test. The criterion is covered by the issuer service's unit tests instead.
- **A DTO spec can't test the global pipe.** "Extra field rejected" belongs to `forbidNonWhitelisted`, so it is covered in e2e, where the real pipe runs.
- **The Prisma double needs a separate `tx` client** so a test can tell a write inside the transaction from one outside it.
- **Whole-second `iat` means two access tokens issued in the same second are identical.** Assert that the refresh token differs, not the access token.
- Random mock data and colocated `.mock.ts` doubles held up fine for every new class.

### Process

- **Review after tests and after implementation.** Mid-feature the workflow rule was tightened (`c65c262`) from "stop after each step" to stopping at red and again at green. It caught the over-testing above before it was committed.
- **List what each call can throw or return** in every auth review. It is what exposed the corrupt-hash and lost-race cases early.
- **Approval-gated commands** (`prisma migrate`, `prisma generate`) were named and approved separately, as the rules require. No `docker compose` command was needed because the database was already running.
- **Check the tooling before the last step.** The push worked but `gh` was not authenticated, so the PR needed a manual step. Run `gh auth status` before the end of the next feature.

### Improvements to consider

- **Security and product**
  - Write the revocation spec next (logout and reuse detection), with an absolute cap on a family's lifetime, since sliding expiry lets a stolen chain rotate forever.
  - Rate-limit `/auth/login` and `/auth/refresh`: both are open to brute force and out of scope in every spec so far.
  - Add the expired-row cleanup job: the table grows on every login and refresh.
  - Refresh token format: the JWT is a reasonable choice, not a mistake, but it adds little here. We look the row up in the database on every refresh, so the stateless benefit is unused, while it costs a second secret, algorithm pinning and payload validation. An opaque `id.secret` token would be slightly simpler. Revisit in the revocation spec, which touches the same table. The access token stays a JWT.
- **Testing**
  - Run e2e tests against a dedicated test database instead of the local dev one (approval-gated setup, own step).
  - Add one `generateMockTokenHash()` helper: the same 64-hex expression is repeated in the e2e spec and in the mock helpers.
  - Exclude constructor decorator-metadata branches from coverage, so the branch number (81.81%) reflects real gaps.
  - Add to `testing.md`: test behavior and the arguments that matter, not every internal call.
- **Workflow**
  - Gate review by risk: both stops for security-critical steps (issuer, `rotate`, the rotate use case), one stop for plumbing steps.
  - Add a preflight to each plan: `gh auth status`, database running, env vars present.
  - Keep the "list what each call can throw or return" check in auth reviews.
