# Plan: 003 JWT refresh (rotation)

Implements [SPEC.md](./SPEC.md). Follows `.claude/rules/workflow.md`:

- Every behavior step has **two review checkpoints**: after the tests are written (red), then after the implementation (green). Never roll from one to the next without review.
- Commit only when asked. Before presenting a checkpoint, read the diff against `CLAUDE.md` and `.claude/rules/` and fix deviations.
- Approval-gated commands (`prisma migrate`, `prisma generate`, `docker compose`) are named exactly and run only after approval.

## Design

The `RefreshToken` table lives in the `auth` domain and is touched only through a new `RefreshTokenRepository` in `auth/repositories/`.

| Piece                                                | Location               | Role                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RefreshToken` model + `User.refreshTokens` relation | `prisma/schema.prisma` | spec schema, `onDelete: Cascade`                                                                                                                                                                                                                                                                                                                                                                      |
| `InvalidRefreshTokenError`                           | `auth/errors/`         | the single 401 error, mapped in `STATUS_BY_ERROR`                                                                                                                                                                                                                                                                                                                                                     |
| `TokenHasherService`                                 | `auth/services/`       | `hash(token)` is SHA-256 hex. `matches(token, storedHash)` compares 32-byte digest buffers with `timingSafeEqual`; a wrong-length stored hash returns `false`                                                                                                                                                                                                                                         |
| `RefreshTokenIssuerService`                          | `auth/services/`       | `issue(userId, familyId?)` generates `id` with `randomUUID()`, signs `{sub}` with `jwtid: id`, `JWT_REFRESH_SECRET`, HS256 and the TTL, decodes `exp` to get `expiresAt`, hashes, and returns `{id, familyId, token, tokenHash, expiresAt}` without touching the DB. `verify(token)` pins HS256, validates that `sub` and `jti` are strings, and converts every failure to `InvalidRefreshTokenError` |
| `RefreshTokenRepository`                             | `auth/repositories/`   | `create`, `findByIdWithTokenHash`, `rotate(oldId, newRow): Promise<boolean>`                                                                                                                                                                                                                                                                                                                          |
| `UserRepository.findById`                            | `users/repositories/`  | returns a `PublicUser`, never `passwordHash`                                                                                                                                                                                                                                                                                                                                                          |
| `RotateRefreshTokenUseCase`                          | `auth/usecases/`       | the processing order from the spec                                                                                                                                                                                                                                                                                                                                                                    |
| `LoginUserUseCase`                                   | `auth/usecases/`       | now also issues and persists a refresh token                                                                                                                                                                                                                                                                                                                                                          |
| `POST /auth/refresh` + `RefreshDto`                  | `auth/`                | `@HttpCode(200)`                                                                                                                                                                                                                                                                                                                                                                                      |
| `AuthTokensDto`, refresh payload and row DTOs        | `auth/dto/`            | named types, not inline                                                                                                                                                                                                                                                                                                                                                                               |

**Keeping `exp` equal to `expiresAt`:** the service signs with `expiresIn`, then reads `exp` back from the signed token. One source of truth, no parsing of `'7d'`, no new dependency.

**Fail-fast config:** `RefreshTokenIssuerService` reads `JWT_REFRESH_SECRET` and `JWT_REFRESH_EXPIRES_IN` with `getOrThrow` in its constructor (no silent default for a security setting).

## Progress

- [x] **Step 1: Schema, migration, env** (approval-gated: `prisma migrate dev`, `prisma generate`)
  - [x] `RefreshToken` model and `User.refreshTokens` relation
  - [x] `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` in `.env`, `.env.exemple`, CI and docker-compose env
  - [x] Migration applied and client generated (after approval)
- [x] **Step 2: `InvalidRefreshTokenError` and filter mapping**
  - [x] Tests (filter spec asserts the 401 body)
  - [x] Implementation
- [x] **Step 3: `TokenHasherService`**
  - [x] Tests (hash, match, mismatch, wrong-length stored hash, non-hex)
  - [x] Implementation + `.mock.ts`
- [x] **Step 4: `RefreshTokenIssuerService`**
  - [x] Tests (`issue`, `expiresAt` = `exp`, `familyId`, `verify` rejections, fail-fast config)
  - [x] Implementation, DTOs, `.mock.ts`, `jwt-service.mock.ts` update
- [x] **Step 5: Repositories**
  - [x] Tests (`RefreshTokenRepository` create/findByIdWithTokenHash/rotate, `UserRepository.findById`)
  - [x] Implementation, `.mock.ts` files, `prisma.service.mock.ts`, `test/mock/refresh-token.mock.ts`
- [x] **Step 6: Login issues and persists a refresh token**
  - [x] Tests (usecase, controller spec, login e2e)
  - [x] Implementation (`LoginUserUseCase`, `AuthTokensDto`, wiring)
- [x] **Step 7: `RotateRefreshTokenUseCase`**
  - [x] Tests (one per spec branch, plus happy path)
  - [x] Implementation + `.mock.ts`
- [x] **Step 8: `POST /auth/refresh` and wiring**
  - [x] Tests (controller, `RefreshDto` validation)
  - [x] Implementation (`RefreshDto`, route, `AuthModule` providers)
- [x] **Step 9: E2E** (approval-gated: `docker compose`)
  - [x] `test/auth-refresh.e2e-spec.ts` covering every success criterion, including the concurrent-refresh race
  - [x] Suite green against real Postgres (after approval)
- [ ] **Step 10: Final checks**
  - [ ] `pnpm run test:cov` meets thresholds (90/90/90, branches 75)
  - [ ] Final diff read against `CLAUDE.md` and `.claude/rules/`
  - [ ] SPEC.md Recap left for after the PR

## Steps

### Step 1: Schema, migration, env (approval-gated, no TDD)

- Add the `RefreshToken` model and the `User` relation.
- Add `JWT_REFRESH_SECRET` and `JWT_REFRESH_EXPIRES_IN` to `.env` and `.env.exemple`.
- Check whether the CI workflow and the e2e setup define env vars, and add the new ones there.
- Needs approval for the exact `prisma migrate dev` and `prisma generate` commands (with `--config prisma7.config.ts` if required). Named when reached.

### Step 2: `InvalidRefreshTokenError` and the filter mapping

- **Tests:** extend `domain-exception.filter.spec.ts` to assert the body is `{statusCode: 401, error: 'Unauthorized', message: 'invalid refresh token'}`.
- **Implementation:** the error class and the `STATUS_BY_ERROR` entry.

### Step 3: `TokenHasherService`

- **Tests:** stable 64-hex hash, match, mismatch, wrong-length stored hash returns `false` without throwing, non-hex input.
- **Implementation:** the service and its `.mock.ts`.

### Step 4: `RefreshTokenIssuerService`

- **Tests:**
  - `issue` signs with the refresh secret, HS256 and `jwtid` equal to the returned `id`
  - `expiresAt` equals the token's `exp`
  - a new `familyId` is generated when none is passed, and a passed one is kept
  - the returned `tokenHash` is the hash of the signed token
  - `verify` rejects a bad signature, wrong algorithm, expired token and malformed payload, each with `InvalidRefreshTokenError`
  - construction throws without `JWT_REFRESH_SECRET`
- **Implementation:** the service, its DTOs and `.mock.ts`. Extend `test/mock/jwt-service.mock.ts` with `verifyAsync`.

### Step 5: Repositories

- **Tests (mocked Prisma):**
  - `RefreshTokenRepository.create` and `findByIdWithTokenHash`
  - `rotate`: the conditional `updateMany` (`id` and `revokedAt: null`) sets `revokedAt` and `replacedBy`, and the insert runs in the same `$transaction`; when the count is 0 it returns `false` and does not insert
  - `UserRepository.findById` returns a `PublicUser` or `null`
- **Implementation:** both repositories and their `.mock.ts` files. Extend `prisma.service.mock.ts` (`refreshToken` delegate, `$transaction`). Add `test/mock/refresh-token.mock.ts` with `generateMockRefreshToken(overrides?)`.

### Step 6: Login issues and persists a refresh token

- **Tests:**
  - the response is `{accessToken, refreshToken}`
  - the persisted row holds the hash and a new `familyId`
  - the token is signed before the insert
  - failure paths are unchanged and create no row
  - update `auth.controller.spec.ts` and `test/auth-login.e2e-spec.ts` for the new field
- **Implementation:** `LoginUserUseCase`, `AuthTokensDto`, the controller's return type and module wiring.

### Step 7: `RotateRefreshTokenUseCase`

- **Tests:** one per spec branch, in processing order:
  - verify failure
  - unknown `jti`
  - hash mismatch
  - already used
  - `expiresAt` in the past
  - user missing
  - lost race (`rotate` returns `false`)
  - a hash mismatch on a validly signed token logs an error (with the token's `jti`, never the token) and still answers 401, since it means a corrupt row or a leaked signing secret
  - happy path: same `familyId`, signing happens before `rotate`, and the new access token carries the user's current role
- **Implementation:** the use case and its `.mock.ts`.

### Step 8: Endpoint and wiring

- **Tests:** `POST /auth/refresh` returns 200; `RefreshDto` validation (missing, empty, extra field).
- **Implementation:** `RefreshDto`, the controller route, and `AuthModule` providers. `JwtModule` stays registered with `JWT_SECRET` only; refresh calls pass their own `secret`, `algorithms` and `expiresIn`.

### Step 9: E2E (needs Docker Compose approval)

`test/auth-refresh.e2e-spec.ts` against real Postgres:

- hash stored in the DB, not the token
- same `familyId`, with `revokedAt` and `replacedBy` set on the old row
- chained refresh, and different `familyId`s for two logins
- second use gets 401
- **two concurrent refreshes: exactly one wins, and no extra row is written**
- tampered, expired, wrong-secret and wrong-algorithm tokens
- an access token sent to `/auth/refresh`
- a deleted user
- a role change is picked up by the next refresh
- identical 401 bodies
- no `tokenHash` or `passwordHash` in any response
- (the app failing to start without `JWT_REFRESH_SECRET` or `JWT_REFRESH_EXPIRES_IN` is covered by the `RefreshTokenIssuerService` unit tests of Step 4, not here)

The exact `docker compose` command is named for approval when reached.

### Step 10: Final checks

- `pnpm run test:cov` against the thresholds (statements/lines/functions 90%, branches 75%).
- A last diff read against `CLAUDE.md` and `.claude/rules/` (naming, aliases, mock locations).
- The Recap in `SPEC.md` stays empty until after the PR.

## What can throw or return unexpectedly

Everything an attacker can influence ends in the same 401.

| Call                                | Unexpected outcome                                            | Handling                                                   |
| ----------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| `verifyAsync`                       | bad signature, wrong algorithm, expired or malformed          | caught in `verify`, rethrown as `InvalidRefreshTokenError` |
| payload shape                       | `sub` or `jti` missing or not a string                        | explicit check, then `InvalidRefreshTokenError`            |
| `findByIdWithTokenHash`             | `null` (unknown, or user deleted by cascade)                  | `InvalidRefreshTokenError`                                 |
| `matches`                           | a wrong-length stored hash would make `timingSafeEqual` throw | returns `false`, so it is a mismatch and a 401             |
| `revokedAt` set or `expiresAt` past |                                                               | `InvalidRefreshTokenError`                                 |
| `UserRepository.findById`           | `null` in a race                                              | `InvalidRefreshTokenError`                                 |
| `rotate`                            | `false` when the race is lost, with no insert                 | `InvalidRefreshTokenError`                                 |
| DB or signing errors                | not caused by user input                                      | propagate as 500, the same for every caller                |

## Decisions

1. **The use case is `RotateRefreshTokenUseCase`**, not `RefreshTokenUseCase`, which reads like it manages the entity.
2. **No separate "create refresh token" use case.** Login's persistence is one repository call and rotation needs its own transaction, so a shared use case would not be shared.
3. **`rotate` returns a boolean** and the use case throws the domain error, so the repository stays free of auth semantics.
4. **No new dependencies.** Hashing uses `node:crypto`.
