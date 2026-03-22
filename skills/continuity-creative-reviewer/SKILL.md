---
name: continuity-creative-reviewer
description: Use when `continuity_snapshot.json` already exists and you need a creative review of recent posting rhythm, repetition risk, and freshness opportunities before drafting the next scene plan.
---

# Continuity Creative Reviewer

Use this skill after factual continuity has been computed and before scene planning starts. This skill does not replace the continuity ledger. It turns recent history into creative direction.

## Inputs
- `runtime/current/continuity_snapshot.json`
- Daily signals such as weather, trends, and location context
- Optional recent posting notes if they already exist

## Output Shape
Return compact JSON only, with these fields:
- `laneSoftPreference`
- `freshnessTargets`
- `avoidMotifs`
- `narrativeNudges`
- `captionAdvice`
- `imageAdvice`
- `summary`

## Workflow
1. Read the continuity facts first. Treat streak counts, duplicate guards, and recommended lane as hard facts.
2. Identify what would feel repetitive even if it is not a literal duplicate.
3. Propose a freshness angle that changes mood, framing, or scale without breaking continuity.
4. Keep advice short enough for downstream scripts to merge into the planner.

## Guardrails
- Never override hard rhythm policy or invent contradictory history.
- Do not restate the entire snapshot. Add only the creative delta.
- Prefer intimate, day-sized changes over dramatic resets.
- Advice should help Chinese social-post writing, even if JSON fields are in English.

## Success Criteria
- The next post feels like part of the same life, not a generic reset.
- Downstream planner gets concrete freshness guidance, not vague taste words.
