#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const NODE_ENV = process.env.NODE_ENV || 'development'

const configs = [
  { name: 'main', config: 'vite.config.main.ts', env: {}},
  { name: 'preload', config: 'vite.config.preload.ts', env: {} },
  { name: 'preload-view', config: 'vite.config.preload.ts', env: { PRELOAD_TYPE: 'view' } },
  { name: 'renderer', config: 'vite.config.renderer.ts',  env: {} },
].filter(c => NODE_ENV === 'production' || c.name !== 'renderer')

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: projectDir,
      ...options,
    })
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`Command failed with code ${code}`))
      else resolve()
    })
  })
}

async function clean() {
  console.log('Cleaning dist...')
  try {
    rmSync(path.join(projectDir, 'dist'), { recursive: true, force: true })
    console.log('Clean complete')
  } catch {
    // ignore
  }
}

async function build({ name, config, env }) {
  console.log(`\nBuilding ${name}...`)
  await run('vite', ['build', '--config', config], { env: { NODE_ENV, ...process.env, ...env } })
  console.log(`${name} built successfully`)
}

async function main() {
  const startTime = Date.now()
  
  await clean()
  
  for (const config of configs) {
    await build(config)
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`\nBuild complete in ${duration}s`)
}

main().catch((err) => {
  console.error('Build failed:', err.message)
  process.exit(1)
})
