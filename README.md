# dsh-catalog

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-catalog)
[![npm version](https://img.shields.io/npm/v/dsh-catalog)](https://www.npmjs.com/package/dsh-catalog)
[![npm downloads](https://img.shields.io/npm/dm/dsh-catalog)](https://www.npmjs.com/package/dsh-catalog)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-catalog?metric=downloads)](https://dshfind.com/plugins/PerryLink/dsh-catalog?ref=badge)

A [DSH Community Market](https://github.com/anywhere-labs/dsh-desktop/tree/main/dsh-community-market) **standard catalog source** for the PerryLink DeepSeek Harness plugin family: 99 packages — 95 family repositories plus the third-party `dsh-phocinae`, catalogued alongside them rather than claimed as family work — generated from the npm registry, validated against the public v1 contract schemas. Every item carries a Chinese name and a one-line Chinese summary (`displayNameZh` / `summaryZh`) next to the English pair.

- Manifest: `catalog-source.json` (generated; see Deploy)
- Provider page: `artifacts/v1/plugins.json` (generated)
- Source of truth: `data/packages.json` (npm name → repo → display name → categories) + `data/npm-snapshot.json` (npm registry snapshot)
- Generator / validator: `scripts/build-catalog.mjs`, `scripts/validate.mjs`, `scripts/check-counts.mjs`
- Deploy: live at `https://perrylink-dsh-catalog.perrylink.workers.dev` (Cloudflare Workers, automated via `deploy.yml`; Vercel static alternative in `vercel.json`; Deno unit `deploy/deno-worker.js` as manual alternative)

![Terminal demo of dsh-catalog](docs/assets/dsh-catalog-hero.png)

![Animated terminal demo of dsh-catalog](docs/assets/dsh-catalog-demo.gif)

## Maintenance status: family-internal tool

> **Reclassified on 2026-10-05 — deliberately NOT retired.** A review of the whole
> plugin family against the official harness and the wider ecosystem classified this
> repository as **family-internal tooling** rather than a product. Its job is to
> inventory this family for the DSH Desktop Community Market, so it does not compete
> with third-party catalogs and needs no retirement. It stays maintained.

### One roster, three counts: 99 catalog packages, 95 family repos, 95 README rows

The catalog is the discoverability surface, not a 1:1 projection of the family
roster. It carries **99 npm records** in `data/packages.json` (including
community/third-party records and the three retired names kept for older
installs), while the family roster has **95 repositories** — **87 active,
5 frozen, 3 retired**. Every per-plugin README carries the same **95-row**
roster, collapsed.

| Scope | Count | Meaning |
|---|---|---|
| **This catalog's inventory** | **99** | npm packages in `data/packages.json`; generated from the registry and validated against the v1 contract |
| **The family roster** | **95** | the count of record in `dsh-plugin-kit/data/repos.json`: 87 active + 5 frozen + 3 retired |
| **The family rows in the per-plugin READMEs** | **95** | the same roster, rendered inside a collapsed `<details>` block |

Every non-active item also carries a structured `status` field (`frozen` or
`retired`), every family item carries its roster `group` (会话/安全/研究/
招投标/外贸/…), and 95 items carry `requires` (`dsh`/`node` ranges), emitted by
`build-catalog.mjs` and checked by `validate.mjs`. A client can filter lifecycle
state, task group, and host prerequisites without parsing prose.

The three **retired** packages (`dsh-background-agents`, `dsh-session-pin`,
`dsh-team-rooms`) **remain in the inventory on purpose**: retirement here means
*compatibility updates stopped because the official harness now implements the
capability*, not that the package was withdrawn. They are npm-deprecated and are
**not** in `dsh-kit`'s one-command install; the market keeps them browsable for
existing installs.

## Compliance notes

- Contract: [catalog-provider-contract.md](https://github.com/anywhere-labs/dsh-desktop/blob/main/dsh-community-market/docs/catalog-provider-contract.md) (v1, `manifestVersion`/`schemaVersion` `1.0.0`). The schemas are vendored nowhere in this repo; `scripts/validate.mjs` mirrors the structural rules of `catalog-source.schema.json` and `catalog-provider-page.schema.json` and the cross-field rules (unique item ids, npm name pattern, no install commands in items, HTTPS repository URLs, page shape).
- The minimal valid profile is used: `query.supported = []`, `defaultLimit = maxLimit = 50`, `sorts = []`. The endpoint returns the complete bounded page (99 items in one response), so DSH Desktop scans it in one request and runs search/filtering over its local index. ⚠️ `maxLimit = 50` caps a *slice* request, not this whole-page response — the shipped page is larger than `maxLimit` by design, and the two numbers are not supposed to agree.
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

PerryLink 全家桶的 [DSH Community Market](https://github.com/anywhere-labs/dsh-desktop/tree/main/dsh-community-market) 标准目录源：99 个 npm 包（95 个家族仓 + 第三方 `dsh-phocinae`，后者只是并列收录，不算家族作品），由 npm registry 生成，按公开 v1 契约做结构校验；每个条目都带中文名与一句话中文摘要（`displayNameZh` / `summaryZh`），与英文成对。已上线 Cloudflare Workers（`perrylink-dsh-catalog.perrylink.workers.dev`，deploy workflow 自动部署；Vercel 静态重写与 Deno Deploy 为备选通道）。每个条目还带同源 `media.icon` 图标（`/icons/*.png`，由 `scripts/build-icons.mjs` 确定性生成）。在 DSH Desktop 的 市场 → Sources 里添加 manifest URL 即可浏览（浏览只读；安装仍走市场自身的 npm 身份校验与用户确认）。生成产物中的占位域名 `replace-with-deploy-origin.invalid` 在部署时替换，请勿直接注册占位地址。**维护纪律**：`data/packages.json` 与 `data/npm-snapshot.json` 必须同一次 commit 成对更新（2026-09-09 连续两次 `main` 部署红灯即由此而来：先是漏逗号，后是新增包缺 npm 快照行）；执行一次 `git config core.hooksPath .githooks` 后，每次 push 都会跑只读门禁 `scripts/check-data.mjs`。切勿把不带参数的 `node scripts/build-catalog.mjs` 当作门禁——它会把已入库的 `deploy/` 产物改写成占位域名。**CI**：`.github/workflows/ci.yml` 在每次 push 到 `main` 与每个 PR 上跑 `scripts/check-data.mjs`、`scripts/check-counts.mjs` 与 build+validate；`scripts/validate.mjs` 默认直接读已入库的 `deploy/` 产物（真正上线的载荷，干净 clone 里只有它），并把 `page.total` 锁到 `items.length`；随后重建断言 `deploy/catalog-source.json` 未过期，可发现「改了 `data/` 却没重建 `deploy/`」；该重建在 CI 的一次性 checkout 里是安全的，因为 manifest 不含时间戳、可字节复现。**计数单一来源**：包数一律由 `data/packages.json` 派生——`scripts/check-counts.mjs` 校验 README（EN+ZH）/manifest/产物/部署冒烟下限一致，`--write` 可从该来源重写 README 计数，禁止手写。

## License

Apache-2.0. Catalog data derives from the npm registry and the PerryLink plugin repositories.

**DSH family line:** this repository belongs to the **PerryLink DeepSeek Harness plugin family**, whose current line is `dsh-v0.1.7-rc.2`.


## PerryLink DSH Plugin Family

This project is one of the **87 actively maintained** DeepSeek Harness plugins from [PerryLink](https://github.com/PerryLink). The family roster is **95** plugins in total — **5 frozen**, **3 retired** — and stays collapsed below so every README keeps a short first screen. Expand it to see every row, with the reason in the Status column.

<details>
<summary>Expand all 95 plugins</summary>

| Plugin | One-liner | Status |
|---|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** | 水产养殖投入品记录核对（按投入品用量、休药期与起捕间隔核对记录自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** | 档案归档完整性与保管期限核对（依据《档案法》及配套规定，仅提示差异，不作出定性结论） |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command |  |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | 🚫 RETIRED — see the repo README |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** | 投标文件符合性预检（按招标文件逐条核对响应情况，仅提示差异，不作出定性结论） |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** | 投标人资格条件核对（按资格条件与证明材料核对逐条响应，仅提示差异，不作出定性结论） |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | 🧊 FROZEN — see the repo README |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |  |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | 🧊 FROZEN — see the repo README |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** | 合同条款立场台账核对（按立场、风险等级与退让底线核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** | 报关单证一致性核对（按公开的报关单填制规范核对单证间字段一致性，仅提示差异，不作出定性结论） |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) |  |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | 🧊 FROZEN — see the repo README |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** | 滞箱费台账核对（按免箱期与费率核对超期天数与金额的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review |  |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | 🧊 FROZEN — see the repo README |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** | 应急演练脚本核对（按阶段、响应分级、指挥与资源要素核对脚本齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** | 环评导则适用性核对（按要素、导则名称与执行标准核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** | 应急预案要素齐备性与条款级页码定位（依据 GB/T 29639-2020 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** | 作文量表评分核对（按评分项、原文定位与分值算术核对评分自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** | 证据清单齐备性核对（按待证事实与证据要素核对清单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** | 出口管制物项核对（按管制清单、最终用途与许可证核对台账齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** | FMEA 分析表要素齐备性与风险顺序数一致性核对（按公开的 FMEA 方法标准核对表内自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** | 预测准确率考核核对（按准确率、门槛与考核单价核对考核费用的算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** | 公文流转与办理时限核对（按公开的公文处理规范核对环节完整性与时限，仅提示差异，不作出定性结论） |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** | 公文格式要素核对（按公开的党政机关公文格式标准核对版头与主体要素，仅提示差异，不作出定性结论） |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** | 劳动保护与安全防护用品配置表核对（按公开的配备标准核对品名规格与配置数量，仅提示差异，不作出定性结论） |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** | 危险化学品临界量与重大危险源辨识核对（按储存量与临界量核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** | HAZOP 分析表要素齐备性与偏差推导一致性核对（依据公开的危险与可操作性分析标准，仅提示差异，不作出定性结论） |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** | 安全隐患台账→《工贸企业重大事故隐患判定标准》（应急管理部令第10号）条款映射提示（仅提示差异，不作出定性结论） |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** | 商品归类层级一致性核对（按章、品目、子目与商品编号的层级关系核对自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** | ICD 合并编码与星剑号配对提示（依据 GB/T 14396-2016 与公开的 ICD 使用说明，仅提示差异，不作出定性结论） |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** | 法条引用与文书要素核对（按名称、条号、原文与效力状态核对引用可核验性，仅提示差异，不作出定性结论） |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** | 信用证单据条款核对（按单据种类、份数、期限与不符点核对交单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** | 能力差距与培养计划核对（按能力等级差、培养措施与完成期限核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** | 病案首页形式质控与逻辑矛盾提示（依据国卫办医发〔2016〕24号等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool |  |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** | 国家自然科学基金申请书形式审查与匿名化提示（依据《国家自然科学基金条例》与申请人导入的当年指南，仅提示差异，不作出定性结论） |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** | 护理记录时限、签名与评估表完整性校验（依据《病历书写基本规范》等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** | 原产地区域价值成分核对（按 RVC 定义式与门槛核对原产地判定自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** | 在线点评回复台账核对（按回复时限、问题分类与整改状态核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** | 试卷解析结构核对（按题型、答案、分值与 yotta 标识核对试卷结构自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** | 行政许可办理核对（按申请材料、法定时限与决定记录核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** | 项目全流程文件链条核对（按环节先后与金额口径核对链条自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** | 起诉状要素齐备性核对（按诉请、事实、证据、法条四要素核对文书齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins |  |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins |  |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card |  |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** | 政策专报要素核对（按观点、依据、出处与建议核对专报齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** | 线损电量拆分与考核表核对（依据公开的线损计算口径，仅提示差异，不作出定性结论） |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** | 电力工作票要素齐备性与签发许可顺序核对（依据现行电力安全工作规程，仅提示差异，不作出定性结论） |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** | PPAP 提交要素齐备性核对（按公开的 PPAP 手册与提交等级核对要素齐备与版本填写，仅提示差异，不作出定性结论） |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** | 质疑与投诉期限核对（按公开的政府采购质疑投诉规定核对期限与台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** | 铁路施工天窗台账核对（按时间窗、时长算术与命令号核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | 🧊 FROZEN — see the repo README |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** | 维修工单结算核对（按项目金额、配件工时合计与结算总额核对算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** | 审稿意见逐条回应覆盖核对（按意见与回应一一对应核对覆盖完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** | 规则库文件自检核对（按条款引用纪律与效力上限核对规则库自身合规，仅提示差异，不作出定性结论） |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** | 安全技术交底记录要素齐备性与签字闭环核对（依据公开的安全生产法规与检查标准，仅提示差异，不作出定性结论） |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. |  |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | 🚫 RETIRED — see the repo README |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** | 监理日志跨日连续性与旁站覆盖提示（依据 GB/T 50319-2013 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** | 三重一大决策台账核对（按前置研究、会议审议与决议记录核对程序留痕，仅提示差异，不作出定性结论） |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** | 土壤与地下水监测台账核对（按点位、监测项目、限值与超标判定核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** | 作业规程与 FMEA／控制计划一致性核对（按编号与版本核对三份文件是否同步，仅提示差异，不作出定性结论） |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** | 控制图常数与过程能力指数核对（按 GB/T 4091 的常规控制图常数表核对控制限与 Cp/Cpk 的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |  |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | 🚫 RETIRED — see the repo README |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** | 招标文件条款摘录核对（按出处与原文逐字核对摘录完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** | 评标因素评分矩阵核对（按分值上限与合计核对矩阵自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** | 质保期与索赔金额核对（按质保期月数与里程、索赔金额算式核对自洽，仅提示差异，不作出定性结论） |  |

</details>

</details>

</details>