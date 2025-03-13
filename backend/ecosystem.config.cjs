require('dotenv').config();
module.exports = {
    apps: [
      {
        name: 'DRA-Backend-Marketing',
        port: process.env.PORT,
        exec_mode: 'fork',
        instances: '1',
        script: 'ts-node src/index.ts'
      }
    ]
  }