import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Served from https://louislp.github.io/all-hands/
  base: '/all-hands/',
  // The runtime budget's instrumented build goes elsewhere, so it never overwrites dist/.
  build: { outDir: process.env.VITE_PROFILE_DRAW ? 'node_modules/.tmp/dist-profile' : 'dist' },
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
