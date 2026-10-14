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
| Expiry             | `JWT_EXPIRES_IN` (existing)      | `JWT_REFRESH_EXPIRES_IN` (default `7d`)  |
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
  "message": "Invalid refresh token",
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

| Variable                 | Required               | Purpose                                     |
| ------------------------ | ---------------------- | ------------------------------------------- |
| `JWT_SECRET`             | yes (existing)         | signs/verifies access tokens                |
| `JWT_EXPIRES_IN`         | existing, unchanged    | access token TTL (not renamed in this spec) |
| `JWT_REFRESH_SECRET`     | yes (new)              | signs/verifies refresh tokens               |
| `JWT_REFRESH_EXPIRES_IN` | no (new), default `7d` | refresh token TTL                           |

- Required values are read with `getOrThrow`, so the app refuses to boot if `JWT_REFRESH_SECRET` is missing. The optional TTL is read with `get(..., '7d')`.
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
| Bad signature, wrong algorithm, expired, malformed JWT | 401 "Invalid refresh token"  |
| Valid signature but malformed payload                  | 401 "Invalid refresh token"  |
| Unknown `jti` (includes deleted user) or hash mismatch | 401 "Invalid refresh token"  |
| Token already used                                     | 401 "Invalid refresh token"  |
| User not found at step 6 (race)                        | 401 "Invalid refresh token"  |
| Access token sent to `/auth/refresh`                   | 401 "Invalid refresh token"  |

## Success criteria

- [ ] Login returns `{ accessToken, refreshToken }` and creates a `RefreshToken` row; the stored value is a hash, not the token
- [ ] The row's `expiresAt` equals the refresh token's JWT `exp`
- [ ] `/auth/refresh` with a valid token returns 200 and a new, different pair
- [ ] The token used is marked used (`revokedAt` and `replacedBy` both set) and the new row has the same `familyId`
- [ ] Chained refresh: the refresh token returned by a refresh can itself be refreshed, and the `familyId` is unchanged
- [ ] Two separate logins produce different `familyId`s; a refresh keeps the one of its login
- [ ] Presenting the same refresh token a second time returns 401
- [ ] Two concurrent refreshes with the same token: exactly one succeeds
- [ ] An expired refresh token returns 401
- [ ] A tampered refresh token returns 401
- [ ] A token signed with the wrong secret returns 401
- [ ] A token signed with a different algorithm returns 401
- [ ] A validly signed token with a malformed payload (`sub` or `jti` missing or not a string) returns 401
- [ ] A token with a valid signature and an existing `jti` but a hash mismatch returns 401
- [ ] An access token sent to `/auth/refresh` returns 401
- [ ] Deleted user: their tokens are gone with them and refresh returns 401
- [ ] The "user not found" branch (step 6) returns 401 (unit test, mocked repository)
- [ ] A row whose `expiresAt` is in the past but whose JWT is still valid returns 401 (step 5, unit test, mocked repository)
- [ ] A stored `tokenHash` of the wrong length returns 401, not 500 (unit test)
- [ ] A lost race (conditional update touches 0 rows) writes no new row
- [ ] The refresh token's lifetime is sliding: each refresh issues a token valid for a fresh `JWT_REFRESH_EXPIRES_IN` (see Decisions)
- [ ] All 401 responses have the exact same body
- [ ] The new access token contains `sub` and the user's current `role`
- [ ] If the user's role is changed in the DB after login, the access token issued by the next refresh carries the new role
- [ ] The app fails to start if `JWT_REFRESH_SECRET` is missing
- [ ] Response bodies never contain `tokenHash`, `passwordHash` or any user field

## Known limitations

- **Rotation without reuse detection.** A thief who rotates a stolen token first keeps a working chain, and the legitimate user's next attempt just gets a 401 with nothing revoked. This spec must not ship to production alone: the revocation spec (logout + reuse detection) should follow right after.
- **Table growth.** Every login and every refresh adds a row, and the access token lasts only 15 minutes, so the table grows fast. Expired-row cleanup is out of scope here but is a near-term follow-up.

## Decisions

- **Sliding session lifetime.** Every rotation grants a fresh `JWT_REFRESH_EXPIRES_IN` (7 days), so an active user never has to log in again. The flip side: a stolen chain that keeps rotating never expires either. An absolute per-family cap (for example a `familyExpiresAt` column copied from the first token and checked at every refresh) is deliberately not part of this spec. It is revisited in the revocation spec, since it touches the same table and the same risk.
- **Transport:** JSON body only (see "Transport").
- **Role:** stays in the access token and is re-read from the DB at every refresh.

## Recap

<!-- Filled in after implementation: what shipped (PR, branch), and lessons for future specs, grouped by Architecture / Naming / Test conventions / Process. -->
