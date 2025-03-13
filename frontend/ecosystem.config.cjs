require('dotenv').config();
module.exports = {
    apps: [
      {
        name: 'DRA-Frontend-Marketing',
        port: process.env.NUXT_PORT,
        exec_mode: 'fork',
        instances: '1',
        script: './.output/server/index.mjs'
      }
    ]
  }