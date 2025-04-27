pipeline {
    agent any
    environment {
        PORT = credentials('PORT')
        RECAPTCHA_SECRET = credentials('RECAPTCHA_SECRET')
        JWT_SECRET = credentials('JWT_SECRET')
        POSTGRESQL_URL = credentials('POSTGRESQL_URL')
        NODE_ENV = credentials('NODE_ENV')
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
                    cd backend && printf PORT=$PORT\rRECAPTCHA_SECRET=$RECAPTCHA_SECRET\rJWT_SECRET=$JWT_SECRET\rPOSTGRESQL_URL=$POSTGRESQL_URL\rNODE_ENV=$NODE_ENV > .env && npm ci
                    ls -al
                '''
            }
        }
    }
}