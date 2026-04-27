import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'

function copyMigrations() {
  const copy = () => {
    const src = resolve(__dirname, 'src/main/db/migrations')
    const dest = resolve(__dirname, 'out/main/migrations')
    mkdirSync(dest, { recursive: true })
    for (const file of readdirSync(src).filter(f => f.endsWith('.sql'))) {
      copyFileSync(resolve(src, file), resolve(dest, file))
    }
  }
  return {
    name: 'copy-migrations',
    // buildStart ensures migrations are available before electron launches in dev mode
    buildStart: copy,
    // closeBundle ensures migrations are refreshed after the final bundle in production builds
    closeBundle: copy
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
