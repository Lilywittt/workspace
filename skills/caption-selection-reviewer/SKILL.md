---
name: caption-selection-reviewer
description: Use when validated caption candidates already exist and you need a creative review that recommends which one best fits the scene, continuity, and social-post quality before final selection.
---

# Caption Selection Reviewer

Use this skill after candidate validation and before the final caption is selected. The job is to rank strong options, not to rewrite them.

## Inputs
- `runtime/current/scene_plan.json`
- `runtime/current/caption_brief.json`
- `runtime/current/caption_candidates.json`
- Continuity guards or recent-history hints

## Output Shape
Return compact JSON only, with these fields:
- `selectedCandidateId`
- `reason`
- `strengths`
- `risks`

## Workflow
1. Compare candidates against the current scene, mood, and continuity pressure.
2. Prefer the option that feels most publishable and least repetitive.
3. Explain the choice in short operational language that downstream scoring can use.
4. Keep the decision bounded to the provided candidate ids.
5. When options are otherwise close, prefer the one that keeps a light private-ritual or tiny-omen texture without sounding overwritten.

## Guardrails
- Never invent a new candidate id.
- Do not rewrite captions in place.
- Balance freshness, persona fit, and publishability instead of chasing maximal drama.
- Keep the review brief and decision-oriented.
- Do not reward theatrical fantasy language if it weakens daily-life believability.
- Do not assume a fixed slogan-style ending is automatically stronger; judge it by freshness and scene fit like any other line.

## Success Criteria
- The chosen candidate is easy to defend with concrete strengths and manageable risks.
- Downstream selection can combine this review with deterministic novelty scoring.
- The final pick should feel slightly enchanted in a human-scale way, not generic or melodramatic.
