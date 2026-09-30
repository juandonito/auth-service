# auth-service

Standalone authentication/authorization microservice built with NestJS, designed to be reused across future projects.

## Stack

- NestJS + TypeScript, package manager: pnpm (always via `pnpm exec`, never `pnpm dlx`)
- PostgreSQL 18, Prisma ORM 7 (config lives in `prisma7.config.ts`, not `schema.prisma`)
- Docker + Docker Compose for local dev

## Commands

- test: `pnpm run test`
- test with coverage: `pnpm run test:cov`

## Permissions

- Never run package installs (`pnpm add`/`install`/`remove`), database migrations (`prisma migrate *`, `prisma db *`), `prisma generate`, or `docker compose` without asking first. Name the exact command and wait for approval. Approving a plan doesn't count as approving these commands.
- Commits and pushes only when asked.

## Structure

- Layers: controller → usecase → repository. Controllers handle HTTP only. Usecases hold business logic, one per action. Repositories are the only place that touches Prisma.
- Services hold reusable helpers that are neither a business action nor persistence (e.g. `PasswordHasherService`, `TokenIssuerService`). They live in the `services/` folder of the domain that owns them. Every business class is either a usecase or a service.
- One NestJS module per domain under `src/<domain>/`. A module exports what other modules need (e.g. `UsersModule` exports `UserRepository`).
- Shared infrastructure lives in `src/common/` (`@Global() CommonModule`), e.g. `database/prisma.service.ts`.

```
src/
├─ common/   common.module.ts, database/prisma.service.ts, decorators/, errors/, filters/
├─ users/    users.module.ts, repositories/, services/, usecases/, dto/, errors/
└─ auth/     auth.module.ts, auth.controller.ts, usecases/, services/, dto/, errors/
```

## Imports

- Cross-module imports use path aliases instead of relative `../../` traversal: `@common/*`, `@users/*`, `@auth/*`, `@generated/*`, `@test/*`. Defined in `tsconfig.json`'s `compilerOptions.paths`.
- Within the same module, keep plain relative imports.

## Naming conventions

- Files: kebab-case with a type suffix: `*.module.ts`, `*.controller.ts`, `*.usecase.ts`, `*.repository.ts`, `*.service.ts` (any domain), `*.dto.ts`, `*.error.ts`, plus `*.decorator.ts` and `*.filter.ts` in `common/`.
- Classes: PascalCase + matching suffix: `RegisterUserUseCase`, `UserRepository`, `PasswordHasherService`, `RegisterDto`, `EmailAlreadyExistsError`.
- Usecases: verb + noun, exposing a single `execute()` method.
- Repositories: singular model name. Methods read like the query (`create`, `findByEmail`) and never return `passwordHash` unless the name says so (e.g. `findByEmailWithPasswordHash`).
- Folders: domain modules are plural nouns (`users/`, `auth/`), with sub-folders grouped by layer (`usecases/`, `services/`, `repositories/`, `dto/`, `errors/`). A module's controller sits at the module root (`auth/auth.controller.ts`).
- Tests: `<file>.spec.ts` next to the file; e2e in `test/<domain>.e2e-spec.ts`.
- Prisma: models PascalCase singular, fields camelCase. Env vars: UPPER_SNAKE_CASE.

## Environment variables

- Always read env vars through `ConfigService`, never raw `process.env`.
- Required vars with no safe default (e.g. `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`) must use `configService.getOrThrow(...)` so the app fails fast rather than silently continuing with `undefined`.
- Optional vars with a sensible default (e.g. `PORT`) use `configService.get('X', default)`, not `process.env.X ?? default`.

## Rules

@.claude/rules/testing.md
@.claude/rules/database.md
@.claude/rules/workflow.md
