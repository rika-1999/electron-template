import path from 'node:path'
import { defineConfig } from 'vitest/config'

const alias = { '@': path.resolve(__dirname, 'src') }

export default defineConfig({
  resolve: { alias },
  test: {
    globals: true,
    exclude: ['node_modules', 'dist', 'release'],
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'main',
          setupFiles: ['src/__tests__/infrastructure/setup.ts'],
          include: [
            'src/__tests__/main/**',
            'src/__tests__/integration/**',
            'src/__tests__/shared/**',
          ],
          exclude: ['src/__tests__/renderer/**', 'src/__tests__/preload/**'],
          environment: 'node',
          env: { PROCESS_TYPE: 'main' },
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'preload',
          setupFiles: ['src/__tests__/infrastructure/setup.preload.ts'],
          include: ['src/__tests__/preload/**'],
          environment: 'jsdom',
          env: { PROCESS_TYPE: 'preload' },
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'renderer',
          globals: true,
          setupFiles: ['src/__tests__/infrastructure/setup.renderer.ts'],
          include: ['src/__tests__/renderer/**'],
          environment: 'jsdom',
          env: { PROCESS_TYPE: 'renderer' },
        },
      },
    ],
  },
})
