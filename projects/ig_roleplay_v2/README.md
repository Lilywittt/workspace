# IG Roleplay V2

Zero-memory living-character pipeline for producing one acceptance-ready Instagram caption and image pair per run.
零记忆常驻角色流水线；每次运行产出一组可验收、可发布的 Instagram 图文对。

## One Command Run / 单命令运行

Run the product with one script:
产品运行只用一个脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\run_product.ps1 -Mode simulate
```

Live publish:
真发布：

```powershell
powershell -ExecutionPolicy Bypass -File .\run_product.ps1 -Mode publish
```

What the run script does:
这个脚本会做的事情：

1. Normalize the runtime layout, prune runtime history older than one day, and clear only the current runtime surfaces.
   先归一化 runtime 布局，清掉一天前的历史产物，再只清空当前运行面板。
2. Run the zero-memory agent pipeline.
   运行 zero-memory 主链。
3. Generate the image on the host through `tools/run_image_generation.ps1`.
   通过 `tools/run_image_generation.ps1` 在宿主机上执行出图。
4. Build `post_package.json`.
   生成中间发布包 `post_package.json`。
5. Build `runtime/final/current/final_delivery.json`.
   生成最终交付清单 `final_delivery.json`。
6. Run dry-run or live publish.
   执行 dry-run 或真发布。
7. Build `runtime/intermediate/current/run_summary.json`.
   生成中间链路总结 `run_summary.json`。

## Local Image Route / 本地生图路线

Run the full product with the local ComfyUI provider:
使用本地 ComfyUI provider 跑完整产品：

```powershell
powershell -ExecutionPolicy Bypass -File .\run_product.ps1 -Mode simulate -Provider comfyui-local-anime
```

Local deployment and usage docs:
本地部署和使用文档：

- `docs/image_generation_architecture.md`
- `docs/comfyui_local_deployment.md`
- `docs/local_image_generation_user_manual.md`

## Review Here / 在这里验收

Treat this as the only product-facing acceptance directory:
把这里视为唯一的产品验收目录：

- `runtime/final/current/`

Open files in this order:
按这个顺序看：

1. `runtime/final/current/review_guide.txt`
2. `runtime/final/current/final_delivery.json`
3. `runtime/final/current/caption.txt`
4. `runtime/final/current/<final-image>`

`final_delivery.json` now also exposes the selected moment, outfit application, and image-direction summary needed for acceptance.
`final_delivery.json` 现在也会直接展示验收所需的 selected moment、穿搭应用结果和图片方向摘要。

Use `runtime/intermediate/current/` only for debugging and chain inspection.
`runtime/intermediate/current/` 只用于调试和链路排查。

If you still see legacy files such as `world_state_snapshot.json` or `caption_candidates_ai.json` inside `runtime/intermediate/current/` after a product run, a legacy script was used instead of `run_product.ps1`.
如果你在一次产品运行后还在 `runtime/intermediate/current/` 里看到 `world_state_snapshot.json`、`caption_candidates_ai.json` 这类旧产物，说明运行的不是当前产品入口，而是遗留脚本。

## Cache Cleanup / 缓存清理

Normalize the runtime layout first if you want to remove directories that no longer belong to the active pipeline:
如果你要清掉不属于当前链路的 legacy 目录，先运行 runtime 布局归一化：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\normalize_runtime_layout.ps1 -ListOnly
powershell -ExecutionPolicy Bypass -File .\tools\normalize_runtime_layout.ps1
```

That script keeps only the active runtime roots under `runtime/` and folds stage-prefixed helper run folders back into their canonical `runId` directory:
这个脚本会把 `runtime/` 下的顶层目录收口到当前架构需要的集合，并把 stage 前缀 helper run 目录并回规范的 `runId` 目录：

- `runtime/intermediate/`
- `runtime/final/`

It removes legacy root directories such as:
它会移除这些 legacy root 目录：

- `runtime/current/`
- `runtime/generated/`
- `runtime/history/`
- `runtime/runs/`
- `runtime/deliverables/`
- `runtime/evaluations/`

Preview cleanup:
先预览会清什么：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\clean_runtime_cache.ps1 -Target all-test-cache -ListOnly
```

Clear accumulated generated and run-history cache:
清理累积的生成物和运行历史缓存：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\clean_runtime_cache.ps1 -Target all-test-cache
```

Clear only the current inspection surfaces:
只清当前验收面板：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\clean_runtime_cache.ps1 -Target all-current
```

Prune history older than one day instead of wiping the whole directory:
如果只想删掉一天前的历史产物，而不是整目录清空：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\clean_runtime_cache.ps1 -Target all-history -OlderThanDays 1
```

Clear specific cache groups:
指定清理某些缓存组：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\clean_runtime_cache.ps1 -Target intermediate-runs,generated-history,publish-history
```

Supported cleanup targets:
支持的清理目标：

- `all-current`
- `all-test-cache`
- `all-history`
- `intermediate-current`
- `intermediate-runs`
- `generated-current`
- `generated-history`
- `publish-history`
- `final-current`
- `final-history`

## Editable Sources / 可编辑上游

Character and behavior:
角色与行为：

- `character/editable/角色基础.json`
- `character/editable/表达风格.json`
- `character/editable/视觉形象.json`
- `character/editable/发布策略.json`
- `character/editable/穿搭规则.json`

World and style:
世界事实与画风：

- `config/world/world_facts.json`
- `config/world/manual_external_events.json`
- `config/render/image_style_profile.json`

Eval fixtures:
评测夹具：

- `eval/fixtures/zero_memory/*.json`

These fixtures are for controlled evaluation only, not for the product entry path.
这些夹具只用于受控评测，不属于产品正式入口链路。

## Runtime Layout / 运行时目录

Only these top-level runtime directories should exist in the active architecture:
当前架构下，`runtime/` 顶层只应该存在这两个主目录：

- `runtime/intermediate/`
- `runtime/final/`

Engineering and debug artifacts:
工程与调试产物：

- `runtime/intermediate/current/`
- `runtime/intermediate/runs/<runId>/`
- `runtime/intermediate/runs/<runId>/generated_assets/`
- `runtime/intermediate/history/publish_history.jsonl`

Each `runtime/intermediate/runs/<runId>/` directory now keeps the archived stage artifacts for that same run, instead of splitting them into extra stage-prefixed history folders.
每个 `runtime/intermediate/runs/<runId>/` 目录现在都会收纳同一次运行的归档阶段产物，不再额外拆出一堆 stage 前缀历史目录。

Product-facing delivery bundle:
面向产品验收的最终交付包：

- `runtime/final/current/review_guide.txt`
- `runtime/final/current/final_delivery.json`
- `runtime/final/current/caption.txt`
- `runtime/final/current/<final-image>`
- `runtime/final/history/<deliveryId>/`

## Operating Rules / 操作规则

1. Edit upstream source files, not runtime outputs.
   只改上游源文件，不要手改 runtime 输出。
2. Review the result as `caption + image + shared moment`, not image alone.
   验收单位始终是 `文案 + 图片 + 同源 moment`，不是只看图。
3. `runtime/final/*` is the acceptance bundle; `runtime/intermediate/*` is support material.
   `runtime/final/*` 是验收包；`runtime/intermediate/*` 是辅助排查材料。
4. Outfit semantics come from the content chain, not the render-style chain.
   穿搭语义来自内容链，而不是 render-style 链。
5. Stronger protagonist readability must come from upstream profile and intent, not dirty negative-prompt bans.
   更强的主角可读性必须来自上游 profile 和 intent，不能靠脏的负面提示词硬压。
