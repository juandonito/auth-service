# Testing

- TDD: write a failing test before implementation code, for every new behavior.
- Unit tests: `*.spec.ts`, no real database — mock Prisma calls.
- E2E tests: `*.e2e-spec.ts`, run against real Postgres (via Docker Compose locally, via CI service container in GitHub Actions).
- Coverage threshold, enforced in CI: statements/lines 90%, functions 90%, branches 75%. `*.module.ts` files are excluded from coverage.
- lint-staged runs `--findRelatedTests` on pre-commit (scoped, fast) — full suite only runs pre-push and in CI, never on every commit.
- Test names follow `should + verb + complement`, e.g. `it('should reject a password without a digit')`.
- Test data comes from `test/mock/`, one file per kind of object (e.g. `user.mock.ts`). Each file exports generators like `generateMockUser(overrides?)` and `generateMockUsersList(count, overrides?)`. Don't write object literals inline in specs.
- Mock data is random, never hardcoded: build it with the helpers in `test/mock/common.mock.ts` (`generateRandomString`, `generateRandomInt`, `generateRandomId`, `generateRandomEmail`, `generateRandomDate`, `pickRandom`). Pin a value through `overrides` only when the test asserts on it.
- Class doubles for our own usecases, repositories, and services are colocated next to the class they mock, as `<file>.mock.ts` (e.g. `user.repository.ts` → `user.repository.mock.ts`). Class doubles for third-party classes (e.g. NestJS's `ConfigService`, `JwtService`, `ArgumentsHost`) live in `test/mock/` as `generateMock<Class>()`. Every mocked method has a default `mockResolvedValue` built from random mock data.
