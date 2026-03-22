---
name: anime-prompt-optimizer
description: Use when improving image prompt structure for the IG roleplay V2 project, especially for Japanese anime bishoujo style, character presence, prompt layering, and reducing text artifacts or photoreal drift without bypassing the formal pipeline artifacts.
---

# Anime Prompt Optimizer

This skill improves the **prompt strategy**, not the publish state.

Use it when:

- generated images look too photorealistic,
- the frame loses the character,
- the image has text artifacts or poster-like composition,
- a lane needs better selfie vs life-record prompt separation,
- `build_image_request.js` or related prompt compilers need refinement.

## Inputs

Read only what is needed:

- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\runtime\current\scene_plan.json`
- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\runtime\current\image_brief.json`
- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\runtime\current\image_request.json`
- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\runtime\current\generated_image.json`
- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\character\identity_profile.json`
- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\config\runtime.config.json`

## Workflow

1. Inspect the current lane and presence mode.
2. Check whether the image request is leaking pipeline metadata into the visual prompt.
3. Rebuild prompt structure in layers instead of one flat paragraph.
4. Keep identity cues and scene cues separate.
5. Push prompt improvements into compiler code, not into ad-hoc runtime edits.
6. Re-run the pipeline and compare the new output against the previous image.

## Preferred Prompt Shape

Use this structure:

- global style
- character core
- scene
- camera/composition
- mood
- small details
- hard constraints

Avoid:

- raw internal field names
- verbose system prose
- directly copying long negative instructions into the positive body
- leaving text/watermark constraints ambiguous

## Guardrails

- Do not mark publish ready.
- Do not edit `generated_image.json` by hand.
- Do not bypass `build_image_request.js`.
- Keep improvements upstream in readable code.
