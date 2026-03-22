# World State / Scene Program Redesign

Execution plan:

- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\DEVELOPMENT_PLAN_WORLD_STATE_REBUILD.md`

## Design Goal

Replace the current flat `sceneFocus + sceneNotes + one-shot scene_plan_draft` approach with a layered planning architecture that can scale without collapsing into a tiny motif basin.

## Why Redesign

Current pipeline weakness:
- world inputs are too thin
- continuity only tracks surface repetition
- scene planning uses one-shot generation
- scene families are closer to flat tags than executable narrative structures

Target behavior:
- diversity comes from structured state and compositional planning
- persona consistency comes from typed constraints
- freshness comes from candidate search + reranking
- image/caption stages consume semantic scene structure, not only prose notes

## New Layered Model

### 1. Stable Setting Layer

File:
- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\config\setting_model.json`

Purpose:
- stores slow-changing world facts
- city, recurring places, school rhythm, recurring objects, social relations

Example domains:
- `placeArchetypes`
- `routineAnchors`
- `ownedObjectPools`
- `seasonalAffordances`
- `mobilityDefaults`

### 2. World State Layer

Artifact:
- `runtime/current/world_state_snapshot.json`

Build from:
- external signals
- continuity snapshot
- setting model
- persona guidance
- long-term reflections

Structure:
```json
{
  "timeContext": {
    "daypart": "late_afternoon",
    "weekdayMode": "school_day",
    "seasonPhase": "early_spring"
  },
  "environment": {
    "weather": "light_rain",
    "temperatureBand": "cool",
    "mobilityWindow": "short_walk_ok"
  },
  "characterState": {
    "energy": "medium_low",
    "socialBandwidth": "solo_preferred",
    "attentionShape": "detail_seeking",
    "needState": ["closure", "small_reset"]
  },
  "worldMemoryRefs": {
    "recurringObjects": ["hairclip", "paper_fragments", "bookmarks"],
    "familiarPlaces": ["bookstore", "stairwell", "station_edge"]
  },
  "continuityPressure": {
    "lanePressure": "life_record_preferred",
    "sceneFatigue": ["desk_reset", "study_aftermath"],
    "weatherOveruse": true
  }
}
```

### 3. Affordance Layer

Artifact:
- `runtime/current/affordance_pool.json`

Purpose:
- convert state into plausible opportunities

Examples:
- `indoor_reset_window`
- `brief_public_pause`
- `transit_fragment`
- `shelter_from_rain`
- `small_repair_window`
- `rediscovery_window`
- `micro_purchase_window`

This layer is important because it prevents raw weather from becoming the whole scene.

### 4. Scene Program Layer

Config:
- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2\config\scene_program_catalog.json`

A scene program is not a final scene name. It is a narrative program with:
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

Example:
```json
{
  "id": "rediscovery_program",
  "laneEligibility": ["life_record"],
  "requiredAffordances": ["rediscovery_window"],
  "slotSchema": {
    "object": "owned_small_object | paper_fragment | forgotten_keepsake",
    "location": "indoor_pause | sheltered_public_pause",
    "weatherRole": "modifier_only | reflective_support"
  },
  "actionKernel": "find_unfold_notice_again",
  "emotionalLandingFamilies": ["memory_return", "quiet_completion"],
  "presencePolicies": ["partial_presence", "wide_scene_with_character_trace"]
}
```

## Candidate Planning

### 5. Scene Plan Candidates

Artifact:
- `runtime/current/scene_plan_candidates.json`

Generate 3-5 candidates per run.

Each candidate should include:
```json
{
  "candidateId": "scene_cand_01",
  "sceneProgramId": "rediscovery_program",
  "filledSlots": {
    "object": "dried_petal",
    "location": "room_corner",
    "weatherRole": "reflective_support"
  },
  "actionSequence": [
    "finish clearing notes",
    "notice petal between pages",
    "pause and attach a private meaning"
  ],
  "emotionalLanding": "quiet_completion",
  "presenceMode": "wide_scene_with_character_trace",
  "scores": {
    "novelty": 0.82,
    "feasibility": 0.91,
    "personaFit": 0.87
  }
}
```

## Selection

### 6. Candidate Reranking

Selection should be code-owned.

Inputs:
- world state
- novelty ledger
- continuity pressure
- candidate scores
- skill review summary

Scoring dimensions:
- exact repetition penalty
- semantic similarity penalty
- persona fit
- lane fit
- image feasibility
- caption affordance quality
- weather dominance penalty

## Long-Term Memory Split

### 7. Hot Path vs Cold Path

Hot path artifacts:
- `world_state_snapshot.json`
- `affordance_pool.json`
- `scene_plan_candidates.json`
- `scene_plan.json`

Cold path artifacts:
- `novelty_ledger.json`
- `reflection_notes.json`
- `setting_model.json`

Principle:
- hot path should stay deterministic and cheap
- reflection can run in background and feed future runs

## Continuity Upgrade

### 8. New Ledger Dimensions

Upgrade continuity tracking from:
- lane
- opening
- hashtags

to also include:
- `sceneProgramId`
- `locationArchetype`
- `actionKernel`
- `objectFamily`
- `weatherRole`
- `emotionalLanding`
- `presenceMode`
- `captionEndingFamily`

## Image/Caption Consumption

### 9. Downstream Contract

`scene_plan.json` should expose semantic fields, not only prose:
```json
{
  "sceneSemantics": {
    "sceneProgramId": "rediscovery_program",
    "locationArchetype": "indoor_pause",
    "objectBindings": ["dried_petal", "planner_page"],
    "weatherRole": "reflective_support",
    "actionKernel": "find_unfold_notice_again",
    "emotionalLanding": "quiet_completion",
    "presencePolicy": "wide_scene_with_character_trace"
  }
}
```

Then:
- caption brief uses semantic hooks
- image brief uses location/object/presence/weather policy directly
- image request maps these to provider-ready prompt blocks

## Implementation Phases

### Phase 1
- add `setting_model.json`
- add `build_world_state_snapshot.js`
- keep old `scene_plan.json` contract stable

### Phase 2
- add `scene_program_catalog.json`
- add `build_affordance_pool.js`
- add `build_scene_plan_candidates.js`
- add `select_scene_plan_candidate.js`

### Phase 3
- add `novelty_ledger.json`
- add semantic similarity scoring
- update continuity reports

### Phase 4
- change image/caption builders to consume `sceneSemantics`
- add distribution metrics to creative validation

## Success Metrics

The redesign is successful when:
- 50/100 run batches no longer collapse into one dominant basin
- weather becomes a modifier more often than a primary scene driver
- repeated object/action/location clusters are automatically cooled down
- scene variation grows without breaking persona coherence
- image requests differ at the semantic layer, not only wording
