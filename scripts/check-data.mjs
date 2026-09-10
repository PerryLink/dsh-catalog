// Read-only pre-push gate for the catalog data (data/packages.json +
// data/npm-snapshot.json). Run by .githooks/pre-push.
//
// Why it exists: two consecutive `main` deploys went red on 2026-09-09.
//   523fe7c  data/packages.json lost a comma -> build-catalog.mjs died inside JSON.parse:
//            "Expected ',' or ']' after array element in JSON at position 11940"
//   c8fdb57  data/npm-snapshot.json had no row for the package that had just been added:
//            "Error: npm snapshot missing for dsh-plugin-upgrade"
// Both are reproduced here. This script never writes anything: calling
// `node scripts/build-catalog.mjs` without an argument rewrites the committed deploy
// artifacts with the placeholder origin, so it must not be used as a push gate.
//
// Usage: node scripts/check-data.mjs
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const base = fileURLToPath(new URL('..', import.meta.url))
const stripBom = (value) => value.replace(/^\uFEFF/, '')
const failures = []

const load = async (file) => {
  const raw = await readFile(`${base}/data/${file}`, 'utf8')
  try {
    return JSON.parse(stripBom(raw))
  } catch (error) {
    failures.push(`data/${file} is not valid JSON: ${error.message}`)
    return null
  }
}

const packages = await load('packages.json')
const snapshot = await load('npm-snapshot.json')

if (packages && !Array.isArray(packages)) failures.push('data/packages.json must be a top-level array')
if (snapshot && !Array.isArray(snapshot)) failures.push('data/npm-snapshot.json must be a top-level array')

if (Array.isArray(packages)) {
  const seen = new Set()
  packages.forEach((pkg, index) => {
    const where = `data/packages.json[${index}]`
    const values = pkg && typeof pkg === 'object' ? pkg : {}
    for (const key of ['npm', 'repo', 'displayName', 'categories']) {
      const value = values[key]
      if (typeof value !== 'string' && !Array.isArray(value)) failures.push(`${where} is missing "${key}"`)
    }
    if (typeof values.npm !== 'string') return
    if (seen.has(values.npm)) failures.push(`${where} duplicates the npm name "${values.npm}"`)
    seen.add(values.npm)
  })
}

if (Array.isArray(snapshot)) {
  const byName = new Map()
  snapshot.forEach((entry, index) => {
    const values = entry && typeof entry === 'object' ? entry : {}
    if (typeof values.name !== 'string') {
      failures.push(`data/npm-snapshot.json[${index}] is missing "name"`)
      return
    }
    if (byName.has(values.name)) failures.push(`data/npm-snapshot.json[${index}] duplicates "${values.name}"`)
    byName.set(values.name, values)
  })

  if (Array.isArray(packages)) {
    for (const pkg of packages) {
      const values = pkg && typeof pkg === 'object' ? pkg : {}
      if (typeof values.npm !== 'string') continue
      const entry = byName.get(values.npm)
      if (!entry) {
        failures.push(`npm snapshot missing for ${values.npm} — add its row to data/npm-snapshot.json in the same commit`)
      } else if (typeof entry.latest !== 'string') {
        failures.push(`data/npm-snapshot.json row "${values.npm}" has no "latest" version`)
      }
    }
    const listed = new Set(packages.map((pkg) => (pkg && typeof pkg === 'object' ? pkg.npm : undefined)))
    for (const entry of snapshot) {
      const values = entry && typeof entry === 'object' ? entry : {}
      if (typeof values.name === 'string' && !listed.has(values.name)) {
        console.warn(`check-data warning: data/npm-snapshot.json carries "${values.name}", which data/packages.json does not list`)
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`check-data: ${failures.length} problem(s) — push refused:`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`check-data ok: ${packages.length} packages, every entry has a snapshot row`)
