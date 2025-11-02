// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  ssr: true,
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
    }
  },
  devtools: {
    enabled: false
  },
  devServer: {
    port: process.env.NUXT_PORT ? parseInt(process.env.NUXT_PORT, 10) : 3000,
  },
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  css: [
    '~/assets/css/main.css',
    '@fortawesome/fontawesome-svg-core/styles.css',
  ],
  vite: {
    server: {
      allowedHosts: ['dataresearchanalysis.com', 'dataresearchanalysis.test', 'frontend-marketing.dataresearchanalysis.test'],
    },
    plugins: [
      tailwindcss(),
    ],
  },
  plugins: [
    { src: '~/plugins/recaptcha.ts', mode: 'client' },
    { src: '~/plugins/socketio.ts', mode: 'client' },
    { src: '~/plugins/d3.ts', mode: 'client' },
    { src: '~/plugins/draggable.ts', mode: 'client' },
    { src: '~/plugins/htmlToImage.ts', mode: 'client' },
    { src: '~/plugins/sweetalert2.ts', mode: 'client' },
    { src: '~/plugins/vuetippy.ts', mode: 'client' },
    // fontawesome.ts is universal (works on server for SSR icons)
  ],
  modules: [
    'nuxt-gtag',
    '@pinia/nuxt',
    '@nuxt/test-utils/module',
  ],
  runtimeConfig: {
    public: {
      recaptcha: {
        v3SiteKey: process.env.NUXT_RECAPTCHA_SITE_KEY,
      },
      NUXT_ENV: process.env.NUXT_ENV,
      NUXT_API_URL: process.env.NUXT_API_URL,
      NUXT_RECAPTCHA_SITE_KEY: process.env.NUXT_RECAPTCHA_SITE_KEY,
      NUXT_PORT: process.env.NUXT_PORT,
      NUXT_GA_ID: process.env.NUXT_GA_ID,
      NUXT_PLATFORM_ENABLED: process.env.NUXT_PLATFORM_ENABLED,
      NUXT_PLATFORM_REGISTRATION_ENABLED: process.env.NUXT_PLATFORM_REGISTRATION_ENABLED,
      NUXT_PLATFORM_LOGIN_ENABLED: process.env.NUXT_PLATFORM_LOGIN_ENABLED,
      NUXT_SOCKETIO_SERVER_URL: process.env.NUXT_SOCKETIO_SERVER_URL,
      NUXT_SOCKETIO_SERVER_PORT: process.env.NUXT_SOCKETIO_SERVER_PORT,
    }
  },
  gtag: {
    id: process.env.NUXT_GA_ID,
  },
})