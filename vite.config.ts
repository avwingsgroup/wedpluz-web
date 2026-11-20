import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { seoPlugin } from './build/seo-plugin.ts'

/**
 * Wedpluz build configuration.
 *
 * One codebase produces two deployables:
 *  - VITE_APP_TARGET=web   -> https://wedpluz.com        (public app; admin routes are not registered)
 *  - VITE_APP_TARGET=admin -> https://admin.wedpluz.com  (admin dashboard mounted at "/")
 */
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_APP_TARGET === 'admin' ? 'admin' : 'web'

  // Deployed environments must talk to the real API. Refuse to build production or staging
  // bundles that would silently serve fixture data (ALLOW_MOCK_BUILD=1 only for throwaway demos;
  // such builds still show the on-screen "Mock data" badge).
  const deployed = mode === 'production' || mode === 'staging'
  if (command === 'build' && deployed && env.VITE_API_MODE !== 'live' && process.env.ALLOW_MOCK_BUILD !== '1') {
    throw new Error(`[wedpluz] ${mode} builds require VITE_API_MODE=live. Mock fixtures cannot ship to a deployed environment.`)
  }

  return {
    plugins: [
      vue(),
      tailwindcss(),
      // robots.txt, sitemap.xml and pre-rendered page heads (docs/seo.md)
      seoPlugin({ target, mode, origin: env.VITE_WEB_ORIGIN || 'https://wedpluz.com', extraSitemaps: env.VITE_SITEMAP_EXTRA }),
    ],
    define: {
      __APP_TARGET__: JSON.stringify(target),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, strictPort: false },
    build: {
      target: 'es2022',
      sourcemap: mode !== 'production',
      // ECharts core (~650 kB) is isolated in a lazy `charts` chunk that only admin and
      // organizer analytics pages load, so the default 500 kB warning is noise here.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Rolldown (Vite 8) requires the function form. Heavy libraries get their own
          // long-cacheable chunks; ECharts only loads on pages that render charts.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined
            if (/[\\/]node_modules[\\/](echarts|zrender|vue-echarts)[\\/]/.test(id)) return 'charts'
            if (/[\\/]node_modules[\\/](@vue|vue|vue-router|pinia)[\\/]/.test(id)) return 'vue'
            if (/[\\/]node_modules[\\/](axios|zod|@tanstack)[\\/]/.test(id)) return 'data'
            if (/[\\/]node_modules[\\/]@sentry[\\/]/.test(id)) return 'sentry'
            return undefined
          },
        },
      },
    },
  }
})
