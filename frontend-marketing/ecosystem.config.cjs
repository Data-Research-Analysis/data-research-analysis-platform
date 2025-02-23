require('dotenv').config();
module.exports = {
    apps: [
      {
        name: 'DRA-Frontend-Marketing',
        port: process.env.NUXT_PORT,
        exec_mode: 'fork',
        instances: 'max',
        script: './.output/server/index.mjs'
      }
    ]
  }