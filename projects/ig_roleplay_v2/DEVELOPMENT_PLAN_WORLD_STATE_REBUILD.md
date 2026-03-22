# World State Rebuild Plan

## Goal

Upgrade IG Roleplay V2 from a narrow one-shot scene planner into a layered content-planning system with:
- typed world state
- semantic affordances
- reusable scene programs
- multi-candidate planning
- deeper continuity and novelty ledgers
- downstream scene semantics for caption and image generation

This document is the execution plan, not only the idea note.

## Product Outcomes We Want

The rebuild should improve product quality in ways that are visible to a PM, not only to the codebase:
- the character should feel like she lives in a wider daily world
- runs should stop collapsing into the same rain/room/study basin
- diversity should come from believable situation changes, not just wording variation
- captions and images should share the same semantic scene plan
- continuity should detect repeated motifs earlier than the user does
- future GUI controls should map to stable, typed configuration points

## Non-Goals

This phase does not aim to:
- replace the current publish bridge
- replace the image provider bridge
- introduce a full multi-character simulation engine
- solve perfect face consistency for selfie generation

## Current Architectural Pain Points

### State model
- `runtime/current/scene_plan.json` mixes world facts, narrative prose, and downstream hints in one artifact.
- `runtime.config.json -> vision.life_record.sceneFocus` is still a flat list, not a semantic planning model.
- `build_scene_plan_draft.js` uses a thin input surface: lane, weather, trend, sensory focus.

### Continuity
- `build_continuity_snapshot.js` tracks lane rhythm, hashtags, and opening repetition.
- It does not track scene program repetition, object families, action kernels, emotional landings, or weather roles.

### Planning
- The system generates one scene draft, then locks it.
- There is no candidate pool, no semantic reranking, and no explicit affordance layer.

### Downstream semantics
- Caption and image builders still consume too much prose and not enough typed scene structure.
- This makes the pipeline sound flexible while still behaving rigidly at scale.

## Target Runtime Artifacts

### Hot-path artifacts
These participate directly in the main run:
- `runtime/current/world_state_snapshot.json`
- `runtime/current/affordance_pool.json`
- `runtime/current/scene_plan_candidates.json`
- `runtime/current/scene_plan.json`

### Cold-path artifacts
These influence future runs but do not have to be rebuilt in every minimal test:
- `runtime/current/novelty_ledger.json`
- `runtime/current/reflection_notes.json`
- `config/setting_model.json`
- `config/scene_program_catalog.json`
- `config/world_state_rules.json`
- `config/novelty_policy.json`

## Planned Config Files

### `config/setting_model.json`
Purpose:
- store slow-moving world truths
- place archetypes, routine anchors, recurring objects, seasonal affordances, school-life rhythms

Suggested sections:
- `placeArchetypes`
- `routineAnchors`
- `ownedObjectPools`
- `seasonalAffordances`
- `mobilityDefaults`
- `calendarModes`

### `config/world_state_rules.json`
Purpose:
- map external signals + continuity pressure into typed world-state values

Suggested sections:
- `daypartRules`
- `weekdayModeRules`
- `temperatureBandRules`
- `mobilityWindowRules`
- `energyHeuristics`
- `weatherRolePolicies`

### `config/scene_program_catalog.json`
Purpose:
- replace flat scene families with reusable scene programs

Each scene program should define:
- `id`
- `laneEligibility`
- `entryConditions`
- `requiredAffordances`
- `forbiddenConditions`
- `slotSchema`
- `actionKernel`
- `locationArchetypes`
- `objectSources`
- `weatherPolicy`
- `socialConfiguration`
- `emotionalLandingFamilies`
- `presencePolicies`
- `captionHooks`
- `imageHooks`
- `cooldownRules`

### `config/novelty_policy.json`
Purpose:
- centralize reranking and repetition control

Suggested sections:
- `sceneProgramCooldowns`
- `locationCooldowns`
- `objectFamilyCooldowns`
- `weatherRolePenalty`
- `clusterDominanceThresholds`
- `semanticSimilarityWeights`

## Planned Scripts

### Phase 1 scripts
- `build_world_state_snapshot.js`
- `build_affordance_pool.js`

### Phase 2 scripts
- `build_scene_plan_candidates.js`
- `select_scene_plan_candidate.js`

### Phase 3 scripts
- `build_novelty_ledger.js`
- `build_reflection_notes.js`

### Existing scripts to adapt
- `build_continuity_snapshot.js`
- `build_scene_plan.js`
- `build_scene_plan_draft.js`
- `build_caption_brief_draft.js`
- `build_caption_brief.js`
- `build_image_brief.js`
- `build_image_request.js`
- `validate_creative_intelligence.js`

## Implementation Plan

### Phase 0: Cleanup and guardrails
Status:
- in progress / prerequisite

Tasks:
- remove dead manual bridge scripts that no longer belong to the production path
- update architecture docs so future contributors read the right documents first
- keep current pipeline contract stable while new layers are introduced in parallel

Deliverables:
- clean doc map
- dead-code removal
- updated build log entry

Product effect:
- lower confusion cost for future contributors
- lower chance of old adapter logic re-entering the main path

### Phase 1: Typed world state

Objective:
- stop treating weather/trend as direct scene generators
- create a typed state layer that can support richer planning

Code changes:
- add `config/setting_model.json`
- add `config/world_state_rules.json`
- add `scripts/build_world_state_snapshot.js`
- update run entrypoint to build this artifact before scene planning

Artifact shape:
- `timeContext`
- `environment`
- `characterState`
- `worldMemoryRefs`
- `continuityPressure`

Technical route:
- keep this builder deterministic and code-owned
- no LLM required for the first version
- derive state from `signals.json`, `continuity_snapshot.json`, and persona guidance

Product effect:
- weather becomes one dimension, not the whole idea
- later planners can reason over world availability, not only over prose

Validation:
- schema test for `world_state_snapshot.json`
- unit tests for rule mapping
- batch test to confirm multiple world states appear across different signals

### Phase 2: Affordance layer

Objective:
- turn state into plausible opportunities

Code changes:
- add `scripts/build_affordance_pool.js`
- add affordance definitions to `world_state_rules.json` or a dedicated `affordance_rules.json`

Examples:
- `indoor_reset_window`
- `brief_public_pause`
- `rediscovery_window`
- `micro_purchase_window`
- `transit_fragment_window`
- `return_or_repair_window`

Technical route:
- deterministic derivation from world state
- no direct prose generation yet
- candidates later must consume affordances rather than raw weather/trend only

Product effect:
- scenes become believable opportunities inside a day
- the world feels more lived-in and less template-driven

Validation:
- coverage test for affordance activation
- batch stats on affordance diversity

### Phase 3: Scene program catalog

Objective:
- replace flat scene families with reusable narrative programs

Code changes:
- add `config/scene_program_catalog.json`
- add helper module such as `scripts/lib/scene_programs.js`

Technical route:
- scene programs are structured JSON definitions, not hand-written end scenes
- candidate planning fills slots rather than improvising from scratch every time

Product effect:
- diversity comes from composition, not from random synonyms
- new programs can be added without breaking old ones

Validation:
- schema for scene programs
- static validation for required fields and valid slot references

### Phase 4: Multi-candidate planning

Objective:
- make planning search-based rather than one-shot

Code changes:
- add `scripts/build_scene_plan_candidates.js`
- add `scripts/select_scene_plan_candidate.js`
- gradually demote `build_scene_plan_draft.js` from primary planner to candidate-polish helper or remove it later

Candidate structure should include:
- `sceneProgramId`
- `filledSlots`
- `locationArchetype`
- `weatherRole`
- `objectBindings`
- `actionSequence`
- `emotionalLanding`
- `presenceMode`
- `captionHooks`
- `imageHooks`
- `scores`

Technical route:
- code builds candidate skeletons from programs and affordances
- LLM can refine summaries, hooks, and micro-plot polish
- final selection remains code-owned

Product effect:
- higher novelty without losing persona consistency
- better resilience against local minima

Validation:
- candidate count checks
- reranking tests
- distribution tests on selected scene programs

### Phase 5: Deep continuity and novelty ledger

Objective:
- track the repetition users actually feel

Code changes:
- extend `build_continuity_snapshot.js`
- add `build_novelty_ledger.js`
- update `validate_creative_intelligence.js`

New tracked dimensions:
- `sceneProgramId`
- `locationArchetype`
- `actionKernel`
- `objectFamily`
- `weatherRole`
- `emotionalLanding`
- `presenceMode`
- `captionEndingFamily`

Technical route:
- combine exact overlap with light semantic similarity
- compute cooldown penalties and cluster dominance

Product effect:
- the system notices motif repetition before the output feels stale to users

Validation:
- unit tests for ledger scoring
- batch tests with entropy and cluster-share metrics

### Phase 6: Downstream semantic adoption

Objective:
- make caption and image stages consume typed scene semantics

Code changes:
- update `build_caption_brief_draft.js`
- update `build_caption_brief.js`
- update `build_image_brief.js`
- update `build_image_request.js`

Downstream should consume:
- `sceneProgramId`
- `locationArchetype`
- `objectBindings`
- `weatherRole`
- `actionKernel`
- `emotionalLanding`
- `presencePolicy`

Product effect:
- caption/image alignment becomes structural instead of accidental
- image variety improves because prompts are driven by semantic scene shape

Validation:
- new fixture tests for image request semantics
- caption brief tests for hook consistency

### Phase 7: Reflection and long-term world memory

Objective:
- let the system accumulate stable world texture across runs

Code changes:
- add `build_reflection_notes.js`
- feed reflection outputs into `world_state_snapshot`

Possible reflection outputs:
- recurring small-object preference
- familiar places becoming emotionally loaded
- unresolved micro-arcs
- location fatigue patterns

Technical route:
- run as a cheaper background layer after successful bundles
- do not let reflection directly override hard state

Product effect:
- the character starts to feel like she has habits and memory, not only mood changes

Validation:
- snapshot regression tests for reflection merge
- long-horizon batch inspection

## Architecture Changes to Existing Files

### `ARCHITECTURE.md`
- keep as the canonical ?current architecture? document
- add doc map, strengths, weaknesses, and next-step references

### `README.md`
- keep as operator entrypoint overview
- list active docs and current runtime layout only

### `build_scene_plan.js`
Future changes:
- stop deriving the entire scene mostly from `weatherSignal` and `trendSignal`
- consume `world_state_snapshot` and selected candidate instead
- remain the final lock-in step

### `build_scene_plan_draft.js`
Future changes:
- either convert into a candidate-polish helper
- or delete after `scene_plan_candidates` becomes stable

### `build_continuity_snapshot.js`
Future changes:
- keep current lane/opening/hashtag logic
- add deeper scene/object/action/emotion/weather-role ledgers

### `build_image_brief.js` and `build_image_request.js`
Future changes:
- shift from prose-first to semantics-first consumption
- keep prose notes only as a supplemental layer

## Product Metrics

Each major phase should be evaluated with batch runs.

### Diversity metrics
- `sceneProgramEntropy`
- `locationArchetypeEntropy`
- `actionKernelEntropy`
- `objectFamilyEntropy`
- `emotionalLandingEntropy`
- `topClusterShare`
- `medianPairwiseSemanticSimilarity`

### Dominance metrics
- `weatherAsPrimaryDriverRatio`
- `indoorDominanceRatio`
- `studyAftermathDominanceRatio`
- `rediscoveryOveruseRatio`

### Product metrics
- caption/image semantic alignment pass rate
- persona-fit review pass rate
- creative validation pass rate
- dry-run-ready rate

## Testing Strategy

### Per-phase tests
- unit tests for new builders and mapping helpers
- artifact schema tests
- regression tests for old contracts still consumed by downstream layers

### Batch tests
After each major planning change:
- `10` pre-image runs for quick review
- `50` pre-image runs for distribution checks
- `100` pre-image runs before declaring the basin problem materially improved
- `1` full `simulate` to ensure the product path still reaches `dry_run_ready`

## Rollout Strategy

### Step 1
Introduce new artifacts in parallel while keeping existing `scene_plan.json` contract stable.

### Step 2
Switch scene planning to consume new artifacts behind feature flags or config toggles.

### Step 3
After the candidate planner is stable, demote or remove one-shot draft logic.

### Step 4
After downstream semantics are stable, raise validation requirements and update PM-facing reports.

## Code Cleanup Policy During the Rebuild

Safe to remove when all references are gone:
- old manual adapters outside the production path
- helper libraries referenced only by removed adapters
- doc sections that describe removed execution paths

Not safe to remove until replacement ships:
- current `scene_plan.json` contract
- current publish bridge
- current host image bridge
- current run bundle writer

## Immediate Next Coding Tasks

1. Add `config/setting_model.json`
2. Add `config/world_state_rules.json`
3. Implement `scripts/build_world_state_snapshot.js`
4. Wire it into `F:\openclaw-dev\ig-roleplay-v2-run.ps1`
5. Add schema + tests for `world_state_snapshot`
6. Extend `build_continuity_snapshot.js` with new semantic fields behind safe defaults
7. Add `config/scene_program_catalog.json`
8. Implement `build_scene_plan_candidates.js`
9. Implement `select_scene_plan_candidate.js`
10. Update `build_scene_plan.js` to lock the selected candidate into the legacy-compatible contract

## Expected Product Win After Phase 4

By the time typed world state, affordances, scene programs, and candidate reranking are all live, the system should:
- stop feeling like it only knows one small rainy room
- produce variation through believable situation changes
- preserve persona coherence without relying on repeated wording patterns
- be much easier to expose in a future tuning GUI
