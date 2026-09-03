// Deno Deploy worker for the PerryLink DSH Catalog standard source.
// Serves /catalog-source.json and /v1/plugins as application/json from the
// committed artifacts (imported at deploy time, so no runtime reads needed).
// Deploy this folder to Deno Deploy, then rebuild the manifest with
// DEPLOY_ORIGIN=https://<your-project>.deno.dev node scripts/build-catalog.mjs
// so the manifest endpoint matches its own origin (the market enforces
// same-origin manifest + endpoint).

import manifest from './catalog-source.json' with { type: 'json' }
import page from './artifacts/v1/plugins.json' with { type: 'json' }

const text = (payload) => new Response(JSON.stringify(payload), {
  headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
})

Deno.serve((request) => {
  const { pathname } = new URL(request.url)
  if (request.method !== 'GET') return new Response('method not allowed', { status: 405 })
  if (pathname === '/catalog-source.json') return text(manifest)
  if (pathname === '/v1/plugins') return text(page)
  return new Response('not found', { status: 404 })
})
