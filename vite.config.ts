import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Servi sur GitHub Pages sous /BetUs/
export default defineConfig({
  base: '/BetUs/',
  plugins: [react(), tailwindcss()],
})
