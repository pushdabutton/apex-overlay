import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'

function copyMigrations() {
  return {
    name: 'copy-migrations',
    closeBundle() {
      const src = resolve(__dirname, 'src/main/db/migrations')
      const dest = resolve(__dirname, 'out/main/migrations')
      mkdirSync(dest, { recursive: true })
      for (const file of readdirSync(src).filter(f => f.endsWith('.sql'))) {
        copyFileSync(resolve(src, file), resolve(dest, file))
      }
    }
  }
}

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['better-sqlite3']
      }
    },
    plugins: [copyMigrations()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@main': resolve(__dirname, 'src/main')
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        external: ['better-sqlite3']
      }
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@renderer': resolve(__dirname, 'src/renderer')
      }
    }
  }
})
