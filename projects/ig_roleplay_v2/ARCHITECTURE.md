# IG Roleplay V2 Architecture / 架构说明

## Scope / 范围

This document describes the architecture implemented in code today.  
本文档描述当前代码里已经落地的架构。

Focus / 重点:

1. upstream authoring surfaces  
   上游手动编写入口
2. zero-memory pipeline stages  
   零记忆主流水线阶段
3. intermediate vs final runtime layout  
   intermediate 与 final 的运行时目录分层
4. outfit chain vs render-style chain  
   穿搭链与画风链的边界

## Implemented Pipeline / 已实现流水线

```text
editable persona + clothing policy + world facts + manual external events + style profile + scenario override
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
-> final_delivery.json
-> publish_result.json + run_summary.json
```

Core invariant / 核心不变量:

- caption and image must come from the same selected moment  
  图文必须来自同一个 selected moment
- style may change craft only  
  style 只改变画工
- outfit is resolved as content semantics before final prompt assembly  
  outfit 作为内容语义先被解析，再进入最终 prompt 组装

## Upstream Surfaces / 上游入口

### Persona Chain / 人设链

Files / 文件:

- `character/editable/core.identity.json`
- `character/editable/voice.style.json`
- `character/editable/visual.identity.json`
- `character/editable/posting.behavior.json`
- `character/editable/clothing.policy.json`

Compiled into / 编译为:

- `runtime/intermediate/current/character_profile.json`

Responsibilities / 职责:

- stable identity and voice  
  稳定身份与表达
- stable visible anchors  
  稳定可见身份锚点
- lane defaults  
  lane 默认行为
- capture policy  
  capture policy
- stable clothing taste and positive body/presence read  
  稳定穿搭审美与正向体态/气质读取

### World-State Chain / 世界状态链

Files / 文件:

- `config/world/world_facts.json`
- `config/world/manual_external_events.json`

Compiled into / 编译为:

- `runtime/intermediate/current/day_context.json`
- `runtime/intermediate/current/external_event_packet.json`
- `runtime/intermediate/current/reality_bounds.json`

Responsibilities / 职责:

- factual constraints  
  事实约束
- active outside-world changes  
  当前生效的外部世界变化
- availability and context pressure  
  可用性与环境压力

### Scenario Override Chain / 单次覆盖链

Source / 来源:

- `scenarios/zero_memory_eval/*.json`

Used for / 用途:

- `contentIntent.characterPresenceTarget`
- `contentIntent.captureIntent`
- `contentIntent.outfitIntent`

Compiled into / 编译为:

- `runtime/intermediate/current/content_intent.json`
- `runtime/intermediate/current/capture_intent.json`
- `runtime/intermediate/current/outfit_intent.json`

## Outfit Chain / 穿搭链

### Why It Exists / 为什么要单独拆出来

Outfit choice is not render style. It is scene/content semantics.  
穿搭选择不是画风；它属于场景/内容语义。

We therefore resolve outfit before image prompt assembly.  
因此穿搭会在最终 image prompt 组装前先被解析出来。

### Implemented Flow / 当前实现

```text
clothing.policy.json + scenario.contentIntent.outfitIntent + day_context + selected_moment
-> outfit_intent.json
-> outfit-resolver-agent
-> outfit_plan.json
-> moment_package.json.outfit
-> image_request.json prompt block: Outfit
```

`outfit_plan.json` contains:

- outfit summary  
  穿搭摘要
- garment/silhouette descriptors  
  服装与轮廓描述
- weather and scene fit notes  
  天气与场景适配说明
- positive prompt-ready outfit cues  
  正向、可直接进 prompt 的穿搭 cue
- body/presence anchors carried from source profile  
  从 source profile 继承的体态/气质锚点

Rule / 规则:

- manual operator `avoidEn` may exist in `outfit_intent.json`  
  运营侧可以在 `outfit_intent.json` 里写 `avoidEn`
- but final prompt receives only positive visible outfit cues  
  但最终 prompt 只接收正向、可见的穿搭 cue

## Render-Style Chain / 画风链

Source / 来源:

- `config/render/image_style_profile.json`

Compiled into / 编译为:

- `runtime/intermediate/current/image_style_profile.json`

Injected into / 注入到:

- `image_request.json.promptPackage.RenderStyleSummary`
- `image_request.json.promptPackage.RenderStyle`
- `image_request.json.promptPackage.RenderGuardrails`
- `image_request.json.promptPackage.negativePrompt` style-only negatives

Boundary / 边界:

- style may tune line, contrast, color, edge readability, depth  
  style 可以调线条、对比、色彩、边缘、景深
- style may not decide outfit, event, persona, or framing semantics  
  style 不能决定穿搭、事件、人设、取景语义

## Prompt Assembly / Prompt 组装

`src/agent/compat.js -> buildImageRequest(...)` assembles:

- `Subject`
  stable identity anchors + positive body/presence anchors
- `Moment`
  concrete evidence from the selected moment
- `Context`
  weather/context/world-state support
- `CharacterPresence`
  requested protagonist readability
- `CapturePlan`
  structured framing target
- `IdentityLock`
  positive recurring identity cues
- `Outfit`
  resolved positive outfit surface cues
- `RenderStyleSummary / RenderStyle / RenderGuardrails`
  style-only render controls

Important / 重要:

- stable body/persona cues are now carried positively from source profile  
  稳定体态/气质 cue 现在通过 source profile 的正向描述传递
- final prompt should not depend on dirty identity-preservation bans  
  最终 prompt 不应该再依赖脏的身份保真负面禁令

## Runtime Layout / 运行时目录

### Intermediate / 中间

Current run / 当前运行:

- `runtime/intermediate/current/*.json`

Archived runs / 归档运行:

- `runtime/intermediate/runs/<runId>/*.json`

Generated images / 生成图片:

- `runtime/intermediate/generated/current/*`
- `runtime/intermediate/generated/history/*`

History / 历史:

- `runtime/intermediate/history/publish_history.jsonl`

### Final / 最终

Current delivery / 当前交付:

- `runtime/final/current/final_delivery.json`
- `runtime/final/current/caption.txt`
- `runtime/final/current/<final-image>`

Historical deliveries / 历史交付:

- `runtime/final/history/<deliveryId>/`

Meaning / 含义:

- `intermediate` is for engineering inspection and review support  
  `intermediate` 用于工程排查和审核辅助
- `final` is the only product-facing delivery bundle  
  `final` 是唯一面向产品交付的最终包

## Post Package And Final Delivery / 中间发布包与最终交付

`post_package.json` stays intermediate.  
`post_package.json` 仍然是 intermediate 产物。

It summarizes:

- selected caption  
  已选文案
- generated image state  
  图片生成状态
- publish readiness  
  发布准备度
- review warnings  
  审核 warning

`final_delivery.json` is the publish-facing manifest.  
`final_delivery.json` 是面向交付与发布的清单。

It contains:

- final caption path  
  最终文案路径
- copied final image path  
  复制后的最终图片路径
- publish payload  
  发布 payload
- delivery readiness  
  最终交付准备度

Publish flow / 发布流:

```text
post_package.json + generated_image.json
-> build_final_delivery.js
-> runtime/final/current/final_delivery.json
-> publish_post_package.js reads only final_delivery.json
```

## Review Surfaces / 审核面

Final review / 最终审核:

- `runtime/final/current/final_delivery.json`
- `runtime/final/current/caption.txt`
- `runtime/final/current/<final-image>`

Intermediate debugging / 中间调试:

- `runtime/intermediate/current/outfit_intent.json`
- `runtime/intermediate/current/outfit_plan.json`
- `runtime/intermediate/current/moment_package.json`
- `runtime/intermediate/current/image_intent.json`
- `runtime/intermediate/current/image_request.json`
- `runtime/intermediate/current/run_summary.json`

## Boundary Rules / 边界规则

1. Persona changes belong in persona files.  
   人设改动只能写在 persona 文件。
2. Outfit taste belongs in `clothing.policy.json`; one-run outfit steering belongs in scenario `outfitIntent`.  
   穿搭审美写在 `clothing.policy.json`；单次穿搭引导写在 scenario 的 `outfitIntent`。
3. Style changes belong in `image_style_profile.json` only.  
   画风改动只能写在 `image_style_profile.json`。
4. Runtime artifacts are outputs, not source-of-truth documents.  
   runtime 产物是输出，不是真源文档。
5. Final publishing must read from `runtime/final/current/final_delivery.json`, not from mixed intermediate artifacts.  
   最终发布必须读取 `runtime/final/current/final_delivery.json`，不能再从混杂的 intermediate 产物直接发。
