import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import App from './App.vue'
import { createAppRouter } from '@/router'
import { env } from '@/config/env'
import '@/assets/main.css'

// The admin console must never be indexed (the host also sends X-Robots-Tag; see docs/deployment.md).
if (__APP_TARGET__ === 'admin') {
  const robots = document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex, nofollow'
  document.head.appendChild(robots)
  document.title = 'Wedpluz Admin'
}

const app = createApp(App)
const pinia = createPinia()
const router = createAppRouter()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false },
  },
})

app.use(pinia)
app.use(router)
app.use(VueQueryPlugin, { queryClient })

if (env.sentryDsn) {
  // Loaded lazily so the monitoring SDK never affects first paint when disabled.
  void import('./monitoring').then(({ installSentry }) => installSentry(app, router))
}

app.config.errorHandler = (err, _instance, info) => {
  if (env.isDev) console.error('[app]', info, err)
}

router.isReady().then(() => app.mount('#app'))
