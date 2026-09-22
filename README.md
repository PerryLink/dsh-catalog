# dsh-catalog

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-catalog)
[![npm version](https://img.shields.io/npm/v/dsh-catalog)](https://www.npmjs.com/package/dsh-catalog)
[![npm downloads](https://img.shields.io/npm/dm/dsh-catalog)](https://www.npmjs.com/package/dsh-catalog)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-catalog?metric=downloads)](https://dshfind.com/plugins/PerryLink/dsh-catalog?ref=badge)

A [DSH Community Market](https://github.com/anywhere-labs/dsh-desktop/tree/main/dsh-community-market) **standard catalog source** for the PerryLink DeepSeek Harness plugin family: 42 packages, generated from the npm registry, validated against the public v1 contract schemas.

- Manifest: `catalog-source.json` (generated; see Deploy)
- Provider page: `artifacts/v1/plugins.json` (generated)
- Source of truth: `data/packages.json` (npm name → repo → display name → categories) + `data/npm-snapshot.json` (npm registry snapshot)
- Generator / validator: `scripts/build-catalog.mjs`, `scripts/validate.mjs`, `scripts/check-counts.mjs`
- Deploy: live at `https://perrylink-dsh-catalog.perrylink.workers.dev` (Cloudflare Workers, automated via `deploy.yml`; Vercel static alternative in `vercel.json`; Deno unit `deploy/deno-worker.js` as manual alternative)

## Compliance notes

- Contract: [catalog-provider-contract.md](https://github.com/anywhere-labs/dsh-desktop/blob/main/dsh-community-market/docs/catalog-provider-contract.md) (v1, `manifestVersion`/`schemaVersion` `1.0.0`). The schemas are vendored nowhere in this repo; `scripts/validate.mjs` mirrors the structural rules of `catalog-source.schema.json` and `catalog-provider-page.schema.json` and the cross-field rules (unique item ids, npm name pattern, no install commands in items, HTTPS repository URLs, page shape).
- The minimal valid profile is used: `query.supported = []`, `defaultLimit = maxLimit = 50`, `sorts = []`. The endpoint returns the complete bounded page (42 items ≤ 50), so DSH Desktop scans it in one request and runs search/filtering over its local index.
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

The family count is **not** hand-maintained: `scripts/check-counts.mjs` derives it from
`data/packages.json` and holds every place that states it — the README summaries (EN + ZH), the
manifest description, the shipped page's `items`/`page.total` and the deploy live-smoke floor —
to that one source. Run it to verify, or `node scripts/check-counts.mjs --write` to rewrite the
README count sites from the source. It exists because the number did drift: the README and the
manifest advertised a family one package larger than the page actually shipped (the concrete
figures and the commit that fixed them are recorded in the `scripts/check-counts.mjs` header).

`.github/workflows/ci.yml` runs `scripts/check-data.mjs`, `scripts/check-counts.mjs` and the
build/validate pair on every push to `main` and on every pull request, so the hook above is a
convenience rather than the only line of defence. `scripts/validate.mjs` resolves the committed
`deploy/` mirrors first — the payload that actually ships, and the only copy a fresh clone has —
and holds `page.total` to `items.length`. CI then rebuilds to assert that the committed
`deploy/catalog-source.json` still matches, which catches a `data/` change that was never
mirrored into `deploy/`. That rebuild is the one place the no-argument form is safe: the
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

PerryLink 全家桶的 [DSH Community Market](https://github.com/anywhere-labs/dsh-desktop/tree/main/dsh-community-market) 标准目录源：42 个 npm 包，由 npm registry 生成，按公开 v1 契约做结构校验。已上线 Cloudflare Workers（`perrylink-dsh-catalog.perrylink.workers.dev`，deploy workflow 自动部署；Vercel 静态重写与 Deno Deploy 为备选通道）。每个条目还带同源 `media.icon` 图标（`/icons/*.png`，由 `scripts/build-icons.mjs` 确定性生成）。在 DSH Desktop 的 市场 → Sources 里添加 manifest URL 即可浏览（浏览只读；安装仍走市场自身的 npm 身份校验与用户确认）。生成产物中的占位域名 `replace-with-deploy-origin.invalid` 在部署时替换，请勿直接注册占位地址。**维护纪律**：`data/packages.json` 与 `data/npm-snapshot.json` 必须同一次 commit 成对更新（2026-09-09 连续两次 `main` 部署红灯即由此而来：先是漏逗号，后是新增包缺 npm 快照行）；执行一次 `git config core.hooksPath .githooks` 后，每次 push 都会跑只读门禁 `scripts/check-data.mjs`。切勿把不带参数的 `node scripts/build-catalog.mjs` 当作门禁——它会把已入库的 `deploy/` 产物改写成占位域名。**CI**：`.github/workflows/ci.yml` 在每次 push 到 `main` 与每个 PR 上跑 `scripts/check-data.mjs`、`scripts/check-counts.mjs` 与 build+validate；`scripts/validate.mjs` 默认直接读已入库的 `deploy/` 产物（真正上线的载荷，干净 clone 里只有它），并把 `page.total` 锁到 `items.length`；随后重建断言 `deploy/catalog-source.json` 未过期，可发现「改了 `data/` 却没重建 `deploy/`」；该重建在 CI 的一次性 checkout 里是安全的，因为 manifest 不含时间戳、可字节复现。**计数单一来源**：包数一律由 `data/packages.json` 派生——`scripts/check-counts.mjs` 校验 README（EN+ZH）/manifest/产物/部署冒烟下限一致，`--write` 可从该来源重写 README 计数，禁止手写。

## License

Apache-2.0. Catalog data derives from the npm registry and the PerryLink plugin repositories.

**DSH family line:** this repository belongs to the **PerryLink DeepSeek Harness plugin family**, whose current line is `dsh-v0.1.7-alpha.1`.


## PerryLink DSH Plugin Family

This project is one of the **45 DeepSeek Harness plugins** maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command | |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |
| **[dsh-catalog](https://github.com/PerryLink/dsh-catalog)** | DSH Desktop Market standard catalog source for the PerryLink family | |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence | |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore | |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) | |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. | |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds | |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval | |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` | |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools | |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. | |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. | |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers | |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer | |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors | |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool | |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. | |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching | |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit | |
| **[dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification)** | Community certification registry with repro-checkable grades and badges | |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins | |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill | |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins | |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card | |
| **[dsh-plugin-upgrade-015](https://github.com/PerryLink/dsh-plugin-upgrade-015)** | Merged `0.1.3-alpha.1` → `0.1.5-rc.1` upgrade corridor card plus a zero-dependency seam scanner | |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions | |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. | |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. | |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review | |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. | |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. | |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools | |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. | |
