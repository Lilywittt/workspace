# IG Roleplay V2 Architecture / 架构说明

## Scope / 范围

This document describes the architecture implemented in code today.
本文档描述当前已经落地到代码中的架构。

Focus:
重点：

1. active product entrypoint
   当前产品入口
2. zero-memory pipeline stages
   zero-memory 流水线阶段
3. intermediate vs final runtime layout
   intermediate 与 final 的运行时分层
4. outfit chain vs render-style chain
   穿搭链与 render-style 链的边界
5. legacy pipeline isolation
   遗留链的隔离方式

## Active Product Entry / 当前产品入口

The active product entrypoint is:
当前产品入口是：

- `run_product.ps1`

Workspace wrapper:
工作区根目录包装入口：

- none inside the repo; keep `run_product.ps1` as the single supported entry
  仓库内不再保留第二入口；唯一受支持入口就是 `run_product.ps1`

This entrypoint orchestrates:
这个入口会串起以下步骤：

1. `pipeline/run_zero_memory_agent.js`
2. `tools/run_image_generation.ps1`
3. `scripts/build_post_package.js`
4. `scripts/build_final_delivery.js`
5. `scripts/publish_post_package.js`
6. `pipeline/build_zero_memory_run_summary.js`

Before each run it first normalizes the runtime layout, prunes history older than one day, then clears only:
每次运行前它会先归一化 runtime 布局，裁掉一天前的历史产物，然后只清空：

- `runtime/intermediate/current/`
- `runtime/final/current/`

That keeps stale legacy artifacts out of the active review surfaces, removes runtime root directories that no longer belong to the active architecture, and folds stage-prefixed helper run folders back into the matching `runId` directory.
这样既可以避免旧链残留混进当前验收面板，也会移除那些已经不属于当前架构的 runtime 根目录，并把 stage 前缀 helper run 目录并回对应的 `runId` 目录。

## Implemented Pipeline / 已实现流水线

```text
editable persona + 穿搭规则 + world facts + manual external events + style profile
-> character_profile.json + image_style_profile.json
-> day_context.json + external_event_packet.json + ambient packets + reality_bounds.json
-> character_runtime_snapshot.json
-> content_intent.json + capture_intent.json
-> proto_moment_candidates.json + grounded_moment_review.json
-> selected_moment.json
-> outfit_intent.json + outfit_plan.json
-> moment_package.json
-> caption_intent.json + caption_candidates.json + caption_selection_review.json + selected_caption.json
-> image_intent.json
-> scene_plan.json + image_request.json
-> generated_image.json
-> post_package.json
-> final_delivery.json + review_guide.txt
-> publish_result.json + run_summary.json
```

Core invariants:
核心不变项：

- caption and image must come from the same selected moment
  图文必须来自同一个 selected moment
- style may change craft only
  style 只能调画工，不改内容语义
- outfit is resolved as content semantics before final prompt assembly
  outfit 必须先作为内容语义被解析，再进入最终 prompt 组装
- caption variants in the zero-memory chain differ by concrete focus and opening move, not by required enum labels
  zero-memory 链中的 caption 变体应通过具体侧重与开场方式区分，而不是强制写成枚举标签

## Upstream Surfaces / 上游入口

Persona files / 人设文件：

- `character/editable/角色基础.json`
- `character/editable/表达风格.json`
- `character/editable/视觉形象.json`
- `character/editable/发布策略.json`
- `character/editable/穿搭规则.json`

World files / 世界文件：

- `config/world/world_facts.json`
- `config/world/manual_external_events.json`

Render-style file / 画风文件：

- `config/render/image_style_profile.json`

Evaluation fixtures / 评测夹具：

- `eval/fixtures/zero_memory/*.json`

These fixtures are eval-only and do not belong to `run_product.ps1`.
这些夹具只用于评测，不属于 `run_product.ps1` 的产品入口链路。

## Outfit Chain / 穿搭链

Outfit choice is content semantics, not render style.
穿搭选择属于内容语义，不属于 render style。

Implemented flow / 当前实现：

```text
穿搭规则.json + eval-only outfitIntent override + day_context + selected_moment
-> outfit_intent.json
-> outfit-resolver-agent
-> outfit_plan.json
-> moment_package.json.outfit
-> image_request.json prompt block: Outfit
```

Rules / 规则：

- operator-side `avoidEn` may exist in `outfit_intent.json`
  运营侧可以在 `outfit_intent.json` 写 `avoidEn`
- final image prompts receive only positive visible outfit cues
  最终图片 prompt 只接收正向、可见的穿搭 cue
- clothing policy carries wardrobe facts only; body and presence belong to visual/presence layers
  穿搭规则只负责衣服事实；体态与出场感属于视觉层和出场策略层

## Outfit Responsibility Split / 穿搭权责拆分

Outfit resolution is also split into fixed layers.
穿搭链也拆成固定层级，各层不要越权。

1. `character/editable/穿搭规则.json`
   Owns stable wardrobe taste and lane-specific clothing tendencies only.
   只负责稳定的穿衣品味和按发布路径区分的穿搭倾向。
2. `src/agent/outfit_intent.js`
   Owns runtime conditions and operator override only.
   只负责本轮运行条件和手动 override，不重复定义 stable taste。
3. `pipeline/prompts/outfit-resolver-agent.md`
   Owns the instance-level decision: what she plausibly wears in this specific moment today.
   只负责“今天这个具体 moment 里合理穿什么”。
4. `src/agent/validators.js -> normalizeOutfitPlan(...)`
   Owns schema cleanup and positive-cue sanitation only.
   只负责 schema 清洗和正向 cue 去脏，不再偷偷做第二轮穿搭创作。
5. `src/agent/compat.js`
   Owns final serialization of positive outfit cues into the image request.
   只负责把正向穿搭 cue 串进最终图片请求。

## Render-Style Chain / 画风链

Source / 来源：

- `config/render/image_style_profile.json`

Injected into / 注入位置：

- `RenderStyleSummary`
- `RenderStyle`
- `RenderGuardrails`
- style-only negatives

Boundary / 边界：

- style may tune line, contrast, color richness, edge readability, and depth
  style 可以调线条、对比、色彩丰富度、边缘可读性和景深层次
- style may not decide outfit, event, persona, or framing semantics
  style 不能决定穿搭、事件、人设或取景语义

System-level prompt constraints / 系统级 prompt 约束：

- `config/policies/agent_generation_policy.json -> image.systemConstraintsEn`

These constraints belong to product/runtime policy, not to render style.
这些约束属于产品与运行时 policy，不属于 render style。

## Image Responsibility Split / 图像权责拆分

Image generation is split into five layers with different jobs.
图像生成链现在拆成五层，每层只做自己的事。

1. `config/render/image_style_profile.json`
   Owns render craft only: line quality, contrast, color richness, edge readability, and depth.
   只负责画工与渲染表现：线条、对比、色彩、边缘和景深。
2. `src/agent/capture_intent.js`
   Owns the viewing envelope: camera relation, face readability, body coverage, distance, and environment weight.
   只负责“这个 moment 可以怎样被看见”。
3. `pipeline/prompts/image-intent-agent.md`
   Owns same-moment visual evidence: `mustShow`, `mayShow`, `mustAvoid`, `framing`, `atmosphere`, and `altText`.
   只负责“同一个 moment 里要看见什么、不要怎样拍死它”。
4. `config/policies/agent_generation_policy.json -> image.systemConstraintsEn`
   Owns product/runtime prompt constraints only.
   只负责产品级、运行时级的系统约束。
5. `src/agent/compat.js`
   Assembles the final request only; it should not invent new style taste or semantic failure modes.
   只负责最终组装，不再额外发明新的风格口味或语义失败模式。

## Image Execution Layer / 生图执行层

The host-side image execution is now split again into stable execution layers:
宿主机生图执行层现在也做了稳定拆分：

1. `config/provider_catalog.json`
   Owns provider capabilities, endpoints, auth env names, default models, and workflow profile pointers.
   负责 provider 能力、endpoint、认证环境变量、默认模型和 workflow profile 指针。
2. `scripts/lib/image_generation.js`
   Owns shared runtime loading, request-body shaping, artifact writing, and generated asset layout.
   负责通用 runtime 读取、请求体组装、artifact 写入和生成资产目录约定。
3. `scripts/lib/comfyui_workflow.js` + `scripts/lib/comfyui_client.js`
   Own local workflow translation, local prompt adaptation, workflow submission, history polling, and local file download.
   负责本地 workflow 翻译、本地 prompt 适配、workflow 提交、history 轮询和本地文件下载。
4. `scripts/run_image_generation.js`
   Owns the single Node execution entry for both hosted providers and local workflow providers.
   负责 hosted provider 与本地 workflow provider 的统一 Node 执行入口。
5. `tools/run_image_generation.ps1`
   Owns the Windows host shell wrapper and `.env` import only.
   只负责 Windows 宿主机壳层和 `.env` 导入。

The legacy `tools/host_generate_openai_image.ps1` is kept only as a compatibility wrapper.
遗留的 `tools/host_generate_openai_image.ps1` 现在只保留为兼容壳。

## Prompt Assembly / Prompt 组装

`src/agent/compat.js -> buildImageRequest(...)` assembles:
`src/agent/compat.js -> buildImageRequest(...)` 会组装：

- `Subject`
- `Moment`
- `Context`
- `CharacterPresence`
- `CapturePlan`
- `IdentityLock`
- `Outfit`
- `RenderStyleSummary`
- `RenderStyle`
- `RenderGuardrails`

Important / 重要：

- stable body and persona cues are carried positively from upstream profile
  稳定的体态和人设 cue 来自上游 profile 的正向表达
- the final prompt should not depend on dirty identity-preservation bans
  最终 prompt 不应依赖脏的“身份保真”负面禁令
- `compat.js` should assemble style, semantic evidence, and system constraints from their own upstream sources instead of re-declaring them
  `compat.js` 应该从各自上游读取 style、语义证据和系统约束，而不是自己重写一遍

## Runtime Layout / 运行时目录

Active top-level runtime directories / 当前有效的 runtime 顶层目录：

- `runtime/intermediate/`
- `runtime/final/`

Intermediate runtime / 中间运行层：

- `runtime/intermediate/current/*.json`
- `runtime/intermediate/runs/<runId>/*.json`
- `runtime/intermediate/runs/<runId>/generated_assets/*`
- `runtime/intermediate/history/publish_history.jsonl`

Archived stage outputs for a run now collapse into that same `runtime/intermediate/runs/<runId>/` directory, rather than creating separate stage-prefixed history folders.
同一次 run 的归档阶段产物现在会并入对应的 `runtime/intermediate/runs/<runId>/` 目录，而不是再额外创建 stage 前缀历史目录。

Final runtime / 最终交付层：

- `runtime/final/current/review_guide.txt`
- `runtime/final/current/final_delivery.json`
- `runtime/final/current/caption.txt`
- `runtime/final/current/<final-image>`
- `runtime/final/history/<deliveryId>/`

Meaning / 含义：

- `runtime/intermediate/*` is engineering inspection only
  `runtime/intermediate/*` 只用于工程排查
- `runtime/final/*` is the only product-facing delivery bundle
  `runtime/final/*` 是唯一面向产品验收的交付包

## Post Package And Final Delivery / 中间发布包与最终交付

`post_package.json` remains intermediate.
`post_package.json` 仍然属于 intermediate。

It summarizes / 它负责汇总：

- selected caption
  已选文案
- generated image state
  当前图片生成状态
- publish readiness
  发布准备度

`final_delivery.json` is the publish-facing manifest.
`final_delivery.json` 是面向交付与发布的最终清单。

It contains / 它包含：

- final caption path
  最终文案路径
- copied final image path
  复制后的最终图片路径
- publish payload
  发布 payload
- delivery readiness
  最终交付准备度
- selected moment + outfit + image-direction review signals
  selected moment、穿搭结果和图片方向验收信号
- review bundle metadata
  验收包元数据

`review_guide.txt` is generated beside it and is the first acceptance surface to open.
`review_guide.txt` 会在同目录下自动生成，并且应作为验收时第一个打开的文件。

## Acceptance Surfaces / 验收面

Final review / 最终验收：

1. `runtime/final/current/review_guide.txt`
2. `runtime/final/current/final_delivery.json`
3. `runtime/final/current/caption.txt`
4. `runtime/final/current/<final-image>`

Intermediate debugging / 中间调试：

- `runtime/intermediate/current/outfit_intent.json`
- `runtime/intermediate/current/outfit_plan.json`
- `runtime/intermediate/current/moment_package.json`
- `runtime/intermediate/current/image_intent.json`
- `runtime/intermediate/current/image_request.json`
- `runtime/intermediate/current/run_summary.json`

## Legacy Isolation / 遗留链隔离

Legacy world-state, scene-program, and caption-angle scripts still exist in the repository for audit and backward analysis, but they are not on the active product path.
旧的 world-state、scene-program、caption-angle 脚本仍然保留在仓库里，供审计和回溯分析使用，但已经不在当前产品热路径上。

Examples of legacy-only artifacts / 遗留链特有产物示例：

- `world_state_snapshot.json`
- `caption_candidates_ai.json`
- old `angle` / `candidateAngle` semantics in the legacy scene pipeline

Current product runs should not produce those files inside `runtime/intermediate/current/`.
当前产品运行不应再在 `runtime/intermediate/current/` 中生成这些遗留产物。

## Boundary Rules / 边界规则

1. Persona changes belong in persona files.
   人设修改只能落在 persona 文件。
2. Outfit taste belongs in `character/editable/穿搭规则.json`; eval fixtures may carry temporary `outfitIntent`, but that path is not part of the product runner.
   穿搭审美属于 `character/editable/穿搭规则.json`；评测夹具可以带临时 `outfitIntent`，但这条路径不属于产品运行入口。
3. Style changes belong in `image_style_profile.json` only.
   画风修改只属于 `image_style_profile.json`。
4. System prompt constraints belong in `agent_generation_policy.json -> image.systemConstraintsEn`, not in `image-intent` or `compat`.
   系统级 prompt 约束属于 `agent_generation_policy.json -> image.systemConstraintsEn`，不属于 `image-intent` 或 `compat`。
5. Runtime artifacts are outputs, not source-of-truth documents.
   runtime 产物是输出，不是真源文档。
6. Final publishing must read from `runtime/final/current/final_delivery.json`, not from mixed intermediate artifacts.
   最终发布必须读取 `runtime/final/current/final_delivery.json`，不能再从混杂的 intermediate 产物直接发。
