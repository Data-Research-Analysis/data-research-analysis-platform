import { VueReCaptcha } from 'vue-recaptcha-v3'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const NUXT_RECAPTCHA_SITE_KEY = config.public.NUXT_RECAPTCHA_SITE_KEY;
  nuxtApp.vueApp.use(VueReCaptcha, {
    siteKey: NUXT_RECAPTCHA_SITE_KEY,
    loaderOptions: {
      autoHideBadge: false,
      explicitRenderParameters: {
        badge: 'bottom',
      },
    },
  })
})