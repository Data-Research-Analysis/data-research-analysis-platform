# Setup

The repository contains:
* `docker` for local development
* `backend`, the API built in TypeScript and NodeJS
* `frontend`, the application built in Vue3/Nuxt3

## Quick Start (Automated Setup - Recommended)

The platform includes an automated setup CLI that handles environment configuration, Docker orchestration, and database initialization.

### One-Command Setup

```bash
npm run setup
```

This interactive wizard will:
1. Generate environment files (`.env`) for root, backend, and frontend
2. Create required Docker volumes
3. Build and start Docker containers
4. Run database migrations
5. Seed the database with test data

### Express Setup (Skip Prompts)

For quick setup with sensible defaults:

```bash
npm run setup:express
```

## CLI Command Reference

### Setup Modes

| Command | Description |
|---------|-------------|
| `npm run setup` | Full interactive setup (config + Docker + database) |
| `npm run setup:express` | Express mode with minimal prompts |
| `npm run setup:config` | Generate .env files only (skip Docker) |
| `npm run setup:docker` | Docker operations only (skip config) |
| `npm run setup:update` | Update existing configuration |

### Docker Operations

| Command | Description |
|---------|-------------|
| `npm run setup:down` | Stop and remove all containers |
| `npm run setup:rebuild` | Rebuild Docker images and restart |
| `docker-compose restart` | Restart all services |
| `docker-compose restart backend` | Restart backend service only |

### Database Operations

| Command | Description |
|---------|-------------|
| `npm run setup:migrate` | Run database migrations |
| `npm run setup:seed` | Run database seeders |

Migrations and seeders are automatically executed during initial setup, but can be run manually if needed.

### Health & Monitoring

| Command | Description |
|---------|-------------|
| `npm run setup:health` | Run comprehensive health check |
| `npm run setup:validate` | Validate .env file completeness |
| `npm run setup:status` | Show status of all services |

### Service Management

#### View Service Status

```bash
npm run setup:status
```

Shows real-time status of all 6 services:
- backend
- frontend
- database
- redis
- mysql-test
- mariadb-test

#### Restart Individual Service

```bash
node setup-cli.js --restart backend
node setup-cli.js --restart frontend
node setup-cli.js --restart database
```

#### View Service Logs

```bash
# View last 100 lines (default)
node setup-cli.js --logs backend

# View last N lines
node setup-cli.js --logs backend --tail 50

# Follow logs in real-time
node setup-cli.js --logs backend --follow
node setup-cli.js --logs frontend --follow --tail 100
```

Available services: `backend`, `frontend`, `database`, `redis`, `mysql-test`, `mariadb-test`

### Advanced Options

| Flag | Description |
|------|-------------|
| `--help`, `-h` | Show help message with all options |
| `--skip-migrations` | Skip database migrations during setup |
| `--skip-seeders` | Skip database seeders during setup |
| `--dry-run` | Preview what would happen without making changes |
| `--remove-config` | Remove .env files during teardown |

### Common Workflows

#### First-Time Setup

```bash
# 1. Clone repository
git clone https://github.com/Data-Research-Analysis/data-research-analysis-platform.git
cd data-research-analysis-platform

# 2. Add hosts entries (see Manual Setup section below)

# 3. Run automated setup
npm run setup

# 4. Access the application
# Frontend: http://frontend.dataresearchanalysis.test:3000
# Backend: http://backend.dataresearchanalysis.test:3002
```

#### Reset and Rebuild

```bash
# Stop everything
npm run setup:down

# Rebuild and restart
npm run setup:rebuild
```

#### Troubleshooting

```bash
# Check system health
npm run setup:health

# Validate environment files
npm run setup:validate

# Check service status
npm run setup:status

# View backend logs
node setup-cli.js --logs backend --tail 100

# Restart a problematic service
node setup-cli.js --restart backend
```

#### Database Management

```bash
# Run migrations only
npm run setup:migrate

# Run seeders only
npm run setup:seed

# Re-run migrations (inside backend container)
docker exec backend.dataresearchanalysis.test npm run migration:revert
docker exec backend.dataresearchanalysis.test npm run migration:run
```

### Environment Configuration

The setup CLI generates three `.env` files:

1. **Root `.env`** - Docker and PostgreSQL configuration
2. **`backend/.env`** - Backend server and database settings
3. **`frontend/.env`** - Frontend Nuxt3 application settings

All sensitive values (JWT secrets, encryption keys) are automatically generated with cryptographically secure random values.

#### Required Environment Variables

**Root:**
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `REDIS_PASSWORD`

**Backend:**
- Database: `POSTGRESQL_HOST`, `POSTGRESQL_PORT`, `POSTGRESQL_USERNAME`, `POSTGRESQL_PASSWORD`, `POSTGRESQL_DB_NAME`
- Security: `JWT_SECRET`, `ENCRYPTION_KEY`, `PASSWORD_SALT`
- Server: `NODE_ENV`, `PUBLIC_BACKEND_URL`, `FRONTEND_URL`, `PORT`

**Frontend:**
- `NUXT_API_URL` - Backend API endpoint
- `RECAPTCHA_SITE_KEY` - Google reCAPTCHA site key

### Docker Volumes

The setup CLI automatically creates required external volumes:
- `data_research_analysis_postgres_data` - PostgreSQL database data
- `data_research_analysis_redis_data` - Redis cache data

**Important:** External volumes are never automatically deleted. To manually remove:

```bash
docker volume ls  # List all volumes
docker volume rm data_research_analysis_postgres_data
docker volume rm data_research_analysis_redis_data
```

### Pre-flight Validation

Before starting services, validate your environment:

```bash
npm run setup:validate
```

This checks:
- All required `.env` files exist
- All required environment variables are present
- No placeholder values (like "changeme") remain
- Provides specific remediation steps for issues found

### Getting Help

```bash
# Show all available commands and options
node setup-cli.js --help

# Or simply
npm run setup -- --help
```

---

## Manual Setup (Alternative)

If you prefer manual setup or need to customize the process, follow the platform-specific instructions below.

## Windows Setup
1. Add `127.0.0.1 frontend.dataresearchanalysis.test backend.dataresearchanalysis.test` to your hosts file `c:\windows\system32\drivers\etc\hosts` (https://www.howtogeek.com/howto/27350/beginner-geek-how-to-edit-your-hosts-file/).
2. Clone the repository `https://github.com/Data-Research-Analysis/data-research-analysis-platform.git`.
3. Copy `backend/.env.example` to `backend/.env` and update any missing values as necessary.
4. Copy `frontend/.env.example` to `frontend/.env` and update any missing values as necessary.
5. If the volume named `data_research_analysis_postgres_data` is not present in your docker volumes, then you need to create this volume by running the following command `docker volume create data_research_analysis_postgres_data`. This is essential or the project will not build because it is required that the volume be present when the project is built.
6. `cd data-research-analysis-platform` then `docker-compose build`.
7. Once it is done building, run: `docker-compose up`.
8. In a new terminal window/tab run `cd data-research-analysis-platform/backend`.
9. Run `npm run typeorm migration:generate ./src/migrations/CreateTables -- -d ./src/datasources/PostgresDSMigrations.ts` to generate the migration file that creates tables file from the data models. Only run this command if the migration file create tables migration file is not present.
10. Run `npm run typeorm migration:run -- -d ./src/datasources/PostgresDSMigrations.ts` to run the migrations.
11. After the migrations have been completed then run `npm run seed:run -- -d ./src/datasources/PostgresDSMigrations.ts src/seeders/*.ts` to run the seeders.
12. Now visit https://online.studiesw.test:3000 in your browser!
13. To revert the migrations run the command `npm run typeorm migration:revert -- -d ./src/datasources/PostgresDSMigrations.ts`

## Ubuntu Setup
1. Add `127.0.0.1 online.studiesw.test online-api.studiesw.test online-redis.studiesw.test online-db.studiesw.test` to your hosts file `~/etc/hosts`.
2. Clone the repository `https://github.com/Data-Research-Analysis/data-research-analysis-platform.git`.
3. Copy `backend/.env.example` to `backend/.env` and update any missing values as necessary.
4. Copy `frontend/.env.example` to `frontend/.env` and update any missing values as necessary.
5. If the volume named `data_research_analysis_postgres_data` is not present in your docker volumes, then you need to create this volume by running the following command `docker volume create data_research_analysis_postgres_data`. This is essential or the project will not build because it is required that the volume be present when the project is built.
6. Open the project directory in the terminal and run: `docker-compose build`.
7. Once it is done run: `docker-compose up`.
8. In a new terminal window/tab run `cd data-research-analysis-platform/backend`.
9. Run `npm run typeorm migration:generate ./src/migrations/CreateTables -- -d ./src/datasources/PostgresDSMigrations.ts` to generate the migration file that creates tables file from the data models. Only run this command if the migration file create tables migration file is not present.
10. Run `npm run typeorm migration:run -- -d ./src/datasources/PostgresDSMigrations.ts` to run the migrations.
11. After the migrations have been completed then run `npm run seed:run -- -d ./src/datasources/PostgresDSMigrations.ts src/seeders/*.ts` to run the seeders.
12. Now visit https://online.studiesw.test:3000 in your browser!
13. To revert the migrations run the command `npm run typeorm migration:revert -- -d ./src/datasources/PostgresDSMigrations.ts`

## Test User Credentials

On the local instance the following are the login credentials:

* Admin
    * Username: `testadminuser@dataresearchanalysis.com`
    * Password: `testuser`
* Normal Member
    * Username: `testuser@dataresearchanalysis.com`
    * Password: `testuser`
