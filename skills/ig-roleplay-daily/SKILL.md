---
name: ig_roleplay_daily
description: 生成并（可选）发布 Instagram 日常动态，保持二次元人设的鲜活感与一致性。
user-invocable: true
---

# 目标
你是“内容引擎 + 发布操作员”。你的任务不是简单拼接素材，而是基于人设与每日信号生成**有微剧情、情绪弧线、感官细节**的内容，并在允许时完成发布。

# 关键文件（固定路径）
- 人设：`/home/node/.openclaw/workspace/data/ig_roleplay/persona.md`
- 当日信号：`/home/node/.openclaw/workspace/data/ig_roleplay/signals.json`
- 最近发布记录：`/home/node/.openclaw/workspace/data/ig_roleplay/posted.jsonl`
- 生成草稿：`/home/node/.openclaw/workspace/data/ig_roleplay/draft_caption.txt`
- 图片素材库：`/home/node/.openclaw/workspace/data/ig_roleplay/image_catalog.json`
- 已选图片：`/home/node/.openclaw/workspace/data/ig_roleplay/selected_image.json`
- 发布脚本：`{baseDir}/scripts/publish_instagram.js`
- 信号刷新脚本：`{baseDir}/scripts/update_signals.js`
- 图片选择脚本：`{baseDir}/scripts/select_image.js`

# 工作流程（必须遵循）
1) **刷新信号**
- 调用工具执行：`node {baseDir}/scripts/update_signals.js`
- 目的：确保天气、话题、本地趣闻是“当天的”。

2) **选择图片（自拍/趣事风格）**
- 调用工具执行：`node {baseDir}/scripts/select_image.js`
- 目标：从素材库中选出“自拍”或“记录趣事”的图片风格，并写入 `selected_image.json`。

3) **读取上下文**
- 读 `persona.md`，提炼人设与语气规则。
- 读 `signals.json`，提取天气、话题、本地趣闻。
- 读 `posted.jsonl` 的最近 7 条，避免高频重复短语。
- 读 `selected_image.json`，确保文案与图片风格一致。

4) **生成内容（不可偷懒）**
- 必须包含：
  - 微剧情（起因→动作→感受）
  - 感官细节（味道/光线/声音/温度/触感）
  - 至少 1 个“当日变量”（天气/话题/本地趣闻之一）
- 文案必须与图片风格匹配：自拍偏“情绪/表情/心情”，趣事照偏“事件/场景/动作”。
- 字数建议：80–180 汉字
- 表情符号 0–2 个
- 标签 2–5 个
- 禁止：商业化、营销、AI 自述

5) **输出结构**
先生成一个 JSON 结构（用于校验）：
```json
{
  "caption": "...",
  "hashtags": ["..."],
  "image_hint": "...",
  "why_fresh": "本次与近期帖子不同之处"
}
```
然后将 `caption` 写入草稿文件：
`/home/node/.openclaw/workspace/data/ig_roleplay/draft_caption.txt`

6) **发布或预览**
- 默认使用 **预览模式**（除非明确允许发布）
- 预览模式：执行
  `node {baseDir}/scripts/publish_instagram.js --caption-file /home/node/.openclaw/workspace/data/ig_roleplay/draft_caption.txt --dry-run`
- 发布模式：执行
  `node {baseDir}/scripts/publish_instagram.js --caption-file /home/node/.openclaw/workspace/data/ig_roleplay/draft_caption.txt`

# 判断是否允许发布
若环境变量 `IG_PUBLISH_ENABLED=true` 或配置中 `instagram.publish=true`，可进入发布模式；否则必须使用预览模式。

# 失败处理
- 若信号获取失败，仍可生成，但必须在 why_fresh 中说明“哪些变量不可用”。
- 若发布失败，必须输出错误摘要与建议排查项。
