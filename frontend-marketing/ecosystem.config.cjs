require('dotenv').config();
module.exports = {
    apps: [
      {
        name: 'DRA-Frontend-Marketing',
        port: process.env.NUXT_PORT,
        exec_mode: 'cluster',
        instances: 'max',
        script: './.output/server/index.mjs'
      }
    ]
  }