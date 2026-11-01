// Validate the read-only level sidecar (`dsh-levels-sidecar/1`) against the
// catalog page it describes. The sidecar exists because the v1 item contract
// has no `levels` member: this gate keeps the sidecar honest without touching
// any item field.
//
// Usage: node scripts/check-levels.mjs
// Exit:  0 = all checks pass; 2 = at least one violation.
//
// It resolves deploy/ first because that is the committed, shipped payload and
// the only copy a fresh clone has; the root artifacts/ copy is the local build
// output. When both copies exist they must agree, so a stale mirror cannot
// pass while the other copy says something different.
//
// Beyond the structural checks, the gate holds the sidecar to the page
// (`revision` equality), requires one entry per catalog item (no silent gap),
// and requires an evidenceUrl whenever a row claims runtime/measured/manual.
// A row with no evidence is `not-run` / `not-measured`; a PASS is never
// inferred from the presence of an A-D attestation, which is orthogonal.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const base = fileURLToPath(new URL('..', import.meta.url))
/** @type {string[]} */
const failures = []
/** @type {string[]} */
const warnings = []
/** @param {boolean} ok @param {string} message */
const check = (ok, message) => { if (!ok) failures.push(message) }
/** @param {string} value */
const stripBom = (value) => value.replace(/^\uFEFF/, '')
/** @param {string} relative @returns {string} */
const absolute = (relative) => `${base}/${relative}`
/** @param {string[]} relatives @returns {string | undefined} */
const firstExisting = (relatives) => relatives.find((relative) => existsSync(absolute(relative)))
/** @param {string} relative @returns {Promise<any>} */
const readJson = async (relative) => {
  try {
    return JSON.parse(stripBom(await readFile(absolute(relative), 'utf8')))
  } catch (error) {
    console.error(`check-levels: FAIL cannot read ${relative}: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(2)
  }
}

const pageFile = firstExisting(['deploy/artifacts/v1/plugins.json', 'artifacts/v1/plugins.json'])
if (pageFile === undefined) {
  console.error('check-levels: FAIL no catalog page found (deploy/artifacts/v1/plugins.json or artifacts/v1/plugins.json)')
  process.exit(2)
}
const sidecarFiles = ['deploy/artifacts/v1/levels.json', 'artifacts/v1/levels.json']
  .filter((relative) => existsSync(absolute(relative)))
if (sidecarFiles.length === 0) {
  console.error('check-levels: FAIL no level sidecar found (deploy/artifacts/v1/levels.json or artifacts/v1/levels.json); run node scripts/build-catalog.mjs')
  process.exit(2)
}

const sidecarCopies = await Promise.all(sidecarFiles.map(readJson))
const sidecar = sidecarCopies[0]
if (sidecarCopies.length === 2 && JSON.stringify(sidecarCopies[0]) !== JSON.stringify(sidecarCopies[1])) {
  console.error(
    `check-levels: FAIL ${sidecarFiles[0]} and ${sidecarFiles[1]} differ; rebuild with node scripts/build-catalog.mjs so the committed mirror matches the local artifact`,
  )
  process.exit(2)
}
if (sidecar === null || typeof sidecar !== 'object' || Array.isArray(sidecar)) {
  console.error('check-levels: FAIL the level sidecar must be a JSON object')
  process.exit(2)
}

const page = await readJson(pageFile)
if (page === null || typeof page !== 'object' || Array.isArray(page)) {
  console.error('check-levels: FAIL the catalog page must be a JSON object')
  process.exit(2)
}

// ---------------------------------------------------------------------------
// Top-level shape.
// ---------------------------------------------------------------------------
check(sidecar.schema === 'dsh-levels-sidecar/1', `schema must be "dsh-levels-sidecar/1" (got ${JSON.stringify(sidecar.schema)})`)
check(typeof sidecar.revision === 'string' && sidecar.revision.length > 0, 'revision must be a non-empty string')
check(
  sidecar.revision === page.revision,
  `revision ${JSON.stringify(sidecar.revision)} must equal the catalog page revision ${JSON.stringify(page.revision)}`,
)
check(
  typeof sidecar.generatedAt === 'string' && sidecar.generatedAt.length > 0 && !Number.isNaN(Date.parse(sidecar.generatedAt)),
  'generatedAt must be a parseable date/time string',
)
check(
  typeof sidecar.source === 'string' && /^https:\/\/\S+$/.test(sidecar.source) && sidecar.source.endsWith('/publish/attestations/index.json'),
  'source must be an https URL pointing at .../publish/attestations/index.json',
)
check(
  typeof sidecar.disclaimer === 'string' && sidecar.disclaimer.trim().length >= 12,
  'disclaimer must be a non-empty string (at least 12 characters) carrying the non-official / non-certification denial',
)

// ---------------------------------------------------------------------------
// Per-package shape. The enums mirror adoption/market/label.schema.json.
// ---------------------------------------------------------------------------
/** @type {Record<string, string[]>} */
const STATUSES = {
  entry: ['recognized', 'static', 'runtime', 'blocked', 'failed', 'not-run', 'stale', 'withdrawn', 'not-applicable'],
  flow: ['manual', 'runtime', 'failed', 'not-run', 'stale', 'withdrawn', 'not-applicable'],
  boost: ['measured', 'not-measured', 'failed', 'stale', 'withdrawn', 'not-applicable'],
}
/** @type {string[]} */
const LEVELS = ['entry', 'flow', 'boost']
/** @type {string[]} */
const EVIDENCE_REQUIRED = ['runtime', 'measured', 'manual']

check(Array.isArray(sidecar.packages), 'packages must be an array')
const packages = Array.isArray(sidecar.packages) ? sidecar.packages : []
check(packages.length > 0, 'packages must not be empty')

/** @type {Set<string>} */
const seen = new Set()
for (const [index, pkg] of packages.entries()) {
  const where = `packages[${index}]`
  if (pkg === null || typeof pkg !== 'object') {
    check(false, `${where} must be an object`)
    continue
  }
  const nameValid = typeof pkg.name === 'string' && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(pkg.name)
  check(nameValid, `${where}.name must be a valid npm package name`)
  if (typeof pkg.name === 'string') {
    check(!seen.has(pkg.name), `duplicate package name: ${pkg.name}`)
    seen.add(pkg.name)
  }
  for (const level of LEVELS) {
    const status = pkg[level]
    check(
      typeof status === 'string' && STATUSES[level].includes(status),
      `${where}.${level} status ${JSON.stringify(status)} must be one of: ${STATUSES[level].join(', ')}`,
    )
  }
  if (pkg.withdrawn !== undefined) check(typeof pkg.withdrawn === 'boolean', `${where}.withdrawn must be boolean when present`)
  if (pkg.deprecated !== undefined) check(typeof pkg.deprecated === 'boolean', `${where}.deprecated must be boolean when present`)
  if (pkg.peerRange !== undefined) check(typeof pkg.peerRange === 'string' && pkg.peerRange.length > 0, `${where}.peerRange must be a non-empty string when present`)
  if (pkg.dshVersion !== undefined) check(typeof pkg.dshVersion === 'string' && pkg.dshVersion.length > 0, `${where}.dshVersion must be a non-empty string when present`)
  if (pkg.evidenceUrl !== undefined) {
    check(typeof pkg.evidenceUrl === 'string' && /^https:\/\/\S+$/.test(pkg.evidenceUrl), `${where}.evidenceUrl must be an https URL when present`)
  }
  const claims = LEVELS.filter((level) => EVIDENCE_REQUIRED.includes(pkg[level]))
  if (claims.length > 0) {
    check(
      typeof pkg.evidenceUrl === 'string' && /^https:\/\/\S+$/.test(pkg.evidenceUrl),
      `${where}.evidenceUrl is required because ${claims.join('/')} claims runtime/measured/manual`,
    )
  }
}

// ---------------------------------------------------------------------------
// Coverage: every catalog item has exactly one sidecar entry.
// ---------------------------------------------------------------------------
if (!Array.isArray(page.items)) {
  check(false, 'catalog page items must be an array')
} else {
  /** @type {Set<string>} */
  const catalogNames = new Set()
  for (const item of page.items) {
    if (item !== null && typeof item === 'object' && typeof item.name === 'string') catalogNames.add(item.name)
  }
  for (const name of catalogNames) {
    if (!seen.has(name)) failures.push(`packages is missing catalog item: ${name}`)
  }
  for (const name of seen) {
    if (!catalogNames.has(name)) warnings.push(`packages carries ${name}, which is not in the catalog page`)
  }
}

for (const warning of warnings) console.warn(`check-levels warning: ${warning}`)
if (failures.length > 0) {
  console.error(`check-levels: FAIL ${failures.length} problem(s):\n- ${failures.join('\n- ')}`)
  process.exit(2)
}

/** @param {string} level @returns {string} */
const tally = (level) => {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const pkg of packages) counts.set(pkg[level], (counts.get(pkg[level]) ?? 0) + 1)
  return [...counts].map(([status, count]) => `${status}:${count}`).join(', ')
}
const withdrawn = packages.filter((/** @type {any} */ pkg) => pkg.withdrawn === true).length
console.log(
  `check-levels ok: ${packages.length} packages, revision ${sidecar.revision}; entry ${tally('entry')}; flow ${tally('flow')}; boost ${tally('boost')}; withdrawn ${withdrawn}`,
)
