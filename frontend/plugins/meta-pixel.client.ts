export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const pixelId = config.public.metaPixelId as string | undefined

  if (!pixelId || !import.meta.client) return

  const windowObj = window as any

  if (windowObj.fbq) return

  windowObj.fbq = function (...args: any[]) {
    if (windowObj.fbq.callMethod) {
      windowObj.fbq.callMethod.apply(windowObj.fbq, args)
    } else {
      windowObj.fbq.queue.push(args)
    }
  }
  if (!windowObj._fbq) windowObj._fbq = windowObj.fbq
  windowObj.fbq.push = windowObj.fbq
  windowObj.fbq.loaded = true
  windowObj.fbq.version = '2.0'
  windowObj.fbq.queue = []

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)

  windowObj.fbq('init', pixelId)
  windowObj.fbq('track', 'PageView')

  const noscript = document.createElement('noscript')
  const img = document.createElement('img')
  img.height = 1
  img.width = 1
  img.style.display = 'none'
  img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`
  noscript.appendChild(img)
  document.body.appendChild(noscript)
})
