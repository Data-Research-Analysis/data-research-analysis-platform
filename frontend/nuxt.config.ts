// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

// Google Tag Manager container ID (optional). When unset, no GTM snippet is
// injected and all analytics features are disabled to prevent silent failures.
const gtmId = process.env.NUXT_GTM_ID;

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  ssr: true,
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      htmlAttrs: {
        lang: 'en',
      },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/logo.png' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap' }
      ],
      meta: [
        { name: 'theme-color', content: '#3C8DBC' }
      ],
      style: [
        {
          // Critical Font Awesome styles to prevent FOUC (icon flash of unstyled content)
          // Full styles loaded via fontawesome.ts plugin import
          innerHTML: '.svg-inline--fa{display:inline-block;height:1em;overflow:visible;vertical-align:-.125em}svg:not(:root).svg-inline--fa,svg:not(:host).svg-inline--fa{overflow:visible;box-sizing:content-box}'
        }
      ],
      script: gtmId ? [
        {
          // Consent Mode v2 defaults — MUST run before GTM loads so the container
          // respects the user's privacy state from the first request. All signals
          // start denied; the cookie banner grants analytics and/or advertising.
          // url_passthrough + ads_data_redaction improve Google Ads conversion
          // measurement when advertising consent is denied (cookieless modeling).
          innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:3000});gtag('set','url_passthrough',true);gtag('set','ads_data_redaction',true);`
        },
        {
          // GTM loader
          innerHTML: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`
        }
      ] : [],
      noscript: gtmId ? [
        {
          innerHTML: `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`
        }
      ] : []
    }
  },
  devtools: {
    enabled: false
  },
  devServer: {
    port: process.env.NUXT_PORT ? parseInt(process.env.NUXT_PORT, 10) : 3000,
  },
  // OPTIMIZATION: Enable experimental features for better performance
  experimental: {
    // Enable payload extraction for better hydration
    payloadExtraction: true,
    // Enable component islands for partial hydration
    componentIslands: false,
    // Enable view transitions for smoother navigation
    viewTransition: true,
    // Disable app manifest to prevent Vite pre-transform warning for
    // the #app-manifest virtual module in dead-code branches (if (false) {...})
    appManifest: false,
    // Inline styles for critical CSS to reduce render-blocking requests
    inlineSSRStyles: true,
    // Tree-shake unregistered components from the server bundle
    optimizeSSRImports: true,
  },
  // OPTIMIZATION: Enable tree-shaking and bundle analysis
  features: {
    inlineStyles: true,
  },
  // OPTIMIZATION: Configure router for better performance
  router: {
    options: {
      // Enable link prefetching on hover/visible
      linkActiveClass: 'router-link-active',
      linkExactActiveClass: 'router-link-exact-active',
    }
  },
  routeRules: {
    '/attribution': { redirect: '/projects' },
    '/attribution/**': { redirect: '/projects' },
  },
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  css: [
    '~/assets/css/main.css',
  ],
  vite: {
    server: {
      allowedHosts: ['www.dataresearchanalysis.com', 'dataresearchanalysis.com', 'dataresearchanalysis.test', 'frontend.dataresearchanalysis.test', 'frontend-marketing.dataresearchanalysis.test'],
    },
    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
    },
    build: {
      target: 'esnext',
    },
  },
  plugins: [
    { src: '~/plugins/recaptcha.ts', mode: 'client' },
    { src: '~/plugins/socketio.ts', mode: 'client' },
    { src: '~/plugins/draggable.ts', mode: 'client' },
    { src: '~/plugins/htmlToImage.ts', mode: 'client' },
    { src: '~/plugins/sweetalert2.ts', mode: 'client' },
    { src: '~/plugins/vuetippy.client.ts', mode: 'client' },
    { src: '~/plugins/api-loader.ts', mode: 'client' },
    // fontawesome.ts is universal (works on server for SSR icons)
    // init-user.client.ts, navigation-perf.client.ts, prefetch-links.client.ts auto-detected by .client.ts suffix
    // ga-consent must be explicitly ordered LAST so GTM's dataLayer is initialised first
    { src: '~/plugins/ga-consent.client.ts', mode: 'client' },
  ],
  modules: [
    '@pinia/nuxt',
    ...(process.env.NODE_ENV !== 'production' ? ['@nuxt/test-utils/module'] : []),
  ],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_API_URL || 'http://localhost:3002',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://www.dataresearchanalysis.com',
      recaptcha: {
        v3SiteKey: process.env.NUXT_RECAPTCHA_SITE_KEY,
      },
      NUXT_ENV: process.env.NUXT_ENV,
      NUXT_API_URL: process.env.NUXT_API_URL,
      NUXT_PUBLIC_SITE_URL: process.env.NUXT_PUBLIC_SITE_URL,
      NUXT_RECAPTCHA_SITE_KEY: process.env.NUXT_RECAPTCHA_SITE_KEY,
      NUXT_PORT: process.env.NUXT_PORT,
      gtmId: process.env.NUXT_GTM_ID,
      NUXT_PLATFORM_ENABLED: process.env.NUXT_PLATFORM_ENABLED,
      NUXT_PLATFORM_REGISTRATION_ENABLED: process.env.NUXT_PLATFORM_REGISTRATION_ENABLED,
      NUXT_PLATFORM_LOGIN_ENABLED: process.env.NUXT_PLATFORM_LOGIN_ENABLED,
      NUXT_SOCKETIO_SERVER_URL: process.env.NUXT_SOCKETIO_SERVER_URL,
      NUXT_SOCKETIO_SERVER_PORT: process.env.NUXT_SOCKETIO_SERVER_PORT,
      // Paddle Payment Gateway
      paddleEnvironment: process.env.NUXT_PADDLE_ENVIRONMENT || 'sandbox',
      paddleClientToken: process.env.NUXT_PADDLE_CLIENT_TOKEN || '',
      paddleCheckoutEnabled: process.env.NUXT_PADDLE_CHECKOUT_ENABLED === 'true',
    }
  },
})