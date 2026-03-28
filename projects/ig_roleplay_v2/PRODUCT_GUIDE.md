# Product Guide / 产品手册

## Core Rules / 核心规则

1. The final acceptance unit is always `caption + image + shared moment`.
   最终验收单位始终是 `文案 + 图片 + 同源 moment`。
2. Upstream files are edited by hand; runtime artifacts are outputs, not truth.
   上游文件手动维护；runtime 产物只是输出，不是真源。
3. Style is style-only. Outfit semantics belong to the content pipeline.
   画风只管画风；穿搭语义属于内容链。
4. Character readability must come from upstream profile and intent, not prompt-bandage prohibitions.
   角色识别度必须来自上游 profile 与 intent，而不是提示词补丁式禁令。

## Product Entry / 产品入口

Use one script for the full product run:
完整产品运行只用一个脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\run_product.ps1 -Mode simulate
```

Live publish:
真发布：

```powershell
powershell -ExecutionPolicy Bypass -File .\run_product.ps1 -Mode publish
```

The script automatically normalizes the runtime layout first, prunes history older than one day, then clears only the current runtime surfaces:
脚本会先自动归一化 runtime 布局，裁掉一天前的历史产物，再清空当前运行面板：

- `runtime/intermediate/current/`
- `runtime/final/current/`

That prevents stale legacy artifacts from mixing into the active review surfaces, removes old root runtime directories that no longer belong to the active architecture, and folds stage-prefixed helper run folders back into the matching `runId` directory.
这样既能避免旧链残留产物混进当前验收目录，也会移除那些已经不属于当前架构的 legacy root runtime 目录，并把 stage 前缀 helper run 目录并回对应的 `runId` 目录。

## Final Acceptance / 最终验收

Use only this directory for product acceptance:
产品验收只看这个目录：

- `runtime/final/current/`

Open files in this order:
按这个顺序查看：

1. `runtime/final/current/review_guide.txt`
2. `runtime/final/current/final_delivery.json`
3. `runtime/final/current/caption.txt`
4. `runtime/final/current/<final-image>`

`review_guide.txt` is the first file to open. It points to the exact review root, readiness, blockers, and debug paths.
`review_guide.txt` 是第一个应该打开的文件；它会明确写出验收根目录、发布准备度、阻塞项和调试路径。

`final_delivery.json` should now be enough to confirm caption/image readiness plus the applied selected moment, outfit summary, and image-direction signals.
`final_delivery.json` 现在应当足以同时确认图文准备度，以及本次应用的 selected moment、穿搭摘要和图片方向信号。

## Intermediate Inspection / 中间排查

Use these only when you need to debug the chain:
以下文件只在排查链路时使用：

- `runtime/intermediate/current/content_intent.json`
- `runtime/intermediate/current/capture_intent.json`
- `runtime/intermediate/current/outfit_intent.json`
- `runtime/intermediate/current/outfit_plan.json`
- `runtime/intermediate/current/selected_moment.json`
- `runtime/intermediate/current/moment_package.json`
- `runtime/intermediate/current/image_intent.json`
- `runtime/intermediate/current/image_request.json`
- `runtime/intermediate/current/post_package.json`
- `runtime/intermediate/current/run_summary.json`

If you need the archived chain for one specific run, open `runtime/intermediate/runs/<runId>/`; that directory now keeps the archived stage artifacts for the same run together.
如果你要回看某一次运行的归档链路，就直接打开 `runtime/intermediate/runs/<runId>/`；这个目录现在会把同一次 run 的阶段归档产物收在一起。

If you find legacy files like `world_state_snapshot.json` or `caption_candidates_ai.json` in `runtime/intermediate/current/` after a product run, the wrong entrypoint was used.
如果在一次产品运行后，`runtime/intermediate/current/` 里还出现 `world_state_snapshot.json`、`caption_candidates_ai.json` 这类遗留产物，说明跑的不是当前产品入口。

## Cache Cleanup / 缓存清理

Normalize the runtime layout when you want to remove legacy runtime directories end to end:
如果你要从头到尾清掉 legacy runtime 目录，先执行这个布局归一化脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\normalize_runtime_layout.ps1 -ListOnly
powershell -ExecutionPolicy Bypass -File .\tools\normalize_runtime_layout.ps1
```

After normalization, the active architecture should keep only these top-level runtime directories:
完成归一化后，当前架构在 `runtime/` 顶层只应保留：

- `runtime/intermediate/`
- `runtime/final/`

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

Clear only the current review surfaces:
只清当前验收面板：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\clean_runtime_cache.ps1 -Target all-current
```

Prune only history older than one day:
只裁掉一天前的历史产物：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\clean_runtime_cache.ps1 -Target all-history -OlderThanDays 1
```

Clear specific groups:
指定清理某些缓存组：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\clean_runtime_cache.ps1 -Target intermediate-runs,generated-history,publish-history
```

Supported targets:
支持的目标：

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

## Manual Authoring Surfaces / 手动编写入口

Persona:
人设：

- `character/editable/角色基础.json`
- `character/editable/表达风格.json`
- `character/editable/视觉形象.json`
- `character/editable/发布策略.json`
- `character/editable/穿搭规则.json`

World facts:
世界事实：

- `config/world/world_facts.json`
- `config/world/manual_external_events.json`

Render style:
画风配置：

- `config/render/image_style_profile.json`

## Publish Flow / 发布流程

1. `run_product.ps1` runs the zero-memory pipeline and host image generation through `tools/run_image_generation.ps1`.
   `run_product.ps1` 负责跑 zero-memory 主链，并通过 `tools/run_image_generation.ps1` 在宿主机出图。
2. `build_post_package.js` packages the current caption/image state in intermediate runtime.
   `build_post_package.js` 在 intermediate 里组织当前文案和图片状态。
3. `build_final_delivery.js` copies the final caption/image into `runtime/final/current/`, writes `review_guide.txt`, and surfaces product-facing creative signals in `final_delivery.json`.
   `build_final_delivery.js` 会把最终文案/图片复制进 `runtime/final/current/`，生成 `review_guide.txt`，并在 `final_delivery.json` 中透出面向产品验收的创意信号。
4. `publish_post_package.js` reads only `runtime/final/current/final_delivery.json`.
   `publish_post_package.js` 只读取 `runtime/final/current/final_delivery.json`。

## Non-Negotiable Boundaries / 不可妥协边界

1. Do not hand-edit runtime outputs to fake a good run.
   不要手改 runtime 产物来伪造成功结果。
2. Do not turn external events into hidden topic assignment.
   不要把 external events 写成隐藏选题器。
3. Do not turn style config into content control.
   不要把 style 配置写成内容控制器。
4. Do not turn `character/editable/穿搭规则.json` into a giant wardrobe catalog.
   不要把 `character/editable/穿搭规则.json` 写成巨型衣柜目录。
5. Do not rely on dirty negative-prompt bans to preserve body or persona.
   不要依赖脏的负面提示词禁令去维持角色体态或人设。

## Local ComfyUI Route / 本地 ComfyUI 路线

Use this when you want the product to generate a local anime image through ComfyUI:
当你要让产品通过 ComfyUI 生成本地 anime 图片时，用这条路：

```powershell
powershell -ExecutionPolicy Bypass -File .\run_product.ps1 -Mode simulate -Provider comfyui-local-anime
```

Supporting docs:

- `docs/image_generation_architecture.md`
- `docs/comfyui_local_deployment.md`
- `docs/local_image_generation_user_manual.md`
