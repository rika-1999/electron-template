import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { sourceFilePlugin } from './src/vite-plugins/sourceFilePlugin'

const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig({
  root: 'src/renderer',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  plugins: [react(), sourceFilePlugin()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env.PROCESS_TYPE': JSON.stringify('renderer'),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
