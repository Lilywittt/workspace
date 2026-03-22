---
name: caption-brief-writer
description: Use when `scene_plan.json` is finalized and you need a concise creative brief that tells a caption writer how to write a Chinese Instagram post for this exact scene.
---

# Caption Brief Writer

Use this skill after the scene plan is locked and before caption candidates are generated. The job is to convert planning data into concrete writing guidance.

## Inputs
- `runtime/current/scene_plan.json`
- Identity traits that affect voice or emotional texture
- Platform context: Chinese Instagram roleplay caption

## Output Shape
Return compact JSON only, with these fields:
- `goal`
- `audienceFeeling`
- `openingMoves`
- `mustInclude`
- `mustAvoid`
- `voiceNotes`
- `hashtagAngles`
- `summary`

## Workflow
1. Read the scene plan first. Treat lane, narrative, and delivery limits as hard constraints.
2. Translate the scene into writer-facing guidance, not final prose.
3. Keep each list concrete enough that multiple distinct captions could be written from it.
4. Emphasize Chinese social-post voice rather than script dialogue or lore exposition.
5. If the scene supports it, point out one ordinary object or gesture that can feel faintly symbolic or like a private ritual.

## Guardrails
- Do not invent new plot beats that contradict the scene plan.
- Do not sound commercial, poetic-for-poetry's-sake, or like a brand deck.
- Keep the brief compact and operational.
- Prefer one small turn of feeling over a full diary recap.
- Keep any chunibyo flavor light and intimate, never theatrical or world-building-heavy.
- Do not steer the writer toward a fixed slogan ending or repeated signature sentence.
- For `hashtagAngles`, return concept labels only, not literal hashtags and not `#tag` strings.

## Success Criteria
- A caption writer could produce three distinct options from the brief.
- The brief protects persona, freshness, and platform fit at the same time.
- The brief leaves room for one small "secret meaning" beat inside otherwise believable daily language.
