pipeline {
    agent any
    environment {
        PORT = credentials('PORT')
        RECAPTCHA_SECRET = credentials('RECAPTCHA_SECRET')
        JWT_SECRET = credentials('JWT_SECRET')
        PASSWORD_SALT = credentials('PASSWORD_SALT')
        DB_DRIVER = credentials('DB_DRIVER')
        POSTGRESQL_HOST_MIGRATIONS = credentials('POSTGRESQL_HOST_MIGRATIONS')
        POSTGRESQL_HOST = credentials('POSTGRESQL_HOST')
        POSTGRESQL_PORT_MIGRATIONS = credentials('POSTGRESQL_PORT_MIGRATIONS')
        POSTGRESQL_PORT = credentials('POSTGRESQL_PORT')
        POSTGRESQL_USERNAME = credentials('POSTGRESQL_USERNAME')
        POSTGRESQL_PASSWORD = credentials('POSTGRESQL_PASSWORD')
        POSTGRESQL_DB_NAME = credentials('POSTGRESQL_DB_NAME')
        NODE_ENV = credentials('NODE_ENV')
        MAIL_DRIVER = credentials('MAIL_DRIVER')
        MAIL_HOST = credentials('MAIL_HOST')
        MAIL_PORT = credentials('MAIL_PORT')
        MAIL_USER = credentials('MAIL_USER')
        MAIL_PASS = credentials('MAIL_PASS')
        MAIL_FROM = credentials('MAIL_FROM')
        MAIL_REPLY_TO = credentials('MAIL_REPLY_TO')
        NUXT_API_URL = credentials('NUXT_API_URL')
        NUXT_RECAPTCHA_SITE_KEY = credentials('NUXT_RECAPTCHA_SITE_KEY')
        NUXT_PORT = credentials('NUXT_PORT')
        NUXT_PLATFORM_ENABLED = credentials('NUXT_PLATFORM_ENABLED')
    }
    stages {
        stage('Build Frontend') {
            steps {
                sh '''
                    ls -al
                    node --version
                    npm --version
                    cd frontend && printf NUXT_API_URL=$NUXT_API_URL\rNUXT_RECAPTCHA_SITE_KEY=$NUXT_RECAPTCHA_SITE_KEY\rNUXT_PORT=$NUXT_PORT\nNUXT_PLATFORM_ENABLED=$NUXT_PLATFORM_ENABLED > .env && npm ci && npm run build
                    ls -al
                '''
            }
        }
        stage('Build Backend') {
            steps {
                sh '''
                    ls -al
                    node --version
                    npm --version
                    cd backend && printf PORT=$PORT\rRECAPTCHA_SECRET=$RECAPTCHA_SECRET\rJWT_SECRET=$JWT_SECRET\rPASSWORD_SALT=$PASSWORD_SALT\rDB_DRIVER=$DB_DRIVER\rPOSTGRESQL_HOST_MIGRATIONS=$POSTGRESQL_HOST_MIGRATIONS\rPOSTGRESQL_PORT=$POSTGRESQL_PORT\rPOSTGRESQL_USERNAME=$POSTGRESQL_USERNAME\rPOSTGRESQL_PASSWORD=$POSTGRESQL_PASSWORD\rPOSTGRESQL_DB_NAME=$POSTGRESQL_DB_NAME\rMAIL_DRIVER=$MAIL_DRIVER\rMAIL_HOST=$MAIL_HOST\rNODE_ENV=$NODE_ENV\rMAIL_DRIVER=$MAIL_DRIVER\rMAIL_HOST=$MAIL_HOST\rMAIL_PORT=$MAIL_PORT\rMAIL_USER=$MAIL_USER\rMAIL_PASS=$MAIL_PASS\rMAIL_FROM=$MAIL_FROM\rMAIL_REPLY_TO=$MAIL_REPLY_TO\rNUXT_PLATFORM_ENABLED=$NUXT_PLATFORM_ENABLED > .env && npm ci
                    ls -al
                '''
            }
        }
    }
}