// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

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
      allowedHosts: ['0.0.0.0', 'dataresearchanalysis.test'],
    },
    plugins: [
      tailwindcss(),
    ],
  }
})
