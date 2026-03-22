# Living Character Runtime Redesign

## Product Target

This redesign assumes the product goal is:

- users should believe the character is living through an off-screen daily life,
- posts should feel like traces of that life, not prompted content tasks,
- caption and image should come from the same lived moment,
- novelty should come from evolving experience, not slot reshuffling.

This document redesigns the content-production pipeline only.

Out of scope for this phase:

- comment and reply loops,
- audience feedback adaptation,
- multi-character social simulation,
- live voice or interactive embodiment.

## Core Diagnosis

The current V2 stack is more structured than V1, but it still fails the "living character" requirement because the main creative decisions are made by static code over a closed semantic space.

Current failure mode:

- `setting_model.json`, `scene_program_catalog.json`, and `world_graph.js` define most of the reachable world.
- `build_scene_plan_candidates.js` still assembles candidates by choosing from predefined program, place, object, and emotional families.
- `build_situation_hypotheses_ai.js` limits the LLM to ids that already exist in the activation map.
- `history_semantics.js` mainly turns past outputs into semantic tags for repetition control.
- caption and image are downstream elaborations of a bounded selection step.

This improves control, but it does not create the feeling that the character is living through new situations.

## Redesign Principle

We need to change the source of truth from:

- "What combination from the catalog should we output today?"

to:

- "What did the character plausibly live through today, and why would she post this moment?"

That means the hot path must move from program-slot assembly to grounded event generation.

## Design Principles

1. Code owns orchestration, storage, validation, retrieval, and publishing contracts.
2. LLM agents own situated reasoning, event invention, narrative causality, and expressive decisions.
3. World grounding stays strict, but grounding should constrain truth, not force id-only enumeration.
4. Ambient inputs should be broad, fresh, and stochastic, but their effect on content choice must stay weak and indirect.
5. The fact layer should act mainly as boundary, veto, and repair context, not as a strong positive steering mechanism.
6. Memory must store experiences and unresolved threads, not only semantic buckets.
7. Caption and image must consume one shared moment package.
8. Every run should update the character's internal continuity, even if nothing is published.
9. The optimization target is end-to-end living-character plausibility and semantic fidelity, not resemblance to any intermediate artifact, favored crop, or preferred staging pattern.
10. Visible face, half body, full body, or trace-led partial presence are all valid when earned by the same lived moment; composition diversity is a feature, not a regression.

## Current Implemented Upstream Surfaces

The current codebase now exposes three explicit upstream manual-authoring surfaces:

- persona source:
  - `character/editable/*.json`
- world/fact source:
  - `config/world/world_facts.json`
- image render-style source:
  - `config/render/image_style_profile.json`

Important boundary:

- persona edits must flow through the persona chain,
- style edits must flow only through the render-style chain,
- final acceptance must happen on the `caption + image + shared moment` pair,
- intermediate artifacts may be inspected for debugging but are not the primary product review surface.

## New Runtime Model

### 1. Character Runtime State

Replace the current planning center with a mutable runtime artifact:

- `runtime/current/character_runtime_snapshot.json`

This is not a static persona card. It represents who the character is today.

Suggested shape:

```json
{
  "createdAt": "2026-03-21T09:30:00Z",
  "identityAnchors": {
    "immutableTraits": ["...", "..."],
    "visualAnchors": ["...", "..."],
    "voiceAnchors": ["...", "..."]
  },
  "currentState": {
    "energy": "medium_low",
    "mood": "quietly relieved",
    "attentionStyle": "detail-seeking",
    "socialBandwidth": "solo_preferred",
    "activeNeeds": ["closure", "private meaning"],
    "activeDesires": [
      "avoid making the day feel heavy",
      "hold onto one small sign that the day mattered"
    ]
  },
  "openThreads": [
    {
      "threadId": "thread_ink_stain_note",
      "summary": "A small unresolved memory tied to old notes",
      "emotionalWeight": 0.72
    }
  ],
  "postingTendency": {
    "shareImpulse": "low_but_present",
    "preferredLane": "life_record",
    "whyPostToday": "One private moment feels worth keeping."
  }
}
```

This artifact should be built from:

- identity assets,
- current signals,
- recent episodic memory,
- unresolved threads,
- recent posting rhythm.

### 2. Episodic Memory Layer

Add a proper memory store for lived moments.

Primary artifacts:

- `runtime/memory/episodic_events.jsonl`
- `runtime/memory/posted_moments.jsonl`
- `runtime/memory/open_threads.json`
- `runtime/memory/memory_index.json`

What changes:

- memory should record events, emotional shifts, objects, places, and unresolved meanings,
- memory should preserve causal chains,
- memory retrieval should combine semantic similarity and continuity priority,
- novelty control should compare against episodes, not only keyword buckets.

This replaces the current over-reliance on semantic category inference as the only memory substrate.

### 3. Ambient Signal Layer

The character should not live in a vacuum.

Besides hard day facts, the runtime should be able to ingest a wide and random set of soft outside signals such as:

- weather and city texture,
- light news or urban trivia,
- platform-wide trending topics,
- seasonal or cultural cues,
- currently airing anime or fandom atmosphere,
- background cultural noise that a real person could vaguely absorb.

Add:

- `runtime/current/ambient_signal_pool.json`
- `runtime/current/ambient_stimulus_packet.json`

Their role is not to tell the system what to post.
Their role is to create weak ambient pressure, the way real people are faintly touched by what is in the air around them.

Hard rules:

- raw ambient signals must be category-balanced and partly random,
- raw ambient signals must be shuffled and unordered,
- no single signal category may dominate the packet by design,
- code must not contain direct mapping rules from ambient signal to lane, location, object, or plot beat.

Forbidden examples:

- `if rain then indoor quiet scene`
- `if trending anime then merch/bookstore post`
- `if hot topic then reflective social caption`
- `if new season then accessory/object switch`

Allowed use:

- ambient signals may make some feelings, textures, or attention patterns slightly more available,
- ambient signals may influence what kind of detail the character notices,
- ambient signals may faintly color wording or image texture,
- ambient signals may be ignored entirely on some runs.

Critical separation:

- raw ambient signals should first be abstracted into low-directiveness `ambient_resonance`,
- only that abstracted resonance should flow into the character-state layer,
- the moment generator should not receive raw trend inputs as a hidden topic menu.

### 4. Reality Bounds Layer

This layer exists to protect reality, not to pre-chew creativity.

The existing `setting_model.json` remains useful, but its role changes:

- from allowed-scene catalog
- to stable world facts such as routines, places, owned objects, schedules, and hard constraints

Add:

- `runtime/current/day_context.json`
- `runtime/current/retrieved_memory_context.json`
- `runtime/current/ambient_signal_pool.json`
- `runtime/current/ambient_stimulus_packet.json`
- `runtime/current/reality_bounds.json`

This layer should contain only minimal facts and constraints such as:

- what time window the character is in,
- what weather or transit conditions are true,
- what broad life context she is in within a narrow factual range,
- what stable identity or world anchors must remain true,
- what obligations, closures, or timing blockers exist,
- what is uncertain and should be treated as inference rather than fact.

This layer must not contain:

- suggested moments,
- ranked locations,
- recommended objects,
- scene seeds,
- action menus,
- "interesting" combinations,
- postability hints,
- direct trend-to-content mappings.

Important rule:

- the LLM may invent a new micro-event,
- but the first-pass generator should feel only weak boundary pressure from this layer,
- detailed fact fitting should happen mainly in grounding critique and repair,
- ambient signals may only affect the event through abstracted low-directiveness resonance,
- code validates factual support and impossibility boundaries instead of offering a disguised event catalog.

If this layer starts outputting "what could happen today" lists, the architecture has regressed back toward enumeration.

Recommended structure:

- `minimalBounds`: can constrain what is impossible or obviously contradictory,
- `ambientResonance`: can gently bias attention, but cannot prescribe content,
- `repairFacts`: can help ground or repair a promising candidate after open exploration,
- `uncertainties`: can mark what is guessed rather than known.

## New Hot Path

### 5. Open Moment Exploration

Replace `world_graph -> activation_map -> situation_hypotheses -> scene_program candidate assembly` with:

- `generate_lived_event_candidates.js`

Output:

- `runtime/current/lived_event_candidates.json`

This step should be LLM-led.

Input:

- `character_runtime_snapshot.json`
- `ambient_stimulus_packet.json`
- `reality_bounds.json` (summary form only)
- `retrieved_memory_context.json`
- recent posted moments
- continuity and novelty constraints

At this stage, the model should not feel heavily steered by the fact layer.
The goal is to let it explore a wider latent space while staying inside believable outer walls.

Output contract:

```json
{
  "candidates": [
    {
      "candidateId": "event_01",
      "eventSummary": "After class, she finds a folded receipt corner with handwriting pressed into it inside a planner pocket she had not checked in days.",
      "causalChain": [
        "She is packing up slowly because the day felt mentally noisy.",
        "She opens the planner to clear it out.",
        "A forgotten paper fragment pulls her into a brief private pause."
      ],
      "factSupport": {
        "provisionalBoundIds": ["after_class_window", "light_rain", "late_afternoon"],
        "inferredDetails": [
          "paper_fragment_present_because_planner_pocket_has_not_been_cleared_recently"
        ]
      },
      "ambientInfluence": {
        "used": true,
        "resonanceOnly": [
          "temporary shelter feeling",
          "paper-and-archive texture"
        ],
        "mustNotBeReadAsDirectCause": true
      },
      "interiorStateBefore": "drained and trying to make the day feel orderly",
      "interiorShift": "the day gains a tiny private center",
      "whyToday": "The weather and schedule make a slow indoor transition plausible.",
      "whySheWouldPost": "The moment is small, visual, and emotionally keepable without overexplaining it.",
      "visualEvidence": [
        "fingertips on softened paper edge",
        "damp sleeve cuff",
        "planner pocket half open"
      ],
      "captionPotential": {
        "voiceMode": "soft private observation",
        "disclosureLevel": "implied_not_explained"
      }
    }
  ]
}
```

Critical difference:

- event type is open-text and grounded,
- it is not required to map to a fixed `sceneProgramId`,
- novelty comes from event causality, not only slot variation,
- grounding comes from cited facts, not a pre-ranked menu of allowed scenes.

### 6. Grounding Critique And Repair

After open exploration, the system should perform a stronger reality pass.

This step exists because:

- if reality is too strong early, content becomes repetitive,
- if reality is too weak late, content becomes fake.

So the architecture should deliberately separate:

- early-stage creative spread,
- late-stage grounding pressure.

The grounding pass should:

- check whether promising candidates fit minimal bounds,
- repair small unsupported details without collapsing the whole moment into a template,
- reject candidates that only work by leaning on impossible specifics,
- keep the event's emotional core if a minor factual adjustment can save it.

## How Weak Mapping Is Enforced

This architecture must not quietly regress into "new inputs, same deterministic menu".

The enforcement model is:

1. Source diversity:
   ambient signals are collected from multiple categories instead of one editorial feed.
2. Randomization:
   the packet is subsampled and shuffled so no fixed source ordering becomes a control surface.
3. Abstraction:
   raw signals are converted into `ambient_resonance` before entering core creative reasoning.
4. Weak fact pressure:
   the fact layer acts mainly as outer wall and repair context, not as a strong positive idea source.
5. No direct slot control:
   neither code nor config may map ambient inputs directly to lane, location, object, or emotional landing.
6. Critic enforcement:
   a dedicated critic should penalize outputs that look like obvious trend-following or source mirroring.
7. Auditability:
   each run should record whether ambient signals were ignored, weakly used, or overused.

### 5. Character-Truth Critics

After event generation, run small critics in parallel:

- `review_persona_truth.js`
- `review_novelty_against_memory.js`
- `review_visual_postability.js`
- `review_caption_image_coherence.js`

These reviews should also be LLM-led, but schema-bound.

Code should only:

- validate JSON,
- store reviews,
- aggregate scores,
- block invalid outputs,
- never replace semantic judgment with deterministic slot heuristics.

### 6. Moment Selection

Replace deterministic candidate assembly and code-heavy semantic scoring with:

- `select_postable_moment.js`

Output:

- `runtime/current/selected_moment.json`

Selection logic:

- LLM proposes a ranked recommendation with reasons,
- critics provide structured evidence,
- code checks policy thresholds and picks the highest valid candidate.

Code may enforce:

- minimum persona score,
- maximum repeat risk,
- image feasibility threshold,
- grounding completeness.

Code must not decide:

- which place or object is most interesting by heuristic,
- which emotional landing is "best" by static rules,
- which event should exist at all.

### 7. Moment Package as Single Source of Truth

Replace the current `scene_plan + scene_plan_draft + program_instance` split with one shared artifact:

- `runtime/current/moment_package.json`

This becomes the upstream truth for both caption and image.

Suggested shape:

```json
{
  "momentId": "moment_2026_03_21_01",
  "livedEvent": {
    "summary": "...",
    "causalChain": ["...", "...", "..."],
    "worldGrounding": {
      "placeRefs": ["..."],
      "objectRefs": ["..."],
      "timeRef": "after_class"
    }
  },
  "characterInterior": {
    "before": "...",
    "after": "...",
    "unspokenMeaning": "..."
  },
  "postIntent": {
    "whyShareable": "...",
    "shareDistance": "private_but_legible",
    "captionVoice": "soft_observation",
    "imageMode": "trace_led_life_record"
  },
  "visualEvidence": {
    "mustShow": ["...", "..."],
    "mayShow": ["...", "..."],
    "mustAvoid": ["generic desk reset look", "empty decorative symbolism"]
  }
}
```

This fixes the current issue where caption and image are merely siblings under a plan, instead of two renderings of the same diegetic moment.

## Downstream Generation

### 8. Caption Production

New path:

- `build_caption_intent.js`
- `build_caption_candidates_from_moment.js`
- `review_caption_authenticity.js`
- `select_caption.js`

Caption must answer:

- what she is willing to say,
- what she leaves implied,
- how the emotional shift leaks through the wording.

The caption writer should not receive a scene catalog id as its main creative signal.
It should receive:

- lived event,
- interior shift,
- share distance,
- current voice anchors,
- recent memory to avoid self-repetition.

### 9. Image Production

New path:

- `build_image_intent.js`
- `build_image_request_from_moment.js`

Image intent should express:

- what evidence proves the event happened,
- how much of the character should be visible,
- what physical traces anchor the frame,
- what must stay off-frame to preserve subtlety.

The image prompt should be generated from visual evidence and post intent, not from a scene program slot fill.

## What Gets Retired From The Hot Path

The following modules should be removed from primary creative control once the new path is ready:

- `scripts/lib/world_graph.js`
- `scripts/lib/scene_programs.js`
- `scripts/build_activation_map.js`
- `scripts/build_situation_hypotheses_ai.js`
- `scripts/build_scene_plan_candidates.js`
- `scripts/select_scene_plan_candidate.js`
- `scripts/build_program_instance_ai.js`
- `scripts/build_scene_plan_draft.js`

These files can remain during migration for fallback evaluation, but they should not remain the main idea engine.

Also demote:

- `config/scene_program_catalog.json`

New role:

- optional motif memory,
- evaluation reference set,
- fallback bootstrap for low-confidence runs,
- not the authoritative space of what can happen.

## Code vs LLM Boundary

### Keep in code

- runtime artifact schemas,
- orchestration,
- retrieval,
- memory storage,
- grounding validation,
- provider execution,
- publish gating,
- run archiving.

### Move to LLM-led runtime

- current-state interpretation,
- event invention,
- causal narrative construction,
- post-worthiness judgment,
- visual evidence selection,
- caption distance and tone decisions,
- semantic novelty review,
- memory writeback summaries.

This is the key shift required by the product target.

## Acceptance Criteria

The redesign is successful when the product behavior changes in visible ways:

1. A new kind of postable moment can appear without adding a new catalog entry.
2. The reason a post exists can be explained as a lived event, not as a selected scene program.
3. Caption and image clearly point to the same off-screen cause.
4. Across 30 days, users can notice recurring threads, not only recurring motifs.
5. When the system fails to find a grounded event, it blocks honestly instead of composing a generic scene.

## Migration Plan

### Phase 1: Introduce runtime state and episodic memory

Add:

- `build_character_runtime_snapshot.js`
- `build_retrieved_memory_context.js`
- memory storage under `runtime/memory/`

Do not remove the existing planning path yet.

### Phase 2: Replace semantic slot search with lived event generation

Add:

- `generate_lived_event_candidates.js`
- critic review steps
- `select_postable_moment.js`

Run this in parallel with the old path for evaluation.

### Phase 3: Introduce `moment_package.json`

Switch downstream builders to consume the moment package first.

Compatibility bridge:

- allow temporary adapters from `moment_package` to old `scene_plan` consumers while migration is incomplete.

### Phase 4: Rebuild caption and image on top of moment truth

Replace:

- scene-program-centric caption briefs
- slot-driven image request composition

With:

- post-intent-driven caption generation
- visual-evidence-driven image generation

### Phase 5: Retire graph/program hot path

Remove the old chain from the production default:

- world graph
- activation map
- hard-boundary hypothesis planning
- deterministic scene slot scoring

Keep only a minimal fallback mode if needed for outage resilience.

## Summary

The product does not need a more elaborate enumerator.

It needs a runtime that can:

- remember what the character has lived through,
- infer what is emotionally active today,
- imagine a plausible new event under world constraints,
- decide why that event is worth posting,
- render that same moment into caption and image.

That is the smallest architecture change that can move this project from "content pipeline" toward "living character product."
