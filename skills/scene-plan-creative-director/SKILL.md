---
name: scene-plan-creative-director
description: Use when continuity review is ready and you need a creative scene draft that turns lane policy, daily signals, and character identity into a specific narrative direction for the next post.
---

# Scene Plan Creative Director

Use this skill between factual continuity and the final `scene_plan.json`. It proposes the creative shape of the post while code keeps the hard policy boundary.

## Inputs
- `runtime/current/continuity_snapshot.json`
- `runtime/current/continuity_creative_review.json`
- Identity and visual profile data
- Daily signals for weather, city context, and trends

## Output Shape
Return compact JSON only, with these fields:
- `requestedPresenceMode`
- `narrativePremise`
- `microPlot`
- `sensoryFocus`
- `sceneNotes`
- `tone`
- `captionFocus`
- `summary`

## Workflow
1. Start from the allowed lane and continuity rhythm.
2. Decide what the scene is emotionally about in one sentence.
3. Build a three-step micro-plot: cause, action, feeling.
4. Add one ordinary object, gesture, or weather trace that can carry a tiny omen-like or ritual-like feeling.
5. Add visual notes that make the frame feel lived-in and character-specific.
6. Keep the result mergeable into a deterministic planner.

## Guardrails
- Never switch to a lane that policy does not allow.
- Avoid broad cinematic spectacle; prefer daily-life specificity.
- Avoid stock fallback motifs like "cafe window", "street corner", "tabletop drink", or "rainy glass" unless the current inputs genuinely justify them.
- Keep the chunibyo flavor subtle: private ritual, tiny omen, or secret-sign energy, not grand destiny speech.
- Keep the character recognizable through framing, traces, or emotional texture.
- Do not output schema drift or nested structures outside the expected fields.

## Success Criteria
- The final scene plan can inherit a clear premise, micro-plot, and scene texture.
- The post feels like this character on this day, not a generic anime prompt.
- One small element in the scene feels quietly meaningful without turning into lore exposition.
