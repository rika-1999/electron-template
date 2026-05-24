#!/usr/bin/env node
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
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

async function main() {
  console.log('\n🚀 Electron Template Setup\n')

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const projectName = await prompt(rl, '项目名称 (kebab-case)', 'my-app')
  const appId = await prompt(rl, 'AppId (反向域名)', `com.example.${projectName}`)
  const windowTitle = await prompt(rl, '窗口标题', projectName)
  const author = await prompt(rl, '作者', '')
  const description = await prompt(rl, '项目描述', '')
  const repository = await prompt(rl, '仓库地址', '')

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

  console.log('\n✅ 完成！运行 pnpm install && pnpm run dev 开始开发\n')
}

main()
