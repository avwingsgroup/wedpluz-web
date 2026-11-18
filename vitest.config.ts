import { fileURLToPath, URL } from 'node:url'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Normalised drive letter on Windows; see scripts/vitest.mjs for why `npm test` wraps Vitest.
const root = fileURLToPath(new URL('.', import.meta.url)).replace(/^[a-z]:/, (d) => d.toUpperCase())

export default defineConfig({
  root,
  plugins: [vue()],
  define: {
    __APP_TARGET__: JSON.stringify('web'),
    __APP_VERSION__: JSON.stringify('test'),
  },
  resolve: { alias: { '@': join(root, 'src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.ts'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'], include: ['src/**/*.{ts,vue}'], exclude: ['src/services/mock/**'] },
  },
})
