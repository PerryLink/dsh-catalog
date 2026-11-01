#!/usr/bin/env node
// @ts-nocheck
// Validate the taxonomy sidecar against the committed provider page.
// The v1 item contract has no taxonomy member, so this sidecar is the
// machine-readable projection of TA2000's four axes.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const base = fileURLToPath(new URL('..', import.meta.url))
const stripBom = (value) => value.replace(/^\uFEFF/, '')
const read = async (p) => JSON.parse(stripBom(await readFile(`${base}/${p}`, 'utf8')))
const page = await read('deploy/artifacts/v1/plugins.json')
const tax = await read('deploy/artifacts/v1/taxonomy.json')
const failures = []
const check = (ok, message) => { if (!ok) failures.push(message) }
const categories = new Set(['security','workflow','developer-tools','integrations','research','content','data','observability','interface','business-ops','compliance','platform'])
const archetypes = new Set(['checker','validator','doctor','inspector','ingest','extractor','assistant','reconciler','calculator','ledger','drafter','integration','ui','runtime','suite','catalog'])
const statuses = new Set(['active','frozen','retired'])

check(tax.schema === 'dsh-taxonomy-sidecar/1', 'taxonomy schema')
check(tax.revision === page.revision, 'taxonomy revision must equal page revision')
check(tax.generatedAt === page.generatedAt, 'taxonomy generatedAt must equal page generatedAt')
check(Array.isArray(tax.packages) && tax.packages.length === page.items.length, 'taxonomy must cover every page item')
const byName = new Map(tax.packages.map((x) => [x.name, x]))
for (const item of page.items) {
  const tx = byName.get(item.name)
  check(Boolean(tx), `taxonomy missing ${item.name}`)
  if (!tx) continue
  check(categories.has(tx.category), `unknown category ${tx.category} (${item.name})`)
  check(archetypes.has(tx.archetype), `unknown archetype ${tx.archetype} (${item.name})`)
  check(statuses.has(tx.status), `unknown status ${tx.status} (${item.name})`)
  check(Array.isArray(tx.domains), `domains must be an array (${item.name})`)
  check(JSON.stringify(item.categories) === JSON.stringify([tx.category]), `page categories must be [${tx.category}] (${item.name})`)
}
check(tax.categories.length === 12, 'catalog must expose 12 categories')
for (const c of categories) check(tax.categories.includes(c), `missing category in sidecar ${c}`)

if (failures.length) {
  console.error(`FAIL ${failures.length} taxonomy checks:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`taxonomy ok: ${tax.packages.length} packages, ${tax.categories.length} categories, ${tax.archetypes.length} archetypes`)
