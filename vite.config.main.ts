import path from 'node:path'
import { builtinModules } from 'node:module'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { sourceFilePlugin } from './src/vite-plugins/sourceFilePlugin'

const isDev = process.env.NODE_ENV !== 'production'
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
const deps = Object.keys(pkg.dependencies ?? {})

export default defineConfig({
  plugins: [sourceFilePlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: 'dist/main',
    emptyOutDir: true,
    sourcemap: isDev,
    minify: !isDev,
    rollupOptions: {
      external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`), ...deps],
    },
  },
  define: {
    'process.env.PROCESS_TYPE': JSON.stringify('main'),
    'process.env.UPDATE_SERVER_URL': JSON.stringify(process.env.UPDATE_SERVER_URL ?? ''),
    'process.env.AUTO_CHECK_ON_STARTUP': JSON.stringify(
      process.env.AUTO_CHECK_ON_STARTUP ?? 'true',
    ),
    'process.env.AUTO_DOWNLOAD': JSON.stringify(process.env.AUTO_DOWNLOAD ?? 'false'),
    'process.env.UPDATE_CHECK_INTERVAL': JSON.stringify(
      process.env.UPDATE_CHECK_INTERVAL ?? '3600000',
    ),
  },
})
