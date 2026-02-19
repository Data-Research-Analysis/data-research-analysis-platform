pipeline {
    agent any
    environment {
        //backend environment variables
        PUBLIC_BACKEND_URL = credentials('PUBLIC_BACKEND_URL')
        PORT = credentials('PORT')
        RECAPTCHA_SECRET = credentials('RECAPTCHA_SECRET')
        JWT_SECRET = credentials('POSTGRESDB_USER')
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
        //frontend environment variables
        NUXT_API_URL = credentials('NUXT_API_URL')
        NUXT_RECAPTCHA_SITE_KEY = credentials('NUXT_RECAPTCHA_SITE_KEY')
        NUXT_PORT = credentials('NUXT_PORT')
        NUXT_GA_ID = credentials('NUXT_GA_ID')
        NUXT_PLATFORM_ENABLED = credentials('NUXT_PLATFORM_ENABLED')
        //root environment variables for docker-compose
        POSTGRESDB_USER = credentials('POSTGRESDB_USER')
        POSTGRESDB_ROOT_PASSWORD = credentials('POSTGRESDB_ROOT_PASSWORD')
        POSTGRESDB_DATABASE = credentials('POSTGRESDB_DATABASE')
        POSTGRESDB_LOCAL_PORT = credentials('POSTGRESDB_LOCAL_PORT')
        POSTGRESDB_DOCKER_PORT = credentials('POSTGRESDB_DOCKER_PORT')
        FRONTEND_LOCAL_PORT = credentials('FRONTEND_LOCAL_PORT')
        FRONTEND_DOCKER_PORT = credentials('FRONTEND_DOCKER_PORT')
        BACKEND_LOCAL_PORT = credentials('BACKEND_LOCAL_PORT')
        BACKEND_DOCKER_PORT = credentials('BACKEND_DOCKER_PORT')
    }
    stages {
        stage('Build Frontend') {
            steps {
                sh '''
                    ls -al
                    node --version
                    npm --version
                    printf POSTGRESDB_USER=$POSTGRESDB_USER\rPOSTGRESDB_ROOT_PASSWORD=$POSTGRESDB_ROOT_PASSWORD\rPOSTGRESDB_DATABASE=$POSTGRESDB_DATABASE\rPOSTGRESDB_LOCAL_PORT=$POSTGRESDB_LOCAL_PORT\rPOSTGRESDB_DOCKER_PORT=$POSTGRESDB_DOCKER_PORT\rFRONTEND_LOCAL_PORT=$FRONTEND_LOCAL_PORT\rFRONTEND_DOCKER_PORT=$FRONTEND_DOCKER_PORT\rBACKEND_LOCAL_PORT=$BACKEND_LOCAL_PORT\rBACKEND_DOCKER_PORT=$BACKEND_DOCKER_PORT > .env 
                    cd frontend && printf 'NUXT_API_URL=%s\nNUXT_RECAPTCHA_SITE_KEY=%s\nNUXT_PORT=%s\nNUXT_GA_ID=%s\nNUXT_PLATFORM_ENABLED=%s\n' "$NUXT_API_URL" "$NUXT_RECAPTCHA_SITE_KEY" "$NUXT_PORT" "$NUXT_GA_ID" "$NUXT_PLATFORM_ENABLED" > .env && npm ci && npm run build
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
                    cd backend && printf PUBLIC_BACKEND_URL=$PUBLIC_BACKEND_URL\rPORT=$PORT\rRECAPTCHA_SECRET=$RECAPTCHA_SECRET\rJWT_SECRET=$JWT_SECRET\rPASSWORD_SALT=$PASSWORD_SALT\rDB_DRIVER=$DB_DRIVER\rPOSTGRESQL_HOST_MIGRATIONS=$POSTGRESQL_HOST_MIGRATIONS\rPOSTGRESQL_HOST=$POSTGRESQL_HOST\rPOSTGRESQL_PORT_MIGRATIONS=$POSTGRESQL_PORT_MIGRATIONS\rPOSTGRESQL_PORT=$POSTGRESQL_PORT\rPOSTGRESQL_USERNAME=$POSTGRESQL_USERNAME\rPOSTGRESQL_PASSWORD=$POSTGRESQL_PASSWORD\rPOSTGRESQL_DB_NAME=$POSTGRESQL_DB_NAME\rNODE_ENV=$NODE_ENV\rMAIL_DRIVER=$MAIL_DRIVER\rMAIL_HOST=$MAIL_HOST\rMAIL_PORT=$MAIL_PORT\rMAIL_USER=$MAIL_USER\rMAIL_PASS=$MAIL_PASS\rMAIL_FROM=$MAIL_FROM\rMAIL_REPLY_TO=$MAIL_REPLY_TO > .env && npm ci
                    ls -al
                '''
            }
        }
    }
}