import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' + salida en /docs: GitHub Pages publica esa carpeta directamente.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'docs', emptyOutDir: true },
})
