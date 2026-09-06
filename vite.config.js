import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Sur GitHub Pages, le site est servi sous /<nom-du-repo>/ et pas à la
// racine — Vite a besoin de le savoir pour générer les bons chemins
// d'assets. GITHUB_REPOSITORY est fourni automatiquement par GitHub
// Actions (format "owner/repo"), donc rien à configurer à la main ; en
// local (npm run dev / npm run build) cette variable n'existe pas et le
// site reste servi à la racine comme avant.
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.GITHUB_ACTIONS && repoName ? `/${repoName}/` : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
