import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const worker = readFileSync('public/sw.js', 'utf8')

describe('PWA privacy contract', () => {
  test('versions its cache, serves a public offline page, and can purge every cache on sign-out', () => {
    expect(worker).toMatch(/ajinkyans-shell-v\d+/)
    expect(worker).toContain("caches.match('/offline.html')")
    expect(worker).toContain('ajinkyans:purge-caches')
    expect(worker).toContain('names.map((name) => caches.delete(name))')
  })

  test('does not cache navigation, Firebase responses, or arbitrary private media', () => {
    expect(worker).toContain("path.startsWith('/assets/') || path.startsWith('/icons/')")
    expect(worker).not.toContain("caches.match('/index.html')")
    expect(worker).not.toContain("['script', 'style', 'font', 'image', 'manifest']")
  })
})
