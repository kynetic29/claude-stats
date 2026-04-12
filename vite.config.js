import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        dashboard: 'src/dashboard/index.html',
        onboarding: 'src/onboarding/index.html',
        history: 'src/history/index.html',
      },
    },
    outDir: 'dist',
  },
})
