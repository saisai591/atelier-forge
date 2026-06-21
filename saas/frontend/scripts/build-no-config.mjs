import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

await build(
  defineConfig({
    root,
    configFile: false,
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(root, './src') },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  }),
)
