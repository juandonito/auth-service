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
- One NestJS module per domain under `src/<domain>/`. A module exports what other modules need (e.g. `UsersModule` exports `UserRepository`).
- Shared infrastructure lives in `src/common/` (`@Global() CommonModule`), e.g. `database/prisma.service.ts`.

```
src/
├─ common/   common.module.ts, database/prisma.service.ts
├─ users/    users.module.ts, repositories/, errors/
└─ auth/     auth.module.ts, controllers/, usecases/, dto/
```

## Naming conventions

- Files: kebab-case with a type suffix: `*.module.ts`, `*.controller.ts`, `*.usecase.ts`, `*.repository.ts`, `*.service.ts` (common only), `*.dto.ts`, `*.error.ts`.
- Classes: PascalCase + matching suffix: `RegisterUserUseCase`, `UserRepository`, `RegisterDto`, `EmailAlreadyExistsError`.
- Usecases: verb + noun, exposing a single `execute()` method.
- Repositories: singular model name. Methods read like the query (`create`, `findByEmail`) and never return `passwordHash` unless the name says so.
- Folders: domain modules are plural nouns (`users/`, `auth/`), with sub-folders grouped by layer (`controllers/`, `usecases/`, `repositories/`, `dto/`, `errors/`).
- Tests: `<file>.spec.ts` next to the file; e2e in `test/<domain>.e2e-spec.ts`.
- Prisma: models PascalCase singular, fields camelCase. Env vars: UPPER_SNAKE_CASE.

## Rules

@.claude/rules/testing.md
@.claude/rules/database.md
