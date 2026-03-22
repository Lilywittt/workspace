---
name: situation-hypotheses-planner
description: Use when the activated world graph is ready and you need multiple structured situation hypotheses that feel like distinct lived fragments rather than catalog reshuffles.
---

# Situation Hypotheses Planner

Use this skill after `activation_map.json` is ready and before deterministic validation. The job is to propose multiple high-level situations inside the activated world, not to write prose captions.

## Inputs
- `runtime/current/world_graph_snapshot.json`
- `runtime/current/activation_map.json`
- `runtime/current/world_state_snapshot.json`
- `runtime/current/continuity_creative_review.json`
- Persona guidance

## Output Shape
Return compact JSON only, with these fields:
- `hypotheses`
- `summary`

Each hypothesis must include:
- `hypothesisId`
- `sourceSeedId`
- `lane`
- `sceneProgramId`
- `affordanceId`
- `locationArchetype`
- `objectFamily`
- `suggestedObjectBindings`
- `weatherRole`
- `emotionalLanding`
- `presenceMode`
- `situationType`
- `relationshipTension`
- `actionArc`
- `captionHooks`
- `imageHooks`
- `noveltyClaim`
- `premiseSeed`
- `whyNow`

## Workflow
1. Treat the activation map as the legal world boundary.
2. Propose 5 to 8 situations that are structurally distinct from one another.
3. Change the social surface, object relationship, or emotional landing when you change a situation.
4. Keep each hypothesis typed and compact enough for code validation.
5. Think like a creative planner, not a copywriter.

## Guardrails
- Never invent ids outside the provided activation map.
- Do not make “different wording, same basin” proposals.
- Avoid defaulting to indoor study or generic rainy-window mood unless the activated seeds truly force it.
- Keep the chunibyo flavor subtle and daily-life grounded.
- Do not output nested essays or markdown.

## Success Criteria
- The hypothesis set feels like multiple possible days in the same life.
- Downstream code can validate and rerank them without guessing your intent.
- At least some options widen the world beyond the previous local optimum basin.
