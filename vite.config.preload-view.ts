import path from 'node:path'
import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'
import { sourceFilePlugin } from './src/vite-plugins/sourceFilePlugin'

const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig({
  plugins: [sourceFilePlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    lib: {
      entry: 'src/preload/view.ts',
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: 'dist/preload-view',
    emptyOutDir: true,
    sourcemap: isDev,
    minify: !isDev,
    rollupOptions: {
      external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
    },
  },
  define: {
    'process.env.PROCESS_TYPE': JSON.stringify('preload'),
  },
})
