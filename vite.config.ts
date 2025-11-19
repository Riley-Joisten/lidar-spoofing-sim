import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss'

// REPLACE 'lidar-spoofing-sim' WITH YOUR EXACT GITHUB REPO NAME IF DIFFERENT
export default defineConfig({
  plugins: [react()],
  base: '/lidar-spoofing-sim/',
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
      ],
    },
  },
})