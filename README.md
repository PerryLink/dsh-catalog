# dsh-catalog

A [DSH Community Market](https://github.com/anywhere-labs/dsh-desktop/tree/main/dsh-community-market) **standard catalog source** for the PerryLink DeepSeek Harness plugin family: 33 npm packages, generated from the npm registry, validated against the public v1 contract schemas.

- Manifest: `catalog-source.json` (generated; see Deploy)
- Provider page: `artifacts/v1/plugins.json` (generated)
- Source of truth: `data/packages.json` (npm name → repo → display name → categories) + `data/npm-snapshot.json` (npm registry snapshot)
- Generator / validator: `scripts/build-catalog.mjs`, `scripts/validate.mjs`
- Deploy unit: `deploy/deno-worker.js` (Deno Deploy, serves manifest + `/v1/plugins` with `application/json`)

## Compliance notes

- Contract: [catalog-provider-contract.md](https://github.com/anywhere-labs/dsh-desktop/blob/main/dsh-community-market/docs/catalog-provider-contract.md) (v1, `manifestVersion`/`schemaVersion` `1.0.0`). The schemas are vendored nowhere in this repo; `scripts/validate.mjs` mirrors the structural rules of `catalog-source.schema.json` and `catalog-provider-page.schema.json` and the cross-field rules (unique item ids, npm name pattern, no install commands in items, HTTPS repository URLs, page shape).
- The minimal valid profile is used: `query.supported = []`, `defaultLimit = maxLimit = 50`, `sorts = []`. The endpoint returns the complete bounded page (33 items ≤ 50), so DSH Desktop scans it in one request and runs search/filtering over its local index.
- Every item carries `package.registry = "npm"` + `package.name` and a canonical `repository.url`; no install commands, shell fragments or executable data are ever emitted.
- The manifest endpoint and the manifest itself must share one HTTPS origin (market rule). The generated placeholder endpoint `https://replace-with-deploy-origin.invalid/...` is replaced by the real deploy origin at deploy time — do not register the placeholder URL in DSH Desktop.

## Build

```sh
node scripts/build-catalog.mjs            # placeholder endpoint
node scripts/validate.mjs                 # structural checks
node scripts/build-catalog.mjs https://<your-project>.deno.dev   # real origin
```

`data/npm-snapshot.json` is refreshed with:

```powershell
# PowerShell: re-fetch the 33 packages from registry.npmjs.org (see packages.json names)
```

## Deploy (Deno Deploy, free tier)

1. Create a Deno Deploy project pointing at this folder (entry: `deploy/deno-worker.js`).
2. Rebuild with the real origin: `node scripts/build-catalog.mjs https://<your-project>.deno.dev`.
3. Re-deploy. The worker serves `GET /catalog-source.json` and `GET /v1/plugins` as `application/json`.

## Use in DSH Desktop

Open the built-in Market → **Sources** → add source → paste the manifest URL `https://<your-project>.deno.dev/catalog-source.json` → select it. Browsing is read-only; installation of any listed plugin goes through the Market's own npm-identity verification and user confirmation.

A listing in this catalog is metadata, not a security review. The same plugins also have evidence records in [dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification) and MCP access via [dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp).

---

## 中文说明

PerryLink 全家桶的 [DSH Community Market](https://github.com/anywhere-labs/dsh-desktop/tree/main/dsh-community-market) 标准目录源：33 个 npm 包，由 npm registry 生成，按公开 v1 契约做结构校验。部署到 Deno Deploy 免费额度后，在 DSH Desktop 的 市场 → Sources 里添加 manifest URL 即可浏览（浏览只读；安装仍走市场自身的 npm 身份校验与用户确认）。生成产物中的占位域名 `replace-with-deploy-origin.invalid` 在部署时替换，请勿直接注册占位地址。

## License

Apache-2.0. Catalog data derives from the npm registry and the PerryLink plugin repositories.
