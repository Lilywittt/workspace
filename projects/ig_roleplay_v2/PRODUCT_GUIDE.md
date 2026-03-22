# Product Guide / 产品手册

## Most Important / 最重要的事

1. The final review unit is always `caption + image + shared moment`.  
   最终审核单位始终是 `文案 + 图片 + 同源 moment`。
2. Upstream files are edited by hand; runtime artifacts are outputs, not editable truth.  
   上游文件必须手改；runtime 产物只是输出，不是真源。
3. Style is style-only. Outfit semantics belong to the content chain, not the render-style chain.  
   画风只管画风；穿搭语义属于内容链，不属于 render-style 链。
4. Stronger character readability must come from upstream profile and intent, not prompt-bandage prohibitions.  
   更强的角色识别必须来自上游 profile 和 intent，不能靠提示词补丁式禁令。

## What One Run Produces / 一次运行会产出什么

Final deliverable / 最终交付物:

- one caption text  
  一条最终文案
- one corresponding image  
  一张对应图片
- one final manifest for publish/review  
  一个用于审核/发布的最终清单

Intermediate artifacts / 中间产物:

- character, day, world, moment, caption, image, publish pipeline artifacts  
  角色、当天、世界、moment、文案、图片、发布链路的中间产物
- these exist for inspection and debugging only  
  它们只用于排查和链路检查

## Current Directory Contract / 当前目录契约

Final / 最终:

- `runtime/final/current/final_delivery.json`
- `runtime/final/current/caption.txt`
- `runtime/final/current/<final-image>`
- `runtime/final/history/<deliveryId>/`

Intermediate / 中间:

- `runtime/intermediate/current/*.json`
- `runtime/intermediate/runs/<runId>/*.json`
- `runtime/intermediate/generated/current/*`
- `runtime/intermediate/generated/history/*`
- `runtime/intermediate/history/publish_history.jsonl`

Meaning / 含义:

- `runtime/final/*` is the only delivery-facing area.  
  `runtime/final/*` 才是面向交付的区域。
- `runtime/intermediate/*` is for engineering and review support.  
  `runtime/intermediate/*` 只用于工程和审核辅助。

## Manual Authoring Surfaces / 手动编写入口

### Persona / 人设

- `character/editable/core.identity.json`
- `character/editable/voice.style.json`
- `character/editable/visual.identity.json`
- `character/editable/posting.behavior.json`
- `character/editable/clothing.policy.json`

Use persona files for / 适合写在这里:

- stable identity and age impression  
  稳定身份与年龄感
- voice, rhythm, disclosure habits  
  语气、节奏、表达习惯
- stable visible anchors  
  稳定可见身份锚点
- lane defaults and capture policy  
  lane 默认值与 capture policy
- stable clothing taste and body/presence read  
  稳定穿搭审美、体态感、角色气质感

Do not use persona files for / 不适合写在这里:

- temporary daily events  
  某天临时事件
- one-off weather outfits  
  某次天气下的临时穿搭决定
- provider-specific render tuning  
  某个 provider 的专属画风调参

### World Facts / 世界事实

- `config/world/world_facts.json`
- `config/world/manual_external_events.json`

Use these for / 适合写在这里:

- stable routines, places, objects, factual boundaries  
  稳定作息、地点、物件、事实边界
- active world-state changes that should be true today  
  今天真实生效的外部世界状态变化

Do not use these for / 不适合写在这里:

- recommended captions  
  推荐文案
- forced topics  
  强制话题
- forced framing instructions  
  强制镜头说明

### Render Style / 画风

- `config/render/image_style_profile.json`

Use it for / 适合写在这里:

- line, contrast, color richness, color separation, edge readability, depth separation  
  线条、对比、色彩丰富度、色彩分离、边缘可读性、景深分层

Do not use it for / 不适合写在这里:

- outfit meaning  
  穿搭语义
- moment semantics  
  moment 语义
- persona rewrite  
  重写人设
- composition intent rewrite  
  重写取景意图

## Outfit Architecture / 穿搭架构

### Stable Clothing Policy / 稳定穿搭策略

`character/editable/clothing.policy.json` defines:

- body read anchors  
  稳定体态感锚点
- presence read anchors  
  稳定气质感锚点
- everyday mood  
  日常氛围
- silhouette / fabric / palette / accessory / footwear tendencies  
  轮廓、面料、配色、配件、鞋履倾向
- lane-specific clothing bias  
  不同 lane 的穿搭偏向

This file should stay abstract and reusable.  
这个文件应该保持抽象、可复用，不要写成衣柜清单。

### One-Run Outfit Override / 单次穿搭覆盖

Put it in scenario JSON.  
放在 scenario JSON 里。

Example / 示例:

```json
{
  "contentIntent": {
    "outfitIntent": {
      "directionEn": "slightly tidier rainy after-class layering",
      "mustIncludeEn": ["light cardigan layer"],
      "preferEn": ["soft cool-neutral palette"],
      "avoidEn": ["overly dressy evening styling"]
    }
  }
}
```

Meaning / 含义:

- `directionEn` gives the run-level outfit direction  
  `directionEn` 给这次运行的总体穿搭方向
- `mustIncludeEn` lists one or two must-have visible cues  
  `mustIncludeEn` 写 1 到 2 个必须出现的可见 cue
- `preferEn` lists soft preferences  
  `preferEn` 写轻偏好
- `avoidEn` is allowed here as operator intent, but it does not flow directly into final image prompt negatives  
  `avoidEn` 可以写在这里作为运营意图，但不会直接流进最终生图负面提示词

### What The Pipeline Does / 流水线会怎么做

1. Build `outfit_intent.json` from stable policy + scenario override.  
   先用稳定策略和场景覆盖生成 `outfit_intent.json`。
2. Resolve `outfit_plan.json` from character, weather, world, and selected moment.  
   再结合角色、天气、世界、selected moment 解析出 `outfit_plan.json`。
3. Inject only positive visible outfit cues into `image_request.json`.  
   最后只把正向、可见的穿搭 cue 注入 `image_request.json`。

## Review Method / 审核方法

### Final Review / 最终审核

Review in this order / 按这个顺序看:

1. `runtime/final/current/final_delivery.json`
2. `runtime/final/current/caption.txt`
3. `runtime/final/current/<final-image>`

Check for / 检查重点:

- caption and image come from the same moment  
  图文是否来自同一个 moment
- outfit feels right for the weather, context, and character  
  穿搭是否符合天气、场景、角色
- protagonist readability matches upstream intent  
  主角识别度是否符合上游 intent
- style changed craft only  
  画风是否只改变画工

### Intermediate Review / 中间排查

Use when needed / 有需要时再看:

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

## Publish Flow / 发布流程

1. Build `post_package.json` from intermediate artifacts.  
   先从 intermediate 产物生成 `post_package.json`。
2. Build `final_delivery.json` and copy the final caption/image into `runtime/final/current/`.  
   再生成 `final_delivery.json`，并把最终文案/图片复制到 `runtime/final/current/`。
3. Publish reads only `runtime/final/current/final_delivery.json`.  
   发布步骤只读取 `runtime/final/current/final_delivery.json`。

## Non-Negotiable Rules / 不可妥协规则

1. Do not hand-edit runtime outputs to fake a good run.  
   不要手改 runtime 产物来伪造成功结果。
2. Do not turn external events into hidden topic assignment.  
   不要把 external events 写成隐藏选题菜单。
3. Do not turn style config into content control.  
   不要把 style 配置写成内容控制器。
4. Do not turn clothing policy into a giant wardrobe catalog.  
   不要把 clothing policy 写成巨型衣柜目录。
5. Do not rely on dirty negative-prompt bans to preserve body/persona.  
   不要依赖脏的负面提示词禁令来保角色体态和气质。
