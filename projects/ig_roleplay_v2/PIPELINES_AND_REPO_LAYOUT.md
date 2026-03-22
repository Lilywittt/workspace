# Pipelines And Repository Layout

## Why This Document Exists

The project now has two different needs:

1. explain the current end-to-end content pipeline exactly as it runs today,
2. define a replacement pipeline and repository layout that can support a believable living-character product.

This document does both.

It is intentionally explicit about:

- which step reads which data,
- which step is code-owned,
- which step is LLM-led,
- where static enumerative content still controls the output,
- which static inputs are allowed in the new hot path,
- which directories should be consolidated or retired.

## Current Pipeline

### Current top-level entrypoint

- `F:\openclaw-dev\ig-roleplay-v2-run.ps1`

This script orchestrates:

- Node scripts inside the container,
- host-side image generation through PowerShell,
- final packaging and run summary writing.

### Current source classes

#### User-editable character data

- `character/identity_profile.json`
- `vision/reference_library.json`
- `config/runtime.config.json`

#### Static planning configs

- `config/setting_model.json`
- `config/world_state_rules.json`
- `config/world_graph.json`
- `config/scene_program_catalog.json`
- `config/novelty_policy.json`

#### Legacy imported data still in the hot path

- `../../../data/ig_roleplay/signals.json`
- `../../../data/ig_roleplay/posted.jsonl`
- `../../../data/ig_roleplay/selected_image.json`

#### Runtime history

- `runtime/history/run_bundles/...`
- `runtime/current/*.json`
- `runtime/runs/...`

### Current stage-by-stage data flow

| Stage | Script | Inputs | Decision owner | Output | Current issue |
| --- | --- | --- | --- | --- | --- |
| 0 | `ig-roleplay-v2-run.ps1` | runtime config, provider env, orchestrated scripts | code | full run orchestration | orchestration is fine |
| 1 | `build_continuity_snapshot.js` | `posted.jsonl`, runtime config | code | `continuity_snapshot.json` | direct legacy history dependency |
| 2 | `build_novelty_ledger.js` | `continuity_snapshot.json`, runtime history bundles | code | `novelty_ledger.json` | memory is semantic counts, not lived events |
| 3 | `build_reflection_notes.js` | `novelty_ledger.json` | code | `reflection_notes.json` | still derived from counts only |
| 4 | `build_world_state_snapshot.js` | `signals.json`, `continuity_snapshot.json`, `setting_model.json`, `world_state_rules.json`, `identity_profile.json`, novelty and reflection artifacts | code | `world_state_snapshot.json` | state is rule-derived from fixed configs |
| 5 | `build_affordance_pool.js` | `world_state_snapshot.json`, `setting_model.json` | code | `affordance_pool.json` | affordances are predefined ids |
| 6 | `build_world_graph_snapshot.js` | world state, affordances, `setting_model.json`, `scene_program_catalog.json`, `world_graph.json`, novelty, identity | code | `world_graph_snapshot.json` | reachable world is defined by static graph and catalog |
| 7 | `build_continuity_creative_review.js` | continuity, novelty, reflection, world state, daily signals, persona | LLM with fallback | `continuity_creative_review.json` | can only suggest direction, cannot redefine the world |
| 8 | `build_activation_map.js` | world graph snapshot, world state, reflection, continuity | code | `activation_map.json` | code chooses the seeds that the LLM may use |
| 9 | `build_situation_hypotheses_ai.js` | activation map, world graph snapshot, world state, continuity review, persona | LLM with fallback | `situation_hypotheses_ai.json` | LLM is explicitly restricted to existing ids in activation map |
| 10 | `validate_situation_hypotheses.js` | hypotheses, activation map, world graph, `setting_model.json`, `scene_program_catalog.json`, novelty, identity | code | `validated_situation_hypotheses.json` | validation is tied to fixed ontology |
| 11 | `build_semantic_repeat_critic.js` | validated hypotheses, novelty, reflection, continuity review, persona | LLM with fallback | `semantic_repeat_critic.json` | only critiques inside the bounded candidate set |
| 12 | `build_scene_plan_candidates.js` | world state, affordances, novelty, continuity review, identity, validated hypotheses, repeat critic, activation map, world graph, scene catalog | hybrid or code fallback | `scene_plan_candidates.json` | candidate generation still depends on static scene programs and code scoring |
| 13 | `select_scene_plan_candidate.js` | `scene_plan_candidates.json` | code | `selected_scene_candidate.json` | final creative selection is code score sorting |
| 14 | `build_program_instance_ai.js` | selected candidate, selected hypothesis, repeat critic, world state, continuity review, persona | LLM with fallback | `program_instance_ai.json` | LLM cannot change selected semantics |
| 15 | `build_scene_plan_draft.js` | continuity, continuity review, selected candidate, selected hypothesis, program instance, world state, affordances, signals, persona | LLM with fallback | `scene_plan_draft.json` | creative prose is downstream of already locked semantics |
| 16 | `build_scene_plan.js` | selected candidate, selected hypothesis, program instance, scene plan draft, continuity, signals, world state, affordances, identity, reference library, legacy posts fallback | code | `scene_plan.json` | code compiles the final authoritative scene semantics |
| 17 | `build_caption_brief_draft.js` | scene plan, persona | LLM with fallback | `caption_brief_draft.json` | brief is already anchored to scene program semantics |
| 18 | `build_caption_brief.js` | scene plan, caption brief draft, persona | code | `caption_brief.json` | explicitly tells writing to use scene program and fixed semantics |
| 19 | `build_caption_candidates_ai.js` | scene plan, caption brief, continuity | LLM with fallback | `caption_candidates_ai.json` | output space is still downstream of bounded scene plan |
| 20 | `build_caption_candidates.js` | scene plan, caption brief, caption AI output | code | `caption_candidates.json` | code validates and may replace with fallback |
| 21 | `build_caption_selection_review.js` | scene plan, caption brief, caption candidates, continuity | LLM with fallback | `caption_selection_review.json` | only ranks within already produced candidates |
| 22 | `select_caption_candidate.js` | caption candidates, continuity, selection review | code | `selected_caption.json` | final selection is still code-scored |
| 23 | `build_image_brief.js` | scene plan, selected caption, identity, reference library | code | `image_brief.json` | image is explicitly bound to scene program, location archetype, object bindings, weather role |
| 24 | `build_image_request.js` | scene plan, image brief, selected caption, identity | code | `image_request.json` | image prompt is assembled from code-owned semantic slots |
| 25 | `host_generate_openai_image.ps1` | `image_request.json`, provider config, env keys | model provider | `generated_image.json` and generated asset file | model renders an already fixed prompt package |
| 26 | `build_post_package.js` | scene plan, selected caption, generated image, image request, legacy `selected_image.json` fallback | code | `post_package.json` | packaging still happens in intermediate runtime only |
| 27 | `build_final_delivery.js` | post package, selected caption, generated image | code | `runtime/final/current/*` | final caption + final image + final manifest are separated from engineering artifacts |
| 28 | `publish_post_package.js` | final delivery | code | `publish_result.json` | publish now reads only the final delivery manifest |

### Where the current LLM actually decides

The current LLM does useful work, but it does not own the main creative search space.

#### Current LLM-owned outputs

- continuity refresh suggestions,
- bounded situation hypotheses,
- repeat criticism over bounded hypotheses,
- run-specific program wording,
- scene prose draft,
- caption brief draft,
- caption candidates,
- caption selection review.

#### Current code-owned creative constraints

- lane recommendation,
- world state derivation,
- affordance inventory,
- reachable places, objects, and programs,
- activation seeds,
- candidate scoring and final scene candidate selection,
- final scene semantics assembly,
- image prompt structure,
- final caption selection.

### Why the current pipeline remains enumerative

The key problem is not that the pipeline uses LLMs too little overall.
The problem is that the LLM is mostly used after the world has already been reduced to a bounded semantic search space.

The strongest examples are:

- `build_situation_hypotheses_ai.js` only allows ids that already exist in the activation map.
- `scene_programs.js` still drives candidate generation and selection through predefined programs, locations, objects, weather roles, and emotional families.
- `build_caption_brief.js` explicitly tells the writer to use the current scene program as the semantic backbone.
- `build_image_brief.js` explicitly binds image generation to scene program, location archetype, object bindings, and weather role.

In practice, this means:

- code chooses what kinds of situations are possible,
- LLM mostly rephrases, refines, critiques, and decorates the chosen space.

## Static Data Audit

### Static inputs that are acceptable in the new system

These are facts, constraints, or stable identity anchors. They should remain.

- immutable character identity anchors,
- voice and style preferences,
- visual identity anchors,
- owned objects and recurring places as world facts,
- school schedule and daily routine facts,
- provider capabilities and publish policies,
- safety rules and schema contracts.

### Static inputs that must not remain hot-path content drivers

These must be removed from primary creative control.

- `scene_program_catalog.json` as the authoritative source of what can happen,
- `world_graph.json` as the authoritative reachable scene space,
- `runtime.config.json -> vision.life_record.sceneFocus` as a scene generator,
- deterministic `chooseLocation`, `chooseObject`, `chooseEmotionalLanding`, and similar code heuristics,
- `actionKernel` as the main creative origin,
- fixed affordance ids as the only allowed opportunity types,
- legacy `selected_image.json` in the packaging hot path,
- direct dependence on legacy `posted.jsonl` for production continuity after migration is complete.

### Static data usage rule for the new pipeline

Static data may tell us:

- what is true,
- what is stable,
- what is forbidden,
- what is available,
- what must remain visually consistent.

Static data must not tell us:

- what event should happen today,
- which object is the most interesting today,
- what emotional meaning the character should land on,
- why the post exists,
- what story beats must happen in fixed slot order.

## Dynamic Input Rule

The new pipeline should also consume dynamic outside-world input, but only under a weak-mapping rule.

Allowed dynamic source categories:

- weather and city texture,
- light news or trivia,
- trending topics,
- seasonal and cultural cues,
- currently airing anime or fandom atmosphere,
- other broad background signals that a real person might vaguely absorb.

These sources should be:

- broad rather than single-threaded,
- random rather than editorially fixed,
- unordered rather than ranked,
- weakly influential rather than directive.

The key product rule:

- dynamic inputs may shape what feels faintly present in the air,
- dynamic inputs must not directly choose the post topic.

Forbidden architecture patterns:

- direct `signal -> lane` mapping,
- direct `signal -> place` mapping,
- direct `signal -> object` mapping,
- direct `signal -> emotional landing` mapping,
- fixed rules that turn trending signals into topical posting.

## Target Pipeline

### Target product behavior

The post should feel like a trace of an off-screen lived moment.

That requires the hot path to move from:

- semantic slot selection

to:

- grounded lived-event generation.

### Target top-level source classes

#### Editable character profile

Human-maintained source of truth for persona and visual identity.

#### Grounded day inputs

Facts about time, weather, routine window, and location context.

#### Ambient signal pool

Broad, fresh, and random soft outside-world signals that may create weak background pressure but cannot prescribe content.

#### Episodic memory

Persistent store of lived events, posted moments, open threads, and continuity state.

#### Policy and provider config

Validation, safety, publish, and render capability constraints.

### Non-enumerative rule for the fact layer

The new pipeline still needs a code-owned reality layer, but that layer must never turn into a hidden content planner.

Allowed:

- raw day facts,
- stable world facts,
- hard blockers,
- uncertainty markers,
- physical availability,
- timing and location constraints.

Forbidden:

- candidate scene lists,
- recommended objects,
- ranked affordances,
- mood suggestions,
- action menus,
- "most interesting" combinations,
- post-worthy event suggestions.

The product test is simple:

- if stage 4 starts telling the model what kind of post is likely today, we have rebuilt the old enum system in a different costume.
- if stage 4 becomes a strong positive prompt for moment choice, we will still fall into the same local basin and repeat ourselves.

### Target stage-by-stage data flow

| Stage | Target owner | Main input | Main output | What is decided here |
| --- | --- | --- | --- | --- |
| 0 | code | run trigger, config, provider env | orchestrated run | start a single coherent run |
| 1 | code | day signals, clock, import adapters | `day_context.json` | factual day context only |
| 2 | code | dynamic feeds and adapters | `ambient_signal_pool.json` | collect broad fresh outside-world signals with no content decision yet |
| 3 | code | ambient signal pool, randomness policy | `ambient_stimulus_packet.json` | build a category-balanced, shuffled, weakly directive stimulus packet |
| 4 | code | episodic memory store, posted moments, open threads, current day context | `retrieved_memory_context.json` | which memories and unresolved threads are relevant now |
| 5 | LLM with code validation | editable character profile, day context, ambient stimulus packet, retrieved memory context, posting history summary | `character_runtime_snapshot.json` | who the character is today, what is emotionally active, what ambient resonance is faintly present, why posting is plausible |
| 6 | code | world facts, day context, character runtime snapshot | `reality_bounds.json` | define weak outer walls, contradiction rules, and later repair context without strongly steering content |
| 7 | LLM with code validation | character runtime snapshot, ambient stimulus packet, reality bounds summary, retrieved memory context, recent posted moments | `proto_moment_candidates.json` | explore a wider lived-moment space under weak boundary pressure |
| 8 | LLM critics plus code validation | proto moment candidates, persona, memory, full reality bounds | review artifacts | persona truth, factual fit, repairability, visual postability, caption-image coherence, source overfitting risk |
| 9 | hybrid | candidate set plus reviews | `selected_moment.json` | choose the strongest moment after grounding critique and repair |
| 10 | code | selected moment and reviews | `moment_package.json` | compile one authoritative moment truth for all downstream consumers |
| 11 | LLM with code validation | moment package, character profile, recent caption history | `caption_intent.json` | disclosure distance, voice pressure, what remains unsaid |
| 12 | LLM with code validation | moment package, caption intent | `caption_candidates.json` | multiple captions rooted in the same lived moment |
| 13 | hybrid | caption candidates and caption reviews | `selected_caption.json` | choose the most authentic caption |
| 14 | LLM with code validation | moment package, character profile, visual anchors | `image_intent.json` | what visual evidence proves the event happened |
| 15 | code | moment package, image intent, provider capability, visual anchors | `image_request.json` | provider-ready render package built from visual evidence rather than scene slots |
| 16 | provider model | image request | `generated_image.json` and asset file | render the chosen moment |
| 17 | code | selected moment, selected caption, generated image | `post_package.json` | package a coherent release artifact |
| 18 | code | post package | `publish_result.json` | dry-run or publish |
| 19 | LLM summary plus code writeback | selected moment, caption, image, publish result | episodic memory update | store what happened and which threads changed |
| 20 | code | all run artifacts | output bundle | archive one coherent run bundle |

### Target LLM decision boundaries

#### LLM must decide

- current inner state interpretation,
- which lived events are plausible and emotionally meaningful,
- why one moment is post-worthy,
- what remains implied in the caption,
- which visual traces make the event believable,
- how the event updates memory and unresolved threads,
- whether any ambient background signal matters at all.

#### Code must decide

- how data is loaded, stored, and versioned,
- how retrieval works,
- how ambient sources are collected, randomized, and capped,
- which minimal facts form the outer wall,
- whether a candidate is grounded in available facts after open exploration,
- whether a candidate is overfitting a raw outside signal,
- whether policy thresholds are satisfied,
- how provider prompts are assembled,
- how publish and archiving work.

### Target hot-path rule

The new hot path must never require a fixed `sceneProgramId` or similar ontology id to create content.

Open-text lived events are allowed if:

- they are grounded in world facts,
- they respect character continuity,
- they remain visually renderable,
- they do not contradict persistent memory.

They are stronger if:

- they feel lightly touched by the outside world without reading like a topical assignment,
- they do not look like they were dragged into the same repetitive basin by a heavily positive fact layer,
- the source influence is diffuse enough that a user would feel "she is living in the same world as me" rather than "the system picked a trend prompt."

## Persona Editing Model

### Current problem

Right now the editable character surface is too concentrated and too mixed:

- `identity_profile.json` combines immutable identity, voice, creative guidance, and visual stability,
- `vision/reference_library.json` keeps visual anchors outside the character directory,
- some world-facing character biases leak into config and runtime layers.

This makes character editing harder than it should be.

### Target editable persona surface

The user-editable source of truth should be a small folder under `character/`.

Recommended structure:

```text
character/
  editable/
    core.identity.json
    voice.style.json
    visual.identity.json
    posting.behavior.json
    README.md
  compiled/
    character_profile.json
```

#### `core.identity.json`

Human-edited:

- display name,
- apparent age impression,
- immutable traits,
- stable temperament,
- hard prohibitions.

#### `voice.style.json`

Human-edited:

- sentence rhythm,
- tone rules,
- disclosure style,
- narrative must-have and must-not-have rules.

#### `visual.identity.json`

Human-edited:

- stable visual anchors,
- allowed visual variation,
- required identity anchor ids,
- trace cue preferences for non-selfie content.

#### `posting.behavior.json`

Human-edited:

- share distance,
- preferred posting tendencies,
- what kinds of moments she would usually post,
- what kinds of moments she would usually keep private.

### Compilation rule

The hot path should not read the editable files directly from many places.

Instead:

- human edits `character/editable/*`,
- a code-owned builder compiles them into `character/compiled/character_profile.json`,
- the runtime reads only the compiled profile.

This keeps manual editing simple without letting the codebase scatter persona rules across unrelated directories.

### Visual anchor consolidation

The current `vision/` directory should be folded into the character surface.

Recommended migration:

- move `vision/reference_library.json`
- into `character/editable/visual.identity.json` or a nearby `character/editable/visual_anchors.json`

Reason:

- visual identity is part of the character contract, not a separate subsystem from the user's perspective.

## Target Repository Layout

### Current layout issues

The project currently has several structural problems:

- flat `scripts/` directory with many mixed stages,
- `scripts/lib/` mixing core logic, planning logic, prompt logic, providers, and validators,
- `character/` and `vision/` splitting one logical character-edit surface,
- `runtime/current`, `runtime/runs`, `runtime/generated`, `runtime/deliverables`, and `runtime/history/run_bundles` overlapping in purpose,
- static catalogs and live runtime policy files mixed under one `config/` directory,
- no clear separation between editable source-of-truth data and generated artifacts.

### Recommended repository layout

```text
ig_roleplay_v2/
  character/
    editable/
    compiled/
  config/
    runtime/
      runtime.config.json
      creative_model.json
      provider_catalog.json
    world/
      world_facts.json
      routine_calendar.json
      day_rules.json
    policies/
      generation_policy.json
      novelty_policy.json
      publish_policy.json
    legacy/
      scene_program_catalog.json
      world_graph.json
  pipeline/
    00_ingest/
    10_runtime/
    20_memory/
    30_moment/
    40_caption/
    50_image/
    60_publish/
  src/
    core/
    llm/
    memory/
    providers/
    retrieval/
    validation/
  runtime/
    state/
      current/
      runs/
    memory/
      episodic_events.jsonl
      posted_moments.jsonl
      open_threads.json
      retrieval_index.json
    output/
      current/
      history/
    publish/
      publish_history.jsonl
  schemas/
    state/
    memory/
    generation/
    publish/
  tests/
  tools/
  README.md
```

### Directory rules

#### `character/`

Only user-editable character truth and compiled character truth.

#### `config/world/`

World facts and rules only.
No scene catalogs that define the creative search space.

#### `config/policies/`

Validation, novelty, publish, and generation guardrails only.

#### `config/legacy/`

Temporary parking area for deprecated enumerative assets during migration.

#### `pipeline/`

Stage entrypoints only.
Each directory owns one pipeline phase.

#### `src/`

Reusable code only.
No stage scripts and no generated artifacts.

#### `runtime/state/`

Only current and per-run state artifacts.

#### `runtime/memory/`

Persistent memory and continuity data.

#### `runtime/output/`

Only final deliverables and bundled output assets.

### Deprecation map

| Current path | Target state |
| --- | --- |
| `vision/` | merge into `character/` |
| `config/scene_program_catalog.json` | demote to `config/legacy/` or delete after migration |
| `config/world_graph.json` | demote to `config/legacy/` or delete after migration |
| flat `scripts/` | replace with staged `pipeline/` directories |
| `scripts/lib/scene_programs.js` | retire from hot path, then demote or remove |
| `scripts/lib/world_graph.js` | retire from hot path, then demote or remove |
| `runtime/current/` | move to `runtime/state/current/` |
| `runtime/runs/` | move to `runtime/state/runs/` |
| `runtime/generated/` | merge into `runtime/output/` |
| `runtime/deliverables/` | merge into `runtime/output/` |
| `runtime/history/run_bundles/` | merge into `runtime/output/history/` |
| legacy `../../../data/ig_roleplay/posted.jsonl` | import once into `runtime/memory/posted_moments.jsonl`, then remove from hot path |
| legacy `../../../data/ig_roleplay/selected_image.json` | remove from hot path |

## Migration Rules

### Rule 1

Do not let the new pipeline read legacy history directly once memory import is complete.

### Rule 2

Do not let fixed scene catalogs remain in the primary moment-generation path.

### Rule 3

Do not let caption or image generation take `sceneProgramId` as their main creative signal.

### Rule 4

Do let static world data remain as grounding facts and validation constraints.

### Rule 5

Do keep one clean manual-edit surface for the character under `character/`.

## Summary

The current pipeline is:

- operationally capable,
- partly LLM-assisted,
- still fundamentally shaped by static code and bounded enumeration.

The target pipeline must instead be:

- grounded in facts,
- memory-aware,
- LLM-led at the event and expression layers,
- code-validated rather than code-authored at the creative core,
- organized around one clean character-edit surface and one clean runtime storage layout.
