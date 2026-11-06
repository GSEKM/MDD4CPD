import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  // GitHub Pages serves the site from https://gsekm.github.io/MDD4CPD/
  base: command === 'build' ? '/MDD4CPD/' : '/',
}))
