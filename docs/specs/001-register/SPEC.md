# spec: Register User

## GOAL

Users can create an account

## In scope

- `POST /auth/register` - email + password -> creates a User, returns access token
- passswords should be hashed with argon2
- passwords should be at least 9 caracters (9 included), contain 1 >= number, 1 >= uppercase, 1 >= lowercase
- duplicate email registration handled gracefully (no raw 500)

## Out of scope (future specs)

- Refresh token handeling
- RBAC guards (seperate specs)
- OAuth2 / social login
- Rate limiting

## Succes criteria

- [x] Registering with a new emai lcreates a User row, `passwordHash` is never plaintext uncrypted password
- [x] Registering with an existing email returns a clear 409, not 500
- [x] No response body ever contains `passwordHash`
- [x] User created has ROLE `USER` by default

## Recap

Implementation shipped in PR #4 (`feature/001-register-user`), all 4 success criteria met and e2e-tested. Notes for future specs, from friction hit along the way:

**Architecture**
- The first pass put user-creation logic (hash password, persist) directly inside the registration orchestration usecase. Review feedback split this into `CreateUserUseCase` (users domain: hash + persist) and `RegisterUserUseCase` (auth domain: thin orchestrator that calls `CreateUserUseCase` then signs the JWT). **Lesson**: for any endpoint that both creates a resource and does something else with it (issue a token, send an email, etc.), plan for two usecases from the start — one owning the resource's business logic, one orchestrating the surrounding flow — rather than merging them and splitting later.
- `PasswordHasher` started in `auth/services/` but had to move to `users/services/` once `CreateUserUseCase` needed it, to avoid a circular `AuthModule` ↔ `UsersModule` import. **Lesson**: a service used only to prepare data for persistence (hashing, normalizing, etc.) belongs in the domain that owns that data, not the domain that happens to be the first caller.
- Input/output types were originally inline `Pick<>`/one-off interfaces (`RegisterResult`, anonymous repository params). Review feedback asked for named, reusable DTOs (`PublicUser`, `CreateUserDto`, `AccessTokenDto`). **Lesson**: name and place these DTOs upfront (usecase input/output, repository input/output) instead of inlining them — it's the first thing that comes back in review.

**Naming**
- CLAUDE.md's own naming-conventions section already gave `RegisterUserUseCase` as the example class name, but the actual code shipped as `RegisterUseCase`. **Lesson**: when a naming convention doc already gives a concrete example name, grep for it during self-review before opening the PR — the mismatch was caught by a reviewer instead of before.

**Test conventions**
- The original rule ("class doubles live in `test/mock/`") turned out to be incomplete once the project grew: it didn't distinguish mocks of our own classes from mocks of third-party classes (`ConfigService`, `JwtService`, `ArgumentsHost`). Clarified mid-project: our own usecases/repositories/services get a colocated `<file>.mock.ts`; entities/data and third-party class doubles stay centralized in `test/mock/`. **Lesson**: write the mock-location rule with this distinction from day one — "colocate ours, centralize the rest" — to avoid a repo-wide mock-shuffling PR later.

**Coverage tooling**
- `emitDecoratorMetadata` (required for NestJS DI) makes TypeScript emit an unreachable `typeof X !== "undefined"` guard branch for every constructor-injected dependency. Istanbul counts it as an uncoverable branch, and `/* istanbul ignore next */` cannot suppress it (verified by hand-transpiling — the guard is emitted in a synthetic call after the whole class, with no corresponding source line to attach a comment to). **Lesson**: don't chase 100% branch coverage in a NestJS+ts-jest project; budget for this by setting the `branches` threshold a bit below the others (`statements`/`functions`/`lines`) instead of one flat number.
- `*.module.ts` wiring files (pure `@Module({...})` decorators, no logic) sat at 0% coverage and dragged down statements/lines project-wide, since only e2e tests exercise them. Excluding them from `collectCoverageFrom` fixed this cleanly. **Lesson**: exclude module-wiring files from coverage from the start, rather than discovering the threshold failure once the codebase has enough of them to matter.
- Running `pnpm exec jest` directly intermittently fails on `@nestjs/testing`'s ESM build ("Must use import to load ES Module"), while the project's own `pnpm run test`/`test:cov` scripts (which pass `node --experimental-vm-modules`) always work. **Lesson**: always use the project's npm scripts to run tests, never call `jest`/`pnpm exec jest` directly in this repo.

**Process**
- No `gh` CLI was available locally, so PR review comments were fetched directly via the GitHub REST API (`api.github.com/repos/.../pulls/4/comments`) instead. Works fine for read-only lookups without auth on a public repo, but PR creation still needs `gh` or the web UI.
- Extracting `CreateUserUseCase` and renaming `RegisterUseCase` couldn't be committed as two fully independent steps: moving `PasswordHasher` (part of the extraction) immediately breaks the old usecase's import, so the two had to land in one commit. **Lesson**: when splitting a class's responsibilities into two usecases that share a dependency, expect the extraction and the rename/rewire of the original to be one atomic change, not two.
