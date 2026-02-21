# Setup

The repository contains:
* `docker` for local development
* `backend`, the API built in TypeScript and NodeJS
* `frontend`, the application built in Vue3/Nuxt3

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
