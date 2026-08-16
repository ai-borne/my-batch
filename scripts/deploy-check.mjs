#!/usr/bin/env node
/**
 * deploy-check.mjs — one command to answer "is production fully deployed?"
 *
 * Compares the cloud functions exported in source against what is actually
 * deployed to the target Firebase project, and reports any gaps. This catches
 * the class of bug where the frontend ships but the backend callables it
 * depends on were never deployed (e.g. listDirectoryHouses / listDirectoryMembers).
 *
 * Usage:
 *   node scripts/deploy-check.mjs --project <project-id>
 *
 * Exit code 0 when source and deployed functions match; non-zero otherwise.
 */
import { execFileSync } from 'node:child_process'

const projectArgIndex = process.argv.indexOf('--project')
const project = projectArgIndex !== -1 ? process.argv[projectArgIndex + 1] : process.env.FIREBASE_PROJECT_ID
if (!project) {
  console.error('Usage: node scripts/deploy-check.mjs --project <project-id>')
  process.exit(2)
}

function sourceFunctions() {
  const index = execFileSync('grep', ['-oE', 'export \\{ [^}]+', 'functions/src/index.ts'], { encoding: 'utf8' })
  const names = new Set()
  for (const line of index.split('\n')) {
    for (const token of line.replace(/^export \{/, '').split(',')) {
      const name = token.trim().match(/^[A-Za-z_$][A-Za-z0-9_$]*/)
      if (name) names.add(name[0])
    }
  }
  return names
}

function deployedFunctions() {
  const output = execFileSync('firebase', ['functions:list', '--project', project], { encoding: 'utf8' })
  const names = new Set()
  for (const rawLine of output.split('\n')) {
    const line = rawLine.replace(/\x1b\[[0-9;]*m/g, '')
    const match = line.match(/^\s*[│|]\s*([A-Za-z_$][A-Za-z0-9_$]*)/)
    if (match && match[1] !== 'Function') names.add(match[1])
  }
  return names
}

const source = sourceFunctions()
const deployed = deployedFunctions()
const missing = [...source].filter((name) => !deployed.has(name)).sort()
const extra = [...deployed].filter((name) => !source.has(name)).sort()

console.log(`\nDeploy check for project: ${project}`)
console.log(`  Source functions:      ${source.size}`)
console.log(`  Deployed functions:    ${deployed.size}`)

if (missing.length) {
  console.log(`\n  MISSING from production (in source, not deployed):`)
  for (const name of missing) console.log(`    - ${name}`)
}
if (extra.length) {
  console.log(`\n  Deployed but NOT in source (stale):`)
  for (const name of extra) console.log(`    - ${name}`)
}

if (!missing.length && !extra.length) {
  console.log('\n  OK: source and deployed functions match.\n')
  process.exit(0)
}
console.log('\n  Fix: run `firebase deploy --only functions --project ' + project + '`\n')
process.exit(1)