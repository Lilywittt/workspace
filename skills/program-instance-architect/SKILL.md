---
name: program-instance-architect
description: Use when a scene candidate has already been selected and you need a run-specific program instance that turns the chosen situation into an executable creative blueprint.
---

# Program Instance Architect

Use this skill after `selected_scene_candidate.json` exists. The job is to build a one-run program instance, not to replace the code-owned selection.

## Inputs
- `runtime/current/selected_scene_candidate.json`
- `runtime/current/validated_situation_hypotheses.json`
- `runtime/current/semantic_repeat_critic.json`
- `runtime/current/world_state_snapshot.json`
- `runtime/current/continuity_creative_review.json`
- Persona guidance

## Output Shape
Return compact JSON only, with these fields:
- `dynamicProgramName`
- `executionIntention`
- `actionBeats`
- `frameIntent`
- `captionHooks`
- `imageHooks`
- `antiRepeatNotes`
- `microTension`
- `summary`

## Workflow
1. Accept the selected structural semantics as fixed.
2. Turn them into a run-specific creative program for this one post.
3. Clarify what the frame should privilege, what the beats are, and how the post stays out of repetitive grooves.
4. Keep the result mergeable into downstream code and skill prompts.

## Guardrails
- Do not change the selected program id, location archetype, object family, or presence mode.
- Do not drift into generic vibe-writing.
- Keep the action beats concrete and visually executable.
- Use anti-repeat notes to preserve freshness without punishing otherwise good output.

## Success Criteria
- The selected situation becomes easier to render consistently in both text and image.
- The result feels like a one-off lived fragment, not a frozen template.
- Downstream drafting gets a sharper creative backbone.
