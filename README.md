# Auth Service

A standalone authentication and authorization microservice built with NestJS. Designed to be reused as an independent building block across microservice architectures.

## 🎯 Purpose

This service handles registration, login, and access control (roles) for other applications, via JWT tokens. It's built to be deployed and consumed independently by multiple projects.

## 🛠️ Tech stack

- **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
- **Package manager**: [pnpm](https://pnpm.io/)
- **Database**: PostgreSQL 18
- **ORM**: [Prisma](https://www.prisma.io/) 7 (config in `prisma7.config.ts`, schema in `prisma/schema.prisma`)
- **Authentication**: JWT via `@nestjs/jwt` (registration implemented; login and refresh tokens coming soon)
- **Containerization**: Docker & Docker Compose
- **Testing**: Jest (unit + e2e), coverage thresholds enforced in CI
- **Linting/formatting**: oxlint + Prettier, enforced via Husky/lint-staged on commit
- **CI/CD**: GitHub Actions (lint, format check, Prisma migrations, tests, build on every PR)

## 📋 Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [Node.js](https://nodejs.org/) 24+ (for local development outside containers, optional)
- [pnpm](https://pnpm.io/installation) (if developing outside a container)

## 🚀 Quick start

Clone the repo, then start all services (API + database):

```bash
docker compose up --build
```

The API is then available at [http://localhost:3000](http://localhost:3000).

To stop the services:

```bash
docker compose down
```

To stop the services and wipe the database data:

```bash
docker compose down -v
```

## 🔧 Environment variables

| Variable          | Description                              | Example                                         |
| ----------------- | ----------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`    | PostgreSQL connection URL                 | `postgresql://authuser:authpass@db:5432/authdb` |
| `JWT_SECRET`      | Secret used to sign JWTs                  | `change-me`                                     |
| `JWT_EXPIRES_IN`  | Access token expiry                       | `15m`                                            |
| `PORT`            | *(optional, defaults to `3000`)* HTTP port the API listens on | `3000`                    |

`DATABASE_URL`, `JWT_SECRET`, and `JWT_EXPIRES_IN` are already configured in `docker-compose.yaml` for local development. For a real deployment, they must be supplied by the target environment (never commit real sensitive values). See `.env.exemple` for a template.

## 📦 Available scripts

| Command                | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `pnpm run start`        | Starts the application                             |
| `pnpm run start:dev`    | Starts the application in watch mode (auto-reload) |
| `pnpm run start:debug`  | Starts the application in debug + watch mode       |
| `pnpm run start:prod`   | Runs the compiled build (`dist/main.js`)           |
| `pnpm run build`        | Compiles the TypeScript project                    |
| `pnpm run test`         | Runs unit tests                                    |
| `pnpm run test:watch`   | Runs unit tests in watch mode                      |
| `pnpm run test:cov`     | Runs tests with a coverage report                  |
| `pnpm run test:debug`   | Runs unit tests with the Node debugger attached    |
| `pnpm run test:e2e`     | Runs end-to-end tests against a real Postgres      |
| `pnpm run lint`         | Lints the code with oxlint (type-aware)            |
| `pnpm run format`       | Formats `src/` and `test/` with Prettier           |

## 🏗️ Local development without Docker

If you'd rather work directly with pnpm instead of rebuilding the image on every change:

```bash
pnpm install
```

Start only the database via Docker:

```bash
docker compose up db
```

Generate the Prisma client and apply migrations:

```bash
pnpm exec prisma generate --config prisma7.config.ts
pnpm exec prisma migrate deploy --config prisma7.config.ts
```

Then run the API locally:

```bash
pnpm run start:dev
```

## 📁 Project structure

```
auth-service/
├── src/
│   ├── main.ts                # Application entry point
│   ├── app.module.ts          # Root module
│   ├── common/                # Global infrastructure (Prisma service, error filters)
│   ├── users/                 # Users domain (repository, password hashing, create-user usecase)
│   ├── auth/                  # Auth domain (controller, register usecase, DTOs)
│   └── generated/prisma/      # Generated Prisma client (do not edit)
├── prisma/
│   ├── schema.prisma          # Prisma schema (models)
│   └── migrations/            # Prisma migrations
├── prisma7.config.ts          # Prisma 7 config (schema path, migrations, datasource)
├── test/                      # End-to-end tests
├── docker-compose.yaml        # API + Postgres orchestration
├── Dockerfile                 # Production image for the API
├── pnpm-workspace.yaml        # pnpm configuration (allowBuilds)
└── package.json
```

## 🗺️ Roadmap

- [x] NestJS scaffolding + Dockerfile
- [x] Docker Compose (API + PostgreSQL)
- [x] Prisma integration + database schema
- [x] CI/CD pipeline (GitHub Actions: lint, format, migrate, test, build)
- [x] `register` endpoint with password hashing
- [ ] `login` endpoint
- [ ] JWT refresh tokens
- [ ] NestJS guards + RBAC (user/admin roles)
- [ ] Protected `/me` endpoint
- [ ] CI/CD: Docker image build and push
- [ ] _(Bonus)_ OAuth2 (Google login)
- [ ] _(Bonus)_ Refresh token revocation
- [ ] _(Bonus)_ Rate limiting on sensitive endpoints

## 📝 License

Personal portfolio project — free to reuse.
