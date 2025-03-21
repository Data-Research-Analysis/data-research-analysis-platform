# Welcome to Data Research Analysis!
Data Research Analysis Platform is be a piece of software that will allow users to add in their own datasets and then visualize and perform an analysis on them. Think of this similar to Tableu and Power BI.

## Badges

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/) 
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://github.com/Data-Research-Analysis/data-research-analysis-platform/blob/main/CODE_OF_CONDUCT.md)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)

## Changelog

A history of changes have been given in the file CHANGELOG.md (https://github.com/Data-Research-Analysis/data-research-analysis-platform/blob/master/CHANGELOG.md)

## Features

TODO

The repository contains:
* `docker` for local development
* `backend`, the API built in TypeScript and NodeJS
* `frontend`, the application built in Vue3/Nuxt3

## Setup

### Windows Setup
1. Add `127.0.0.1 frontend.dataresearchanalysis.test backend.dataresearchanalysis.test` to your hosts file `c:\windows\system32\drivers\etc\hosts` (https://www.howtogeek.com/howto/27350/beginner-geek-how-to-edit-your-hosts-file/)
2. Clone the repository `https://github.com/Data-Research-Analysis/data-research-analysis-platform.git`
3. Copy `backend/.env.example` to `backend/.env` and update any missing values as necessary
4. Copy `frontend/.env.example` to `frontend/.env` and update any missing values as necessary
5. `cd data-research-analysis-platform` then `docker-compose build`
6. Once it is done building, run: `docker-compose up`
7. `cd data-research-analysis-platform/backend/src` then run `npx sequelize-cli db:migrate` to run the migrations
8. Now visit https://online.studiesw.test:3000 in your browser!

### Ubuntu Setup
1. Add `127.0.0.1 online.studiesw.test online-api.studiesw.test online-redis.studiesw.test online-db.studiesw.test` to your hosts file `~/etc/hosts`
2. Clone the repository `https://github.com/Data-Research-Analysis/data-research-analysis-platform.git`
3. Copy `backend/.env.example` to `backend/.env` and update any missing values as necessary
4. Copy `frontend/.env.example` to `frontend/.env` and update any missing values as necessary
5. Open the project directory in the terminal and run: `docker-compose build`
6. Once its is done run: `docker-compose up`
7. `cd data-research-analysis-platform/backend/src` then run `npx sequelize-cli db:migrate` to run the migrations
8. Now visit https://online.studiesw.test:3000 in your browser!


### Automated Testing
Backend API Testing: TODO

Frontend Testing: TODO

## Tech Stack
**Frontend**: Vue3/Nuxt3

**Server:** TypeScript, NodeJS, Express

## Feedback

If you have any feedback, please reach out to us at mustafa.neguib@dataresearchanalysis.com

## Contributing

Data Research Analysis is in active development and invites software engineers and software developers to help us in making this software/platform one of the best data analysis and data analytics platform that there can be. We are actively seeking contributors to help us take this project forward.

We are also interested in getting help in improving the documentation for this project so that it is easy to read and understand.

If you find a bug in the code do create an issue in the issue tracker https://github.com/Data-Research-Analysis/data-research-analysis-platform/issues and if you work on fixing it do create a merge request with the details of the fix so that it can be applied.


## License

[MIT](https://choosealicense.com/licenses/mit/)
