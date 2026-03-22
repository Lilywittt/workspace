---
name: caption-candidates-writer
description: Use when the caption brief is ready and you need multiple distinct Chinese Instagram caption candidates that follow the brief while keeping fresh openings and social-post realism.
---

# Caption Candidates Writer

Use this skill after `caption_brief.json` exists. It produces publishable candidate captions, not just phrases or notes.

## Inputs
- `runtime/current/scene_plan.json`
- `runtime/current/caption_brief.json`
- Continuity guards that prevent repeated openings and hashtag clusters
- Hard limits for character count and hashtag count

## Output Shape
Return compact JSON only, with this shape:
- `candidates[]`
  - `id`
  - `angle`
  - `caption`
  - `hashtags`
  - `rationale`

`hashtags` must be plain tag words without the leading `#`, for example `["日常记录", "生活切片"]`.

## Workflow
1. Read the brief and scene plan together.
2. Write at least three distinct caption candidates with clearly different openings.
3. Keep each caption within the stated length and hashtag limits.
4. Make each option feel like a Chinese social post from the same character, not three copies with synonyms.
5. Let at least one candidate give an ordinary object, gesture, or sound a faint secret-sign or ritual feeling.

## Guardrails
- Captions must be in Chinese.
- Do not hide hashtags inside the sentence body.
- Do not prefix hashtag strings with `#` inside the JSON output.
- Do not repeat a recent opening line or obvious slogan pattern.
- Do not use commercial CTA, AI self-reference, or empty aesthetic wallpaper.
- Keep chunibyo flavor light, private, and socially believable; do not write prophecy monologues or fantasy lore.
- Do not close multiple candidates with the same encouragement slogan or recycled signature sentence.

## Success Criteria
- At least three candidates survive validation without fallback.
- The user can feel a real choice of angle, not just wording tweaks.
- At least one strong option should carry a soft "ordinary thing with secret meaning" texture.
