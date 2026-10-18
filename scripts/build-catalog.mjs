// Build the DSH Community Market standard-source artifacts from the npm
// snapshot (data/npm-snapshot.json) and the local table (data/packages.json).
// Usage: node scripts/build-catalog.mjs [deployOrigin]
// Outputs: artifacts/v1/plugins.json (provider page), catalog-source.json
// (manifest; endpoint = deployOrigin/v1/plugins, or an explicit placeholder
// when deployOrigin is omitted).
//
// ⚠️ Every item also carries the Chinese pair (`displayNameZh` / `summaryZh`) when
// data/packages.json declares it, so the market can render a Chinese name for a
// Chinese reader. Those two fields were in data/packages.json long before this
// generator read them; until 2026-10-13 it dropped them, which is why the live
// endpoint served 0 Chinese names for 96 items. `scripts/check-counts.mjs` now
// holds the ratio, so the drop cannot come back silently.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** One row of data/npm-snapshot.json; only the fields this script reads. */
/** @typedef {{ name: string, description?: string, homepage?: string, license?: string, latest?: string, updatedAt?: string }} SnapshotRow */

const base = fileURLToPath(new URL('..', import.meta.url))
const deployOrigin = process.argv[2] ?? 'https://replace-with-deploy-origin.invalid'

/** @param {string} value */
const stripBom = (value) => value.replace(/^\uFEFF/, '')
/** @type {Array<{ npm: string, repo: string, displayName: string, displayNameZh?: string, summary?: string, summaryZh?: string, categories: string[], locale?: string, npmRepository?: string }>} */
const packages = JSON.parse(stripBom(await readFile(`${base}/data/packages.json`, 'utf8')))
const snapshot = JSON.parse(stripBom(await readFile(`${base}/data/npm-snapshot.json`, 'utf8')))
const byName = new Map(snapshot.map((/** @type {SnapshotRow} */ entry) => [entry.name, entry]))

// Strip control characters and bidi controls: the wire schema rejects them.
// Every call site passes a string (the `??` chain always ends in a literal);
// the internal typeof guard stays as the runtime safety net.
/** @param {string} value @returns {string} */
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
  // Both Chinese fields are carried only when data/packages.json declares them, so a
  // row that has not been translated yet emits no empty string (the market's own
  // schema extension: exporters read these, nothing installs from them). `clean` is
  // applied for the same reason as displayName/summary — the wire schema rejects
  // control characters and bidi controls.
  const displayNameZh = typeof pkg.displayNameZh === 'string' && pkg.displayNameZh.length > 0 ? clean(pkg.displayNameZh) : undefined
  const summaryZh = typeof pkg.summaryZh === 'string' && pkg.summaryZh.length > 0 ? clean(pkg.summaryZh).slice(0, 1000) : undefined
  const item = {
    id: pkg.npm.startsWith('@') ? pkg.npm.slice(1) : pkg.npm,
    name: pkg.npm,
    displayName: clean(pkg.displayName),
    ...(displayNameZh === undefined ? {} : { displayNameZh }),
    summary: clean(pkg.summary ?? npm.description ?? `${pkg.displayName}: DeepSeek Harness (dsh) plugin.`).slice(0, 1000),
    ...(summaryZh === undefined ? {} : { summaryZh }),
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

// The manifest description states the count in prose, so it must also state what the
// count is OF: `check-counts.mjs` holds the `N-package` token to data/packages.json's
// row count, and the composition is derived here rather than typed, because one row in
// this table is a third-party package (`Phocinae/dsh-phocinae`) and calling all 97
// "PerryLink" would overstate the family.
const familyRows = packages.filter((pkg) => pkg.repo.startsWith('PerryLink/')).length
const thirdPartyRows = packages.length - familyRows

const manifest = {
  manifestVersion: '1.0.0',
  providerId: 'com.perrylink.dsh-catalog',
  name: 'PerryLink DSH Catalog',
  description:
    `Official catalog of the ${packages.length}-package PerryLink DeepSeek Harness plugin family on npm: ` +
    `${familyRows} family repositories plus ${thirdPartyRows} third-party package catalogued alongside them.`,
  homepage: 'https://github.com/PerryLink/dsh-catalog',
  attribution: { name: 'PerryLink', url: 'https://github.com/PerryLink' },
  transport: { kind: 'https-json', endpoint: `${deployOrigin}/v1/plugins`, method: 'GET' },
  query: { supported: /** @type {string[]} */ ([]), defaultLimit: 50, maxLimit: 50, sorts: /** @type {string[]} */ ([]) },
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
