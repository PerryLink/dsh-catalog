# dsh-catalog

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-catalog)
[![npm version](https://img.shields.io/npm/v/dsh-catalog)](https://www.npmjs.com/package/dsh-catalog)
[![npm downloads](https://img.shields.io/npm/dm/dsh-catalog)](https://www.npmjs.com/package/dsh-catalog)

A [DSH Community Market](https://github.com/anywhere-labs/dsh-desktop/tree/main/dsh-community-market) **standard catalog source** for the PerryLink DeepSeek Harness plugin family: 34 npm packages, generated from the npm registry, validated against the public v1 contract schemas.

- Manifest: `catalog-source.json` (generated; see Deploy)
- Provider page: `artifacts/v1/plugins.json` (generated)
- Source of truth: `data/packages.json` (npm name → repo → display name → categories) + `data/npm-snapshot.json` (npm registry snapshot)
- Generator / validator: `scripts/build-catalog.mjs`, `scripts/validate.mjs`
- Deploy: live at `https://perrylink-dsh-catalog.perrylink.workers.dev` (Cloudflare Workers, automated via `deploy.yml`; Vercel static alternative in `vercel.json`; Deno unit `deploy/deno-worker.js` as manual alternative)

## Compliance notes

- Contract: [catalog-provider-contract.md](https://github.com/anywhere-labs/dsh-desktop/blob/main/dsh-community-market/docs/catalog-provider-contract.md) (v1, `manifestVersion`/`schemaVersion` `1.0.0`). The schemas are vendored nowhere in this repo; `scripts/validate.mjs` mirrors the structural rules of `catalog-source.schema.json` and `catalog-provider-page.schema.json` and the cross-field rules (unique item ids, npm name pattern, no install commands in items, HTTPS repository URLs, page shape).
- The minimal valid profile is used: `query.supported = []`, `defaultLimit = maxLimit = 50`, `sorts = []`. The endpoint returns the complete bounded page (34 items ≤ 50), so DSH Desktop scans it in one request and runs search/filtering over its local index.
- Every item carries `package.registry = "npm"` + `package.name` and a canonical `repository.url`; no install commands, shell fragments or executable data are ever emitted.
- Every item also carries a same-origin `media.icon` (`/icons/<slug>.png`, generated deterministically by `scripts/build-icons.mjs`); the Worker serves the PNGs itself, so the icons stay on the catalog origin as the market media rule requires.
- The manifest endpoint and the manifest itself must share one HTTPS origin (market rule). The generated placeholder endpoint `https://replace-with-deploy-origin.invalid/...` is replaced by the real deploy origin at deploy time — do not register the placeholder URL in DSH Desktop.

## Build

```sh
node scripts/build-catalog.mjs            # placeholder endpoint
node scripts/validate.mjs                 # structural checks
node scripts/build-catalog.mjs https://<your-project>.deno.dev   # real origin
```

`build-catalog.mjs` writes the manifest and provider page to the repo root **and** mirrors both into `deploy/`, so `deploy/deno-worker.js` is a self-contained Deno Deploy unit (its `./` imports always resolve).

`data/npm-snapshot.json` is refreshed UTF-8-safely with:

```sh
node scripts/refresh-snapshot.mjs   # re-fetch every package from registry.npmjs.org
```

## Deploy

**Live**: `https://perrylink-dsh-catalog.perrylink.workers.dev` (Cloudflare Workers, deployed automatically by the `deploy` workflow).

Automated channels — the workflow rebuilds the manifest with the live origin, validates, then deploys; each channel skips gracefully when its token secret is absent:

- **Cloudflare Workers** (active): `deploy/wrangler.toml` + `deploy/cloudflare-worker.js`. Requires `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets. Two-pass deploy: first uploads the placeholder-origin worker, reads the assigned `*.workers.dev` URL, rebuilds the manifest pinned to that origin, and redeploys. Falls back to Cloudflare Pages (`.pages.dev`) when `workers.dev` is unavailable.
- **Vercel**: `vercel.json` rewrite `/v1/plugins` → `artifacts/v1/plugins.json`. Requires `VERCEL_TOKEN`.
- **Deno Deploy** (manual): self-contained `deploy/deno-worker.js`; rebuild with `node scripts/build-catalog.mjs https://<your-project>.deno.dev` before deploying.

The site serves `GET /catalog-source.json` and `GET /v1/plugins` as `application/json` on one HTTPS origin.

## Use in DSH Desktop

Open the built-in Market → **Sources** → add source → paste the manifest URL `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` → select it. Browsing is read-only; installation of any listed plugin goes through the Market's own npm-identity verification and user confirmation.

A listing in this catalog is metadata, not a security review. The same plugins also have evidence records in [dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification) and MCP access via [dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp).

---

## 中文说明

PerryLink 全家桶的 [DSH Community Market](https://github.com/anywhere-labs/dsh-desktop/tree/main/dsh-community-market) 标准目录源：34 个 npm 包，由 npm registry 生成，按公开 v1 契约做结构校验。已上线 Cloudflare Workers（`perrylink-dsh-catalog.perrylink.workers.dev`，deploy workflow 自动部署；Vercel 静态重写与 Deno Deploy 为备选通道）。每个条目还带同源 `media.icon` 图标（`/icons/*.png`，由 `scripts/build-icons.mjs` 确定性生成）。在 DSH Desktop 的 市场 → Sources 里添加 manifest URL 即可浏览（浏览只读；安装仍走市场自身的 npm 身份校验与用户确认）。生成产物中的占位域名 `replace-with-deploy-origin.invalid` 在部署时替换，请勿直接注册占位地址。

## License

Apache-2.0. Catalog data derives from the npm registry and the PerryLink plugin repositories.
