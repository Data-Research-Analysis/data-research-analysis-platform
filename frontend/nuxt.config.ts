// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

console.log("process.env.NUXT_PORT", process.env.NUXT_PORT ? parseInt(process.env.NUXT_PORT, 10) : 3000);
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  ssr: false,
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
    }
  },
  devtools: {
    enabled: true
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
  ],
  modules: [
    'nuxt-gtag',
    '@pinia/nuxt',
  ],
  runtimeConfig: {
    public: {
      recaptcha: {
        v3SiteKey: process.env.NUXT_RECAPTCHA_SITE_KEY,
      },
      NUXT_API_URL: process.env.NUXT_API_URL,
      NUXT_RECAPTCHA_SITE_KEY: process.env.NUXT_RECAPTCHA_SITE_KEY,
      POSTGRESQL_URL: process.env.POSTGRESQL_URL,
      NUXT_PORT: process.env.NUXT_PORT,
    }
  },
  gtag: {
    id: process.env.NUXT_GA_ID,
  },
})