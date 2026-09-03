// Structural validation of the generated artifacts against the public
// DSH Community Market v1 contracts (catalog-source.schema.json and
// catalog-provider-page.schema.json, vendored in ../schemas with attribution).
// Usage: node scripts/validate.mjs

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const base = fileURLToPath(new URL('..', import.meta.url))
const failures = []
const check = (ok, message) => { if (!ok) failures.push(message) }

const stripBom = (value) => value.replace(/^\uFEFF/, '')
const manifest = JSON.parse(stripBom(await readFile(`${base}/catalog-source.json`, 'utf8')))
const page = JSON.parse(stripBom(await readFile(`${base}/artifacts/v1/plugins.json`, 'utf8')))

// catalog-source.schema.json mirrors
check(manifest.manifestVersion === '1.0.0', 'manifestVersion must be 1.0.0')
check(/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(manifest.providerId), 'providerId pattern')
check(typeof manifest.name === 'string' && manifest.name.length >= 1 && manifest.name.length <= 120, 'manifest name bounds')
check(typeof manifest.attribution?.name === 'string' && /^https:\/\//.test(manifest.attribution.url), 'attribution required')
check(manifest.transport?.kind === 'https-json', 'transport kind')
check(manifest.transport?.method === 'GET', 'transport method GET')
check(/^https:\/\/(?![^/?#]*@)(?![^/?#]*:)[^/?#\s]+(?:[^/?#\s]*)?\/v1\/plugins$/.test(manifest.transport?.endpoint ?? ''), 'endpoint must be https and end /v1/plugins')
check(Array.isArray(manifest.query?.supported), 'query.supported array')
check(manifest.query.defaultLimit >= 1 && manifest.query.defaultLimit <= 200, 'defaultLimit bounds')
check(manifest.query.maxLimit >= 1 && manifest.query.maxLimit <= 200, 'maxLimit bounds')
check(manifest.query.defaultLimit <= manifest.query.maxLimit, 'defaultLimit <= maxLimit')
check(Array.isArray(manifest.query.sorts), 'query.sorts array')

// catalog-provider-page.schema.json mirrors
check(page.schemaVersion === '1.0.0', 'schemaVersion must be 1.0.0')
check(Array.isArray(page.items) && page.items.length <= 200, 'items array <= 200')
const ids = new Set()
for (const item of page.items) {
  check(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/.test(item.id), `id pattern: ${item.id}`)
  check(!ids.has(item.id), `duplicate id: ${item.id}`)
  ids.add(item.id)
  check(typeof item.name === 'string' && item.name.length >= 1 && item.name.length <= 160, `name bounds: ${item.id}`)
  check(typeof item.displayName === 'string' && item.displayName.length >= 1 && item.displayName.length <= 120, `displayName bounds: ${item.id}`)
  check(typeof item.summary === 'string' && item.summary.length >= 1 && item.summary.length <= 1000, `summary bounds: ${item.id}`)
  check(!/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/.test(item.name + item.displayName + item.summary), `control characters: ${item.id}`)
  check(item.repository !== undefined || item.package !== undefined, `repository or package identity: ${item.id}`)
  if (item.package) {
    check(item.package.registry === 'npm', `package registry: ${item.id}`)
    check(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(item.package.name), `package name pattern: ${item.id}`)
  }
  if (item.repository) check(/^https:\/\/(?![^/?#]*@)(?![^/?#]*:)/.test(item.repository.url), `repository url: ${item.id}`)
  if (item.media?.icon) {
    check(typeof item.media.icon.url === 'string' && /^https:\/\/[^/?#]+\/icons\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(item.media.icon.url), `icon url shape: ${item.id}`)
    check(item.media.icon.alt === undefined || (typeof item.media.icon.alt === 'string' && item.media.icon.alt.length >= 1 && item.media.icon.alt.length <= 120), `icon alt bounds: ${item.id}`)
    const endpointHost = new URL(manifest.transport.endpoint).host
    check(new URL(item.media.icon.url).host === endpointHost, `icon same-origin as endpoint: ${item.id}`)
  }
  const joined = JSON.stringify(item)
  check(!/dsh\s+plugin\s+--profile|pnpm\s+(add|install)|npm\s+(i|install)/.test(joined), `no install commands: ${item.id}`)
}
check(page.page !== undefined, 'page field required')
if (page.page.total !== undefined) check(page.page.total >= 0 && Number.isInteger(page.page.total), 'page.total bounds')

if (failures.length) {
  console.error(`FAIL ${failures.length} checks:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`validate ok: manifest + ${page.items.length} provider items pass v1 structural checks`)
