# Welcome to Data Research Analysis!
Data Research Analysis Platform is be a piece of software that will allow users to add in their own datasets and then visualize and perform an analysis on them. Think of this similar to Tableu and Power BI.

## Badges

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/) 
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://github.com/Data-Research-Analysis/data-research-analysis-platform/blob/main/CODE_OF_CONDUCT.md)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)

## Changelog

A history of changes have been given in the file CHANGELOG.md (https://github.com/Data-Research-Analysis/data-research-analysis-platform/blob/master/CHANGELOG.md)

## Planned Features
The features that have been marked as check have been implemented while those that are planned to be implemented are marked as unchecked.


- [x]  **User Authentication**
- [x]  **Projects**: A project is a concept that is being used to group together data and related information of an analysis so that a user can easily manage the multiple analysis that the user will perform on different data sets that may not be related to one another. Having projects allows us to organize the data in neatly packed containers so that the user can easily focus on his/her data analysis activities.
- [ ]  **Data Sources**: A data source can be database that contains data that a user wants to bring into the platform to analyse. The aim is to provide support for multiple datasets so that the users can perform all of their analysis in this single platform without having to go back and forth from one software to another. 
- [ ]  **Data Models**: A data model is the representation of the data that the user will build which will then be used for analysis. Essentially raw data will not be saved in the platform's database, but data models will be built which will form the foundation for the analysis that the user will perform.
    - The user will be provided with two flows/views: 
        - [ ]  **Simple View**: The simple view will be a relatively simple drag and drop UI based control mechanism that will allow the data to build data models.
        - [ ]  **Advanced SQL View**: The advanced SQL view will allow the user to write SQL queries and the result from these queries will be the data models on which the user will perform analysis.
        - [ ] **Custom Calculated Fields**: The user will be able to create new custom fields which will further aid the user in his/her analysis.
- [ ]  **Sheets**: A sheet is what will allow the user to prepare the data source and build visualizations and eventually perform analysis on the data sources contained in a sheet. A project can have multiple sheets depending on the requirements of the analysis. 
- [ ]  **Dashboard**: A dashboard is essentially a collection of sheets which will help the user tell a story and show the bigger picture.
- [ ]  **Stories**: Stories or also known as narratives that will help drive the analysis and will help give insights to the user.




## Setup

The repository contains:
* `docker` for local development
* `backend`, the API built in TypeScript and NodeJS
* `frontend`, the application built in Vue3/Nuxt3

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

**Database:** PostgreSQL

## Feedback

If you have any feedback, please reach out to us at mustafa.neguib@dataresearchanalysis.com

## Contributing

Data Research Analysis is in active development and invites software engineers and software developers to help us in making this software/platform one of the best data analysis and data analytics platform that there can be. We are actively seeking contributors to help us take this project forward.

We are also interested in getting help in improving the documentation for this project so that it is easy to read and understand.

If you find a bug in the code do create an issue in the issue tracker https://github.com/Data-Research-Analysis/data-research-analysis-platform/issues and if you work on fixing it do create a merge request with the details of the fix so that it can be applied.


## License

[MIT](https://choosealicense.com/licenses/mit/)
