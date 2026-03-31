import path from 'node:path'
import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'
import { sourceFilePlugin } from './src/vitePlugins/sourceFilePlugin'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV !== 'production'

const preloadType = process.env.PRELOAD_TYPE || 'index'

const entry = `src/preload/${preloadType}.ts`

export default defineConfig({
  plugins: [sourceFilePlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    lib: {
      entry: entry,
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: preloadType === 'index' ? 'dist/preload' : `dist/proload-${preloadType}`,
    emptyOutDir: true,
    sourcemap: isDev,
    minify: !isDev,
    rollupOptions: {
      external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      output: {
        dynamicImportInCjs: false,
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env.PROCESS_TYPE': JSON.stringify('preload') as 'main' | 'preload' | 'renderer',
  },
})
