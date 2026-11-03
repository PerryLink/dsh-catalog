// Compare the catalog's 96 package rows with dsh-plugin-kit's machine-readable
// roster. The catalog is a superset by design: it includes third-party entries
// that the kit does not install. This report names the exact difference instead
// of letting readers infer it from two hand-maintained counts.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const kitPath = process.env.DSH_KIT_REPOS ?? '/mnt/d/Projects/dsh/plugins/dsh-plugin-kit/data/repos.json'
const packages = /** @type {Array<{ repo: string }>} */ (JSON.parse(await readFile(`${root}/data/packages.json`, 'utf8')))
const kit = JSON.parse(await readFile(kitPath, 'utf8'))
const rows = /** @type {Array<{ name: string }>} */ (Array.isArray(kit) ? kit : kit.repos)
/** @param {unknown} value */
const ofRepo = (value) => String(value).replace(/^.*github\.com\//u, '').replace(/\.git$/u, '').replace(/^PerryLink\//u, '')
const catalog = new Map(packages.map(row => [ofRepo(row.repo), row]))
const roster = new Map(rows.map(row => [row.name, row]))
const missing = [...roster.keys()].filter(name => !catalog.has(name)).sort()
const extra = [...catalog.keys()].filter(name => !roster.has(name)).sort()
const lines = [
  '# Catalog vs dsh-plugin-kit roster',
  '',
  `Generated: ${new Date().toISOString()}`,
  `- catalog rows: ${packages.length}`,
  `- kit roster entries: ${rows.length}`,
  `- kit entries missing from catalog: ${missing.length}`,
  `- catalog entries outside the kit roster: ${extra.length}`,
  '',
  '## Missing from the catalog',
  '',
  ...(missing.length ? missing.map(name => `- \`${name}\``) : ['- none']),
  '',
  '## Outside the kit roster',
  '',
  ...(extra.length ? extra.map(name => `- \`${name}\` — expected third-party entries, not installed by dsh-kit`) : ['- none']),
  '',
]
const report = `${lines.join('\n')}\n`
if (process.argv.includes('--write')) {
  await writeFile(`${root}/CATALOG-DIFF.md`, report, 'utf8')
  console.log('wrote CATALOG-DIFF.md')
} else {
  process.stdout.write(report)
}
