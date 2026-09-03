// Re-fetch the npm registry snapshot for every package listed in
// data/packages.json, UTF-8-safe (plain Node fetch, no shell encoding in
// the path). Reports descriptions that look truncated or double-encoded.
// Usage: node scripts/refresh-snapshot.mjs
// Outputs: data/npm-snapshot.json

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const base = fileURLToPath(new URL('..', import.meta.url))
const stripBom = (value) => value.replace(/^\uFEFF/, '')
const packages = JSON.parse(stripBom(await readFile(`${base}/data/packages.json`, 'utf8')))

const registryUrl = (name) =>
  `https://registry.npmjs.org/${name.startsWith('@') ? name.replace('/', '%2F') : name}`

const snapshot = []
const warnings = []
for (const pkg of packages) {
  const res = await fetch(registryUrl(pkg.npm), { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`registry fetch failed for ${pkg.npm}: HTTP ${res.status}`)
  const doc = await res.json()
  const latest = doc['dist-tags']?.latest
  const entry = {
    name: doc.name,
    description: typeof doc.description === 'string' ? doc.description : undefined,
    license: typeof doc.license === 'string' && doc.license.length <= 80 ? doc.license : undefined,
    homepage: typeof doc.homepage === 'string' && /^https:/.test(doc.homepage) ? doc.homepage : undefined,
    repository: typeof doc.repository === 'string' ? doc.repository
      : (doc.repository?.url ?? undefined),
    latest,
    updatedAt: latest ? doc.time?.[latest] : undefined,
  }
  const desc = entry.description ?? ''
  if (desc.length > 0 && !/[.!?)—–"」』]$/.test(desc.trim())) {
    warnings.push(`possible truncation: ${pkg.npm} ends "${desc.trim().slice(-24)}"`)
  }
  if (/â|Ã.|é|ð|Â./.test(desc)) {
    warnings.push(`double-encoded mojibake: ${pkg.npm}`)
  }
  snapshot.push(entry)
}

await writeFile(`${base}/data/npm-snapshot.json`, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`snapshot refreshed: ${snapshot.length} packages -> data/npm-snapshot.json`)
for (const warning of warnings) console.log(`WARN ${warning}`)
if (warnings.length === 0) console.log('no truncation or mojibake heuristics hit')
