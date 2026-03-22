# IG Roleplay V2

Zero-memory living-character pipeline for producing one reviewable Instagram-ready pair per run.  
零记忆常驻角色流水线；每次运行产出一组可审核、可发布的图文对。

## Read First / 先读

- `PRODUCT_GUIDE.md`
  Operator rules, manual authoring surfaces, review order.  
  运营规则、手动编写入口、审核顺序。
- `ARCHITECTURE.md`
  Implemented pipeline, runtime layout, artifact contracts.  
  当前实现架构、运行时目录、产物契约。

## Current Run Flow / 当前运行流程

```powershell
node .\pipeline\run_zero_memory_agent.js --scenario .\scenarios\zero_memory_eval\rainy_after_class.json
powershell -ExecutionPolicy Bypass -File .\tools\host_generate_openai_image.ps1
node .\scripts\build_post_package.js
node .\scripts\build_final_delivery.js
node .\scripts\publish_post_package.js --dry-run
node .\pipeline\build_zero_memory_run_summary.js
```

Live publish / 真发布:

```powershell
node .\scripts\publish_post_package.js --force-live
```

## Upstream Files / 上游文件

Persona and behavior / 人设与行为:

- `character/editable/core.identity.json`
- `character/editable/voice.style.json`
- `character/editable/visual.identity.json`
- `character/editable/posting.behavior.json`
- `character/editable/clothing.policy.json`

World and style / 世界与画风:

- `config/world/world_facts.json`
- `config/world/manual_external_events.json`
- `config/render/image_style_profile.json`

Scenario override / 单次场景覆盖:

- `scenarios/zero_memory_eval/*.json`

## Outfit Control / 穿搭控制

`clothing.policy.json` is the stable clothing-taste layer.  
`clothing.policy.json` 是稳定的穿搭审美层。

Use it for / 适合写在这里:

- body read and persona read expressed positively through silhouette and fit  
  通过版型、轮廓、贴身感正向表达稳定体态与角色气质
- everyday mood, palette tendency, fabric tendency, layering tendency  
  日常氛围、配色倾向、面料倾向、层次倾向
- age-appropriate freshness and maturity boundaries  
  年龄感、新鲜感、成熟度边界

Do not use it for / 不适合写在这里:

- one-off daily weather decisions  
  某一天临时天气判断
- giant wardrobe catalogs  
  巨型衣橱枚举表
- render-style tuning  
  画风调参

Manual one-run outfit override / 单次手动穿搭覆盖:

```json
{
  "contentIntent": {
    "characterPresenceTarget": "clear_character_presence",
    "outfitIntent": {
      "directionEn": "slightly tidier rainy after-class layering",
      "mustIncludeEn": ["light cardigan layer"],
      "preferEn": ["soft cool-neutral palette"],
      "avoidEn": ["overly dressy evening styling"]
    }
  }
}
```

The pipeline resolves `outfit_intent.json` first, then generates `outfit_plan.json`, then injects only positive surface outfit cues into `image_request.json`.  
流水线会先生成 `outfit_intent.json`，再解析为 `outfit_plan.json`，最后只把正向、表层、可见的穿搭 cue 注入 `image_request.json`。

## Runtime Layout / 运行时目录

Intermediate engineering artifacts / 中间工程产物:

- `runtime/intermediate/current/`
- `runtime/intermediate/runs/<runId>/`
- `runtime/intermediate/generated/current/`
- `runtime/intermediate/generated/history/`
- `runtime/intermediate/history/publish_history.jsonl`

Final product-facing deliverables / 最终产品交付物:

- `runtime/final/current/final_delivery.json`
- `runtime/final/current/caption.txt`
- `runtime/final/current/<final-image>`
- `runtime/final/history/<deliveryId>/`

Rule / 规则:

- Intermediate artifacts are for debugging, evaluation, and chain inspection.  
  intermediate 只用于调试、评估、链路检查。
- Final artifacts are the only delivery-facing bundle.  
  final 才是面向交付的最终包。

## Review Order / 审核顺序

1. `runtime/final/current/final_delivery.json`
   先看最终交付清单。
2. `runtime/final/current/caption.txt`
   再看最终 caption。
3. `runtime/final/current/<final-image>`
   再看最终对应图片。
4. `runtime/intermediate/current/run_summary.json`
   需要追链路时再看中间 summary。

## Operating Rules / 操作规则

1. Edit upstream files manually; never hand-edit runtime outputs as source of truth.  
   只改上游源文件，不要把 runtime 产物当真源手改。
2. Review the result as `caption + image + shared moment`, not image alone.  
   审核单位始终是 `文案 + 图片 + 同源 moment`。
3. `image_style_profile.json` is style-only; it must not decide outfit semantics, plot, or persona.  
   `image_style_profile.json` 只管画风，不决定穿搭语义、剧情或人设。
4. Stronger protagonist readability must come from upstream profile and intent, not dirty negative-prompt bans.  
   更强主角识别度必须来自上游 profile 和 intent，不能靠脏的负面提示词硬压。
5. When inspecting JSON in PowerShell, use UTF-8-aware reads such as `Get-Content -Encoding UTF8 -Raw`.  
   在 PowerShell 里查看 JSON 时请使用 UTF-8 读取，例如 `Get-Content -Encoding UTF8 -Raw`。
