// Build the DSH Community Market standard-source artifacts from the npm
// snapshot (data/npm-snapshot.json) and the local table (data/packages.json).
// Usage: node scripts/build-catalog.mjs [deployOrigin]
// Outputs: artifacts/v1/plugins.json (provider page), catalog-source.json
// (manifest; endpoint = deployOrigin/v1/plugins, or an explicit placeholder
// when deployOrigin is omitted).

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const base = fileURLToPath(new URL('..', import.meta.url))
const deployOrigin = process.argv[2] ?? 'https://replace-with-deploy-origin.invalid'

const stripBom = (value) => value.replace(/^\uFEFF/, '')
const packages = JSON.parse(stripBom(await readFile(`${base}/data/packages.json`, 'utf8')))
const snapshot = JSON.parse(stripBom(await readFile(`${base}/data/npm-snapshot.json`, 'utf8')))
const byName = new Map(snapshot.map((entry) => [entry.name, entry]))

// Strip control characters and bidi controls: the wire schema rejects them.
const clean = (value) => {
  if (typeof value !== 'string') return value
  return value.replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, ' ')
}

const items = []
for (const pkg of packages) {
  const npm = byName.get(pkg.npm)
  if (!npm) throw new Error(`npm snapshot missing for ${pkg.npm}`)
  const repositoryUrl = `https://github.com/${pkg.repo}`
  const iconSlug = pkg.npm.replace(/^@/, '').replace(/[^A-Za-z0-9._-]/g, '-')
  const item = {
    id: pkg.npm.startsWith('@') ? pkg.npm.slice(1) : pkg.npm,
    name: pkg.npm,
    displayName: clean(pkg.displayName),
    summary: clean(pkg.summary ?? npm.description ?? `${pkg.displayName}: DeepSeek Harness (dsh) plugin.`).slice(0, 1000),
    homepage: npm.homepage && /^https:/.test(npm.homepage) ? npm.homepage : repositoryUrl,
    latestVersion: npm.latest,
    license: typeof npm.license === 'string' && npm.license.length <= 80 ? npm.license : undefined,
    categories: pkg.categories,
    repository: { url: repositoryUrl },
    package: { registry: 'npm', name: pkg.npm },
    publisher: { name: 'PerryLink', url: 'https://github.com/PerryLink' },
    media: { icon: { url: `${deployOrigin}/icons/${iconSlug}.png`, alt: pkg.displayName } },
    updatedAt: npm.updatedAt,
  }
  items.push(item)
}

const page = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  revision: `perrylink-dsh-catalog-${new Date().toISOString().slice(0, 10)}`,
  items,
  page: { total: items.length },
}

const manifest = {
  manifestVersion: '1.0.0',
  providerId: 'com.perrylink.dsh-catalog',
  name: 'PerryLink DSH Catalog',
  description: `Official catalog of the ${packages.length}-package PerryLink DeepSeek Harness plugin family on npm.`,
  homepage: 'https://github.com/PerryLink/dsh-catalog',
  attribution: { name: 'PerryLink', url: 'https://github.com/PerryLink' },
  transport: { kind: 'https-json', endpoint: `${deployOrigin}/v1/plugins`, method: 'GET' },
  query: { supported: [], defaultLimit: 50, maxLimit: 50, sorts: [] },
}

await mkdir(`${base}/artifacts/v1`, { recursive: true })
await writeFile(`${base}/artifacts/v1/plugins.json`, `${JSON.stringify(page, null, 2)}\n`)
await writeFile(`${base}/catalog-source.json`, `${JSON.stringify(manifest, null, 2)}\n`)
// The deploy unit (deploy/deno-worker.js) imports its payload with
// ./-relative specifiers, so it must be self-contained: mirror both
// artifacts into deploy/ so any Deno Deploy project rooted at deploy/
// (or the whole repo) serves the same content.
await mkdir(`${base}/deploy/artifacts/v1`, { recursive: true })
await writeFile(`${base}/deploy/artifacts/v1/plugins.json`, `${JSON.stringify(page, null, 2)}\n`)
await writeFile(`${base}/deploy/catalog-source.json`, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`built ${items.length} items -> artifacts/v1/plugins.json + deploy/ copies (endpoint ${deployOrigin}/v1/plugins)`)
