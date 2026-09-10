# dsh-catalog

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-catalog)
[![npm version](https://img.shields.io/npm/v/dsh-catalog)](https://www.npmjs.com/package/dsh-catalog)
[![npm downloads](https://img.shields.io/npm/dm/dsh-catalog)](https://www.npmjs.com/package/dsh-catalog)

A [DSH Community Market](https://github.com/anywhere-labs/dsh-desktop/tree/main/dsh-community-market) **standard catalog source** for the PerryLink DeepSeek Harness plugin family: 39 npm packages, generated from the npm registry, validated against the public v1 contract schemas.

- Manifest: `catalog-source.json` (generated; see Deploy)
- Provider page: `artifacts/v1/plugins.json` (generated)
- Source of truth: `data/packages.json` (npm name → repo → display name → categories) + `data/npm-snapshot.json` (npm registry snapshot)
- Generator / validator: `scripts/build-catalog.mjs`, `scripts/validate.mjs`
- Deploy: live at `https://perrylink-dsh-catalog.perrylink.workers.dev` (Cloudflare Workers, automated via `deploy.yml`; Vercel static alternative in `vercel.json`; Deno unit `deploy/deno-worker.js` as manual alternative)

## Compliance notes

- Contract: [catalog-provider-contract.md](https://github.com/anywhere-labs/dsh-desktop/blob/main/dsh-community-market/docs/catalog-provider-contract.md) (v1, `manifestVersion`/`schemaVersion` `1.0.0`). The schemas are vendored nowhere in this repo; `scripts/validate.mjs` mirrors the structural rules of `catalog-source.schema.json` and `catalog-provider-page.schema.json` and the cross-field rules (unique item ids, npm name pattern, no install commands in items, HTTPS repository URLs, page shape).
- The minimal valid profile is used: `query.supported = []`, `defaultLimit = maxLimit = 50`, `sorts = []`. The endpoint returns the complete bounded page (39 items ≤ 50), so DSH Desktop scans it in one request and runs search/filtering over its local index.
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

### Maintaining `data/`

`data/packages.json` and `data/npm-snapshot.json` are **one unit**: a new or renamed package
needs its snapshot row *in the same commit*. Two consecutive `main` deploys went red on
2026-09-09 exactly this way — first a missing comma in `data/packages.json`, then a package
listed without its snapshot row (`Error: npm snapshot missing for …`). Both are caught locally
by the pre-push gate; enable it once per clone:

```sh
git config core.hooksPath .githooks   # then every push runs node scripts/check-data.mjs
```

`scripts/check-data.mjs` is read-only. Do **not** use `node scripts/build-catalog.mjs` as a
gate: called without an argument it rewrites the committed `deploy/` artifacts with the
placeholder origin.

`.github/workflows/ci.yml` runs `scripts/check-data.mjs` plus the build/validate pair on every
push to `main` and on every pull request, so the hook above is a convenience rather than the
only line of defence. CI additionally stages the committed `deploy/` copies at the repository
root and validates *those* — the payload that actually ships — then rebuilds to assert that the
committed `deploy/catalog-source.json` still matches, which catches a `data/` change that was
never mirrored into `deploy/`. That rebuild is the one place the no-argument form is safe: the
runner's checkout is throwaway, and the manifest carries no timestamp, so it is
byte-reproducible.

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

PerryLink 全家桶的 [DSH Community Market](https://github.com/anywhere-labs/dsh-desktop/tree/main/dsh-community-market) 标准目录源：39 个 npm 包，由 npm registry 生成，按公开 v1 契约做结构校验。已上线 Cloudflare Workers（`perrylink-dsh-catalog.perrylink.workers.dev`，deploy workflow 自动部署；Vercel 静态重写与 Deno Deploy 为备选通道）。每个条目还带同源 `media.icon` 图标（`/icons/*.png`，由 `scripts/build-icons.mjs` 确定性生成）。在 DSH Desktop 的 市场 → Sources 里添加 manifest URL 即可浏览（浏览只读；安装仍走市场自身的 npm 身份校验与用户确认）。生成产物中的占位域名 `replace-with-deploy-origin.invalid` 在部署时替换，请勿直接注册占位地址。**维护纪律**：`data/packages.json` 与 `data/npm-snapshot.json` 必须同一次 commit 成对更新（2026-09-09 连续两次 `main` 部署红灯即由此而来：先是漏逗号，后是新增包缺 npm 快照行）；执行一次 `git config core.hooksPath .githooks` 后，每次 push 都会跑只读门禁 `scripts/check-data.mjs`。切勿把不带参数的 `node scripts/build-catalog.mjs` 当作门禁——它会把已入库的 `deploy/` 产物改写成占位域名。**CI**：`.github/workflows/ci.yml` 在每次 push 到 `main` 与每个 PR 上跑 `scripts/check-data.mjs` 与 build+validate，并且先校验已入库的 `deploy/` 产物（真正上线的载荷）、再重建断言 `deploy/catalog-source.json` 未过期，可发现「改了 `data/` 却没重建 `deploy/`」；该重建在 CI 的一次性 checkout 里是安全的，因为 manifest 不含时间戳、可字节复现。

## License

Apache-2.0. Catalog data derives from the npm registry and the PerryLink plugin repositories.
