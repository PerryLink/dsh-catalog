// Cloudflare Workers entry for the PerryLink DSH Catalog standard source.
// Serves /catalog-source.json and /v1/plugins as application/json from the
// committed deploy/ copies (imported at build time, so no KV or runtime
// reads are needed). The deploy/ folder is self-contained: build-catalog.mjs
// mirrors both artifacts into it.
import manifest from './catalog-source.json' with { type: 'json' }
import page from './artifacts/v1/plugins.json' with { type: 'json' }

const text = (payload) => new Response(JSON.stringify(payload), {
  headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
})

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url)
    if (request.method !== 'GET') return new Response('method not allowed', { status: 405 })
    if (pathname === '/catalog-source.json') return text(manifest)
    if (pathname === '/v1/plugins') return text(page)
    return new Response('not found', { status: 404 })
  },
}
