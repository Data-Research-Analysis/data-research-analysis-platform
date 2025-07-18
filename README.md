# Welcome to Data Research Analysis!
Data Research Analysis Platform allows users to add in their own datasets and then visualize and perform an analysis on them. Think of this similar to Tableu and Power BI.

## Badges

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/) 
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://github.com/Data-Research-Analysis/data-research-analysis-platform/blob/main/CODE_OF_CONDUCT.md)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
[![Express.js](https://img.shields.io/badge/Express.js-%23404d59.svg?logo=express&logoColor=%2361DAFB)](#)
[![Nuxt](https://img.shields.io/badge/Nuxt-002E3B?logo=nuxt&logoColor=#00DC82)](#)
[![Postgres](https://img.shields.io/badge/Postgres-%23316192.svg?logo=postgresql&logoColor=white)](#)
[![Open Source Helpers](https://www.codetriage.com/data-research-analysis/data-research-analysis-platform/badges/users.svg)](https://www.codetriage.com/data-research-analysis/data-research-analysis-platform)

## Changelog

A history of changes have been given in the file CHANGELOG.md (https://github.com/Data-Research-Analysis/data-research-analysis-platform/blob/master/CHANGELOG.md)

## Planned Features
The features that have been marked as check have been implemented while those that are planned to be implemented are marked as unchecked.
#### Completion/In-Progress ####
- [x] is a completed task

- [-] is an in-progress task

- [ ] is a pending task

- [x]  **User Authentication**
- [x]  **User Registration**
- [x]  **Blog Article Publishing System**: Articles for the sole reason to help market the platform will be implemented and admin users will be allowed to write and manage articles that will be published.
    - [x] Add Article (Admin Access)
        - [x] Save Article As Draft (Admin Access)
        - [x] Publish Article (Admin Access)
    - [x] List Articles (Admin Access)
    - [x] Edit Article (Admin Access)
    - [x] Delete Article (Admin Access)
    - [x] Add Category (Admin Access)
    - [x] List Categories (Admin Access)
        - [x] Delete Category (Admin Access)
        - [x] Edit Category (Admin Access)
    - [x] Display Published Article (Public Access)
    - [x] Display List of Published Articles (Public Access)
- [x]  **Projects**: A project is a concept that is being used to group together data and related information of an analysis so that a user can easily manage the multiple analysis that the user will perform on different data sets that may not be related to one another. Having projects allows us to organize the data in neatly packed containers so that the user can easily focus on his/her data analysis activities.
- [-]  **Data Sources**: A data source can be database that contains data that a user wants to bring into the platform to analyse. The aim is to provide support for multiple datasets so that the users can perform all of their analysis in this single platform without having to go back and forth from one software to another.
    - [x] PostgreSQL
    - [ ] MariaDB
    - [ ] MySQL
    - [ ] MongoDB
    - [ ] DuckDB
    - [ ] Excel File
- [x]  **Data Models**: A data model is the representation of the data that the user will build which will then be used for analysis. Essentially raw data will not be saved in the platform's database, but data models will be built which will form the foundation for the analysis that the user will perform.
- [x]  **Data Model Builder**: The data model builder is simple easy to use drag and drop UI based control mechanism that allows the user to build data models. The user can select the columns from multiple tables and even performs auto joins between tables that have a relation between them.
- [-]  **Dashboard**: A dashboard is essentially a collection of visualizations/charts which will help the user tell a story and show the bigger picture.
    - [x] Droppable Text
    - [ ] Table
    - [x] Pie Chart
    - [x] Donut Chart
    - [x] Vertical Bar Chart
    - [x] Horizontal Bar Chart
    - [ ] Vertical Bar Chart With Line
    - [ ] Stacked Bar Chart
    - [ ] Multi-line Chart
    - [ ] Heatmap Chart
    - [ ] Bubble Chart
    - [ ] Stacked Area Chart
    - [ ] Map Chart
- [ ]  **Stories**: Stories or also known as narratives that will help drive the analysis and will help give insights to the user.
- [ ] **Custom Calculated Fields**: The user will be able to create new custom fields which will further aid the user in his/her analysis.
## Setup

The repository contains:
* `docker` for local development
* `backend`, the API built in TypeScript and NodeJS
* `frontend`, the application built in Vue3/Nuxt3

### Windows Setup
1. Add `127.0.0.1 frontend.dataresearchanalysis.test backend.dataresearchanalysis.test` to your hosts file `c:\windows\system32\drivers\etc\hosts` (https://www.howtogeek.com/howto/27350/beginner-geek-how-to-edit-your-hosts-file/).
2. Clone the repository `https://github.com/Data-Research-Analysis/data-research-analysis-platform.git`.
3. Copy `backend/.env.example` to `backend/.env` and update any missing values as necessary.
4. Copy `frontend/.env.example` to `frontend/.env` and update any missing values as necessary.
5. If the volume named `data_research_analysis_postgres_data` is not present in your docker volumes, then you need to create this volume by running he following command `docker volume create data_research_analysis_postgres_data`. This is essential or the project will not build because it is required that the volume be present when the project is built.
6. `cd data-research-analysis-platform` then `docker-compose build`.
7. Once it is done building, run: `docker-compose up`.
8. In a new terminal window/tab run`cd data-research-analysis-platform/backend`. 
9. Run `npm run typeorm migration:generate ./src/migrations/CreateTables -- -d ./src/datasources/PostgresDSMigrations.ts` to generate the migration file that creates tables file from the data models. Only run this command if the migration file create tables migration file is not present.
10. Run `npm run typeorm migration:run -- -d ./src/datasources/PostgresDSMigrations.ts` to run the migrations.
11. After the migrations have been completed then run `npm run seed:run -- -d ./src/datasources/PostgresDSMigrations.ts src/seeders/*.ts` to run the seeders. 
12. Now visit https://online.studiesw.test:3000 in your browser!
13. To revert the migrations run the command `npm run typeorm migration:revert -- -d ./src/datasources/PostgresDSMigrations.ts`


### Ubuntu Setup
1. Add `127.0.0.1 online.studiesw.test online-api.studiesw.test online-redis.studiesw.test online-db.studiesw.test` to your hosts file `~/etc/hosts`.
2. Clone the repository `https://github.com/Data-Research-Analysis/data-research-analysis-platform.git`.
3. Copy `backend/.env.example` to `backend/.env` and update any missing values as necessary.
4. Copy `frontend/.env.example` to `frontend/.env` and update any missing values as necessary.
5. If the volume named `data_research_analysis_postgres_data` is not present in your docker volumes, then you need to create this volume by running he following command `docker volume create data_research_analysis_postgres_data`. This is essential or the project will not build because it is required that the volume be present when the project is built.
6. Open the project directory in the terminal and run: `docker-compose build`.
7. Once its is done run: `docker-compose up`.
8. In a new terminal window/tab run`cd data-research-analysis-platform/backend`. 
9. Run `npm run typeorm migration:generate ./src/migrations/CreateTables -- -d ./src/datasources/PostgresDSMigrations.ts` to generate the migration file that creates tables file from the data models. Only run this command if the migration file create tables migration file is not present.
10. Run `npm run typeorm migration:run -- -d ./src/datasources/PostgresDSMigrations.ts` to run the migrations.
11. After the migrations have been completed then run `npm run seed:run -- -d ./src/datasources/PostgresDSMigrations.ts src/seeders/*.ts` to run the seeders.
12. Now visit https://online.studiesw.test:3000 in your browser!
13. To revert the migrations run the command `npm run typeorm migration:revert -- -d ./src/datasources/PostgresDSMigrations.ts`


### Test User Credentials
On the local instance following are the login credentials:
* Admin
    * Username: `testadminuser@dataresearchanalysis.com`
    * Password: `testuser`
* Normal Member
    * Username: `testuser@dataresearchanalysis.com`
    * Password: `testuser`


### Automated Testing
Backend API Testing: TODO

Frontend Testing: TODO

## Tech Stack
**Frontend**: Vue3/Nuxt3

**Server:** TypeScript, NodeJS, Express

**Database:** PostgreSQL

## Feedback

If you have any feedback, please reach out to us at mustafa.neguib@dataresearchanalysis.com

## Contributing

Data Research Analysis is in active development and invites software engineers and software developers to help us in making this software/platform one of the best data analysis and data analytics platform that there can be. We are actively seeking contributors to help us take this project forward.

We are also interested in getting help in improving the documentation for this project so that it is easy to read and understand.

If you find a bug in the code do create an issue in the issue tracker https://github.com/Data-Research-Analysis/data-research-analysis-platform/issues and if you work on fixing it do create a merge request with the details of the fix so that it can be applied.


## License

[MIT](https://choosealicense.com/licenses/mit/)

# Pull Request Template

When creating a pull request/merge request please use the following template. Those pull requests/merge requests not using this template will be rejected.

## Description

Please include a summary of the changes and the related issue(s). 
Explain the motivation and the context behind the changes.

Fixes: # (issue)

## Type of Change

Please delete options that are not relevant:

- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] 🛠 Refactor (non-breaking change, code improvements)
- [ ] 📚 Documentation update
- [ ] 🔥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] ✅ Tests (adding or updating tests)

## How Has This Been Tested?

Please describe the tests that you ran to verify your changes.
Provide instructions so we can reproduce and validate the behavior.

- [ ] Unit Tests
- [ ] Integration Tests
- [ ] Manual Testing

## Checklist

Please check all the boxes that apply:

- [ ] I have read the [CONTRIBUTING.md](../CONTRIBUTING.md) guidelines.
- [ ] My code follows the code style of this project.
- [ ] I have added necessary tests.
- [ ] I have updated the documentation (if needed).
- [ ] My changes generate no new warnings or errors.
- [ ] I have linked the related issue(s) in the description.

## Screenshots (if applicable)

> Add screenshots to help explain your changes if visual updates are involved.

---

Thank you for your contribution! 🎉
