# Auth Service

A standalone authentication and authorization microservice built with NestJS. Designed to be reused as an independent building block across microservice architectures.

## 🎯 Purpose

This service handles registration, login, and access control (roles) for other applications, via JWT tokens. It's built to be deployed and consumed independently by multiple projects.

## 🛠️ Tech stack

- **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
- **Package manager**: [pnpm](https://pnpm.io/) `12.4.2`
- **Database**: PostgreSQL 16
- **ORM**: Prisma _(coming soon)_
- **Authentication**: JWT (access + refresh tokens) _(coming soon)_
- **Containerization**: Docker & Docker Compose
- **Testing**: Jest
- **CI/CD**: GitHub Actions _(coming soon)_

## 📋 Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [Node.js](https://nodejs.org/) 20+ (for local development outside containers, optional)
- [pnpm](https://pnpm.io/installation) `12.4.2` (if developing outside a container)

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

| Variable       | Description               | Example                                         |
| -------------- | ------------------------- | ----------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://authuser:authpass@db:5432/authdb` |

These variables are already configured in `docker-compose.yml` for local development. For a real deployment, they must be supplied by the target environment (never commit real sensitive values).

## 📦 Available scripts

| Command              | Description                                        |
| -------------------- | -------------------------------------------------- |
| `pnpm run start`     | Starts the application                             |
| `pnpm run start:dev` | Starts the application in watch mode (auto-reload) |
| `pnpm run build`     | Compiles the TypeScript project                    |
| `pnpm run test`      | Runs unit tests                                    |
| `pnpm run test:e2e`  | Runs end-to-end tests                              |
| `pnpm run test:cov`  | Runs tests with a coverage report                  |
| `pnpm run lint`      | Lints the code with ESLint                         |

## 🏗️ Local development without Docker

If you'd rather work directly with pnpm instead of rebuilding the image on every change:

```bash
pnpm install
```

Start only the database via Docker:

```bash
docker compose up db
```

Then run the API locally:

```bash
pnpm run start:dev
```

## 📁 Project structure

```
auth-service/
├── src/
│   ├── main.ts              # Application entry point
│   ├── app.module.ts         # Root module
│   └── ...                   # Upcoming modules (auth, users)
├── test/                     # End-to-end tests
├── docker-compose.yml         # API + Postgres orchestration
├── Dockerfile                 # Production image for the API
├── pnpm-workspace.yaml         # pnpm configuration (allowBuilds)
└── package.json
```

_This section will be updated as the `auth` and `users` modules are added, along with the Prisma integration._

## 🗺️ Roadmap

- [x] NestJS scaffolding + Dockerfile
- [x] Docker Compose (API + PostgreSQL)
- [x] Prisma integration + database schema
- [x] basic CI/CD pipeline
- [ ] `register` / `login` endpoints with password hashing
- [ ] JWT generation and validation (access + refresh tokens)
- [ ] NestJS guards + RBAC (user/admin roles)
- [ ] Protected `/me` endpoint
- [ ] Unit and integration tests
- [ ] CI/CD pipeline (GitHub Actions) with Docker image build and push
- [ ] _(Bonus)_ OAuth2 (Google login)
- [ ] _(Bonus)_ Refresh token revocation
- [ ] _(Bonus)_ Rate limiting on sensitive endpoints

## 📝 License

Personal portfolio project — free to reuse.
