---
name: character-presence-reviewer
description: Use when reviewing generated IG roleplay V2 images for character presence, anime fit, bishoujo appeal, identity consistency, and whether a life-record image still feels like it belongs to the character even when the full face is not visible.
---

# Character Presence Reviewer

This skill reviews whether an image is a **good product image**, not merely a successful API output.

Use it when:

- a new image has been generated,
- the team needs a product-facing verdict,
- a life-record frame may not fully show the character,
- we need to judge whether POV, reflection, hand, sleeve, or accessory cues are enough,
- we need to decide whether the next improvement should target prompt structure, identity anchors, or composition.

## Inputs

Read only what is needed:

- the latest generated image under `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\runtime\generated`
- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\runtime\current\scene_plan.json`
- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\runtime\current\image_request.json`
- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\character\identity_profile.json`

## Review Rubric

Judge on five axes:

1. anime fit
2. bishoujo appeal
3. character presence
4. identity consistency
5. social-post usability

## Rating Logic

An image is not product-ready if any of these fail:

- it looks photoreal instead of anime,
- it reads like empty scenery with no character ownership,
- it contains text artifacts or watermark-like noise,
- it cannot be recognized as belonging to the same girl or the same account.

## Output Style

When reporting, separate:

- engineering success
- product fit
- the next most effective fix

Keep the verdict concrete and product-manager-readable.
