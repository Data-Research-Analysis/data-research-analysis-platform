/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./nuxt.config.{js,ts}",
    "./app.vue",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        "green-blue-100": "#32ADE6",
        "green-blue-200": "#32BCE4",
        "green-blue-300": "#32B1E4",
        "green-blue-400": "#32A0E4",
        "green-blue-500": "#198FDF",
        "syncing-orange": "#FD7B17",
        "synced-blue": "#1E3050",
        "sync-failed": "#DC2626",
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
