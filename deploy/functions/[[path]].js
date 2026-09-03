// Pages Function entry (catch-all). Serves /catalog-source.json and
// /v1/plugins as application/json from the deploy/ JSON imports, so the
// Pages project is fully self-contained; every other path falls through
// to the static assets (context.next()).
import manifest from '../catalog-source.json' with { type: 'json' }
import page from '../artifacts/v1/plugins.json' with { type: 'json' }

const text = (payload) => new Response(JSON.stringify(payload), {
  headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
})

export function onRequest(context) {
  const { pathname } = new URL(context.request.url)
  if (context.request.method !== 'GET') return new Response('method not allowed', { status: 405 })
  if (pathname === '/catalog-source.json') return text(manifest)
  if (pathname === '/v1/plugins') return text(page)
  return context.next()
}
