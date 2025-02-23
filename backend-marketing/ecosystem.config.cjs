require('dotenv').config();
module.exports = {
    apps: [
      {
        name: 'DRA-Backend-Marketing',
        port: process.env.PORT,
        exec_mode: 'cluster',
        instances: 'max',
        script: 'ts-node src/index.ts'
      }
    ]
  }