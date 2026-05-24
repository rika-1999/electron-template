#!/usr/bin/env node
import { readFileSync, writeFileSync, unlinkSync, rmSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectDir = join(__dirname, '..')

const PLACEHOLDERS = {
  projectName: 'electron-template',
  appId: 'com.example.electron',
  windowTitle: 'Electron App',
}

const files = [
  'package.json',
  'electron-builder.config.mjs',
  'README.md',
  'src/renderer/index.html',
]

function prompt(rl, question, defaultVal) {
  return new Promise((resolve) => {
    const suffix = defaultVal ? ` (${defaultVal})` : ''
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal || '')
    })
  })
}

function removeLines(filePath, patterns) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const filtered = lines.filter((line) => !patterns.some((p) => p.test(line)))
  writeFileSync(filePath, filtered.join('\n'))
}

function replaceInFile(filePath, oldStr, newStr) {
  const content = readFileSync(filePath, 'utf-8')
  writeFileSync(filePath, content.replace(oldStr, newStr))
}

function removeNativeModule() {
  console.log('\n🗑️  移除 native 模块...\n')

  const deleteFiles = [
    'native/package.json',
    'native/Cargo.toml',
    'native/build.rs',
    'native/src/lib.rs',
    'src/main/nativeExample.ts',
    'src/__tests__/main/nativeExample.test.ts',
    'rust-toolchain.toml',
    'pnpm-workspace.yaml',
  ]
  for (const file of deleteFiles) {
    const filePath = join(projectDir, file)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
      console.log(`  ✓ 删除 ${file}`)
    }
  }

  const deleteDirs = [
    'native/src',
    'native/target',
    'native',
  ]
  for (const dir of deleteDirs) {
    const dirPath = join(projectDir, dir)
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true })
    }
  }

  // package.json: remove native dependency and build:native script
  replaceInFile(
    join(projectDir, 'package.json'),
    '"build": "pnpm run build:native && cross-env NODE_ENV=production node scripts/build.mjs",',
    '"build": "cross-env NODE_ENV=production node scripts/build.mjs",',
  )
  removeLines(join(projectDir, 'package.json'), [
    /"native": "workspace:\*",/,
    /"build:native": "pnpm --filter native run build",/,
  ])
  console.log('  ✓ package.json')

  // vite.config.main.mts: remove 'native' from external
  replaceInFile(
    join(projectDir, 'vite.config.main.mts'),
    "external: ['electron', 'native',",
    "external: ['electron',",
  )
  console.log('  ✓ vite.config.main.mts')

  // electron-builder.config.mjs: remove node_modules/native/**
  replaceInFile(
    join(projectDir, 'electron-builder.config.mjs'),
    "files: ['dist/**/*', 'package.json', '!node_modules/**', 'node_modules/native/index.cjs', 'node_modules/native/*.node'],",
    "files: ['dist/**/*', 'package.json', '!node_modules/**'],",
  )
  console.log('  ✓ electron-builder.config.mjs')

  // .github/workflows/ci.yml: remove Rust steps
  const ciPath = join(projectDir, '.github/workflows/ci.yml')
  let ciContent = readFileSync(ciPath, 'utf-8')
  ciContent = ciContent.replace(/\n      - name: Setup Rust\n        uses: dtolnay\/rust-toolchain@stable\n/g, '\n')
  writeFileSync(ciPath, ciContent)
  console.log('  ✓ .github/workflows/ci.yml')

  // .gitignore: remove native entries
  removeLines(join(projectDir, '.gitignore'), [
    /^native\/target\/$/,
    /^native\/\*\.node$/,
    /^native\/index\.cjs$/,
    /^native\/index\.d\.ts$/,
  ])
  console.log('  ✓ .gitignore')
}

async function main() {
  console.log('\n🚀 Electron Template Setup\n')

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const projectName = await prompt(rl, '项目名称 (kebab-case)', 'my-app')
  const appId = await prompt(rl, 'AppId (反向域名)', `com.example.${projectName}`)
  const windowTitle = await prompt(rl, '窗口标题', projectName)
  const author = await prompt(rl, '作者', '')
  const description = await prompt(rl, '项目描述', '')
  const repository = await prompt(rl, '仓库地址', '')
  const useNative = await prompt(rl, '使用 Rust native 模块示例 (y/n)', 'y')

  rl.close()

  console.log('\n📝 替换占位符...\n')

  for (const file of files) {
    const filePath = join(projectDir, file)
    let content = readFileSync(filePath, 'utf-8')

    content = content.replaceAll(PLACEHOLDERS.projectName, projectName)
    content = content.replaceAll(PLACEHOLDERS.appId, appId)
    content = content.replaceAll(PLACEHOLDERS.windowTitle, windowTitle)

    if (author) content = content.replace(/"author": "",/, `"author": "${author}",`)
    if (description)
      content = content.replace(
        /"description": ".*?"/,
        `"description": "${description}"`,
      )
    if (repository)
      content = content.replace(/"repository": "",/, `"repository": "${repository}",`)

    writeFileSync(filePath, content)
    console.log(`  ✓ ${file}`)
  }

  if (useNative.toLowerCase() !== 'y') {
    removeNativeModule()
  }

  console.log('\n✅ 完成！运行 pnpm install && pnpm run dev 开始开发\n')
}

main()
