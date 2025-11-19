import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss'

// IMPORTANT: Replace 'REPO_NAME' with your actual GitHub repository name
// Example: If your repo is at https://github.com/john/lidar-sim, use '/lidar-sim/'
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