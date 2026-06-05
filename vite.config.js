import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Inject a build version so we can verify deploys are live.
// Prefers Vercel's commit SHA env var, falls back to git, falls back to "dev".
const commit = (() => {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' }
})()
const buildTime = new Date().toISOString().slice(5, 16).replace('T', ' ')  // MM-DD HH:MM

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(`${commit} · ${buildTime}`),
  },
})
