import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

const roots = ['src', 'functions/src', 'tests', 'scripts', 'public']
const rootSourceFiles = ['vite.config.ts', 'playwright.config.ts', 'vitest.rules.config.ts']
const sourceExtensions = new Set(['.ts', '.tsx', '.css', '.js', '.mjs'])
const files = []

async function collect(directory) {
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry)
    if ((await stat(path)).isDirectory()) await collect(path)
    else if (sourceExtensions.has(path.slice(path.lastIndexOf('.')))) files.push(path)
  }
}

for (const root of roots) await collect(root)
files.push(...rootSourceFiles)
const failures = []
for (const file of files) {
  const content = await readFile(file, 'utf8')
  const lines = content.split('\n').length - (content.endsWith('\n') ? 1 : 0)
  if (lines > 300) failures.push(`${file} has ${lines} lines (maximum is 300).`)
  if (file !== 'src/styles/tokens.css' && /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(content)) failures.push(`${file} contains a hard-coded color literal.`)
}
if (failures.length) throw new Error(failures.join('\n'))
console.log(`Architecture checks passed for ${files.length} source files.`)
