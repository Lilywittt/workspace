# Memory System Architecture

## Why This Needs Its Own Design

For this product, memory is not a feature garnish.
It is the layer that determines whether the character feels:

- lived-in,
- continuous,
- emotionally cumulative,
- or polluted and repetitive.

So the memory system cannot be "just add a memory entrypoint."

It needs a real architecture for:

- where memories come from,
- which memories are canonical,
- how tests and dry-runs are isolated,
- how memory ages and compacts,
- how memory retrieval influences content without over-dominating it.

## Honest Status

The previous redesign already established that the new runtime needs:

- episodic memory,
- posted moments,
- open threads,
- retrieval context.

But that was still one layer too high-level.

This document fills in the actual system architecture.

## Product Framing

From a product perspective, memory has two jobs:

1. make the character feel like the same person over time,
2. avoid trapping the character in a self-reinforcing content basin.

That second part matters just as much as the first.

If memory is unmanaged, the system will gradually:

- overfit to what it has already posted,
- over-weight repeated motifs,
- treat test runs as canon,
- become too conservative,
- or become weirdly self-referential.

So the memory system must be designed to preserve continuity without poisoning novelty.

## Current State In This Project

Right now, the project does not yet have true long-term memory.

What it has is closer to a semantic continuity tracker:

- `history_semantics.js` reconstructs semantic tags from past run bundles and runtime artifacts,
- `build_novelty_ledger.js` aggregates recent semantic counts,
- `build_reflection_notes.js` turns those counts into soft guidance,
- several planners use those counts to suppress repetition.

This is useful, but it is not enough.

Current limitations:

- memory is mostly "what labels have appeared recently,"
- not "what happened, why it mattered, and what remains unresolved,"
- test and dry-run memory isolation is not formally designed,
- long-run compaction and decay are not formally designed,
- imported legacy history is still mixed into production continuity.

## Design Principles

1. Memory must be namespaced by environment and profile.
2. Canonical memory must be harder to write than derived memory.
3. Retrieval must be selective, not "dump everything relevant into the prompt."
4. Older memory must compress over time instead of accumulating equal weight forever.
5. Test memory must be physically separated from production memory.
6. Dry-run memory must not silently contaminate production canon.
7. Derived summaries and embeddings are indexes, not the source of truth.

## Memory Model

### Memory classes

The system should distinguish five kinds of memory.

#### 1. World facts

These are not memories.
They are stable truths:

- places,
- schedules,
- owned objects,
- identity anchors,
- visual anchors.

They live in config and character data, not in memory logs.

#### 2. Episodic memory

These are internal lived events that the system considers part of the character's continuity.

Examples:

- she found an old paper fragment after class,
- she had a small private reset while waiting indoors,
- a recurring object gained new meaning.

This is the main long-term continuity substrate.

#### 3. Posted canon

This is the subset of episodic memory that actually became public content.

This matters because:

- what the audience has seen is stronger canon than what only the system inferred privately,
- caption/image/post history must be easy to retrieve separately from all internal episodes.

#### 4. Open threads

These are unresolved emotional or narrative continuities.

Examples:

- an object that keeps returning,
- a place that still carries unfinished mood,
- a shy attachment that has not resolved,
- a private sign that has not yet paid off.

Open threads are the main way the character feels cumulative instead of random.

#### 5. Derived memory indexes

These are retrieval helpers, not canonical truth.

Examples:

- semantic fingerprints,
- embeddings,
- motif counts,
- arc summaries,
- cluster dominance reports.

These can be rebuilt and should never be the only surviving source of truth.

## Memory Storage Layout

Recommended target layout:

```text
runtime/
  memory/
    profiles/
      tsukimi_rion/
        prod/
          canonical/
            episodic_events.jsonl
            posted_moments.jsonl
            open_threads.json
            thread_links.jsonl
          derived/
            semantic_index.jsonl
            arc_summaries.jsonl
            retrieval_cache/
            novelty_counters.json
          control/
            memory_manifest.json
            compaction_log.jsonl
            quarantine.jsonl
        shadow/
          ...
        sandbox/
          ...
        test/
          ...
```

### Why this structure

- `profiles/<character_id>/` keeps character memories physically separate.
- `prod/shadow/sandbox/test` prevents accidental cross-contamination.
- `canonical/` keeps only source-of-truth memory.
- `derived/` holds rebuildable indexes.
- `control/` stores audit metadata and quarantine records.

## Namespaces And Isolation

This is the most important anti-pollution feature.

### `prod`

Real product memory.

Use when:

- content is actually published,
- or an operator explicitly promotes an approved run into canon.

### `shadow`

Read from production, write to isolated shadow memory.

Use when:

- evaluating content quality,
- running dry-runs against realistic history,
- comparing alternative planners without polluting canon.

This should be the default for operator simulation.

### `sandbox`

Fully isolated memory for ad hoc experimentation.

Use when:

- exploring new prompts,
- experimenting with new models,
- testing new planner logic by hand.

### `test`

Strictly isolated automated-test memory.

Use when:

- unit tests,
- integration tests,
- CI.

This namespace must never read or write production memory.

## Write Rules

### Product-safe default

The system must not write to `prod` just because a run succeeded technically.

Production memory promotion should be explicit.

### Recommended policy by run mode

#### `publish`

- read from `prod`
- write to `prod`

This is the only mode that should update canonical posted memory by default.

#### `simulate`

- read from `prod`
- write to `shadow`

This lets us evaluate realistic outputs without contaminating production continuity.

#### `sandbox`

- read from `sandbox`
- write to `sandbox`

#### `test`

- read from `test` fixtures only
- write to ephemeral `test`
- auto-clean after run

### Promotion rule

Only these should enter `prod/canonical/posted_moments.jsonl` automatically:

- published posts,
- or explicitly operator-approved publish-ready runs.

Only these should enter `prod/canonical/episodic_events.jsonl` automatically:

- moments that became posted canon,
- or moments manually promoted by an operator.

Important simplification for early versions:

- unpublished private-life events should not enter production canon by default.

This avoids the worst contamination risk while the memory system is still young.

## Memory Sources

### Source 1: Legacy import

We do need an initial memory base, but it must not be treated as perfectly trustworthy.

Legacy source:

- old `posted.jsonl`

Import policy:

- one-time importer writes these entries as `source=legacy_import`,
- confidence is lower than native V2 memory,
- imported entries are canonical only as posted history, not as rich internal episodes,
- importer also derives initial thread candidates and semantic summaries,
- raw legacy import remains auditable and re-runnable.

### Source 2: Published runs

These are the primary future source of canon.

For each approved run, write:

- the selected moment,
- the published caption,
- the generated image binding,
- the resolved or newly opened threads,
- retrieval metadata about why the moment was selected.

### Source 3: Operator-approved promotions

Sometimes a dry-run may be reviewed and accepted as canon.

In that case:

- promote from `shadow` to `prod`,
- preserve provenance,
- keep a link to the original run id.

### Source 4: Derived compaction jobs

These do not create new canon.

They create:

- summaries,
- indexes,
- retrieval caches,
- arc compressions.

## Canonical Memory Schemas

### `episodic_events.jsonl`

Each row should represent one grounded lived event.

Suggested fields:

```json
{
  "eventId": "evt_2026_03_21_001",
  "profileId": "tsukimi_rion",
  "namespace": "prod",
  "source": "published_run",
  "runId": "pipeline-2026-03-21T09-30-00-publish",
  "createdAt": "2026-03-21T09:30:00Z",
  "confidence": 0.94,
  "isPostedCanon": true,
  "dayContext": {
    "date": "2026-03-21",
    "daypart": "after_class",
    "weather": "light_rain"
  },
  "livedEvent": {
    "summary": "...",
    "causalChain": ["...", "...", "..."]
  },
  "worldRefs": {
    "placeRefs": ["school_building", "stairwell_near_library"],
    "objectRefs": ["planner", "paper_fragment"],
    "routineRefs": ["after_class_transition"]
  },
  "interiorShift": {
    "before": "...",
    "after": "...",
    "unspokenMeaning": "..."
  },
  "threadEffects": {
    "opened": ["thread_ink_stain_note"],
    "continued": [],
    "resolved": []
  }
}
```

### `posted_moments.jsonl`

This is the public-facing canon subset.

It should store:

- caption,
- image reference,
- publish timestamp,
- event linkage,
- audience-facing summary.

### `open_threads.json`

This is a live state file, not a raw append-only ledger.

Each thread should track:

- label,
- emotional weight,
- last activated timestamp,
- origin event,
- continuity role,
- current state: `open`, `cooling`, `resolved`, `suppressed`.

## Retrieval Architecture

The retrieval system must be designed to help generation without overwhelming it.

### Retrieval should not work like this

- "take the last 20 memories and dump them into prompt context"

That creates exactly the pollution problem you called out.

### Retrieval should work like this

It should return a small, balanced memory context with multiple buckets.

#### Bucket A: active thread memories

At most 2-3 entries.

Purpose:

- preserve continuity of unresolved meaning.

#### Bucket B: recent canon

At most 2 entries.

Purpose:

- avoid accidentally duplicating very recent published moments.

#### Bucket C: deep anchors

At most 2 entries.

Purpose:

- remind the system of long-lived character themes without forcing repetition.

#### Bucket D: contrast set

At most 1-2 entries.

Purpose:

- explicitly remind the generator what to avoid repeating,
- or surface a nearby-but-different path away from the current basin.

### Retrieval ranking factors

The retriever should combine:

- thread relevance,
- world overlap,
- object overlap,
- emotional similarity,
- continuity relevance,
- recency,
- novelty suppression,
- age decay.

### Retrieval output shape

Suggested artifact:

- `retrieved_memory_context.json`

Suggested sections:

- `activeThreads`
- `recentCanon`
- `deepAnchors`
- `contrastMemories`
- `memoryWarnings`

This keeps memory influence structured and limited.

## Decay, Compaction, And Long-Run Stability

This is where we prevent memory buildup from slowly damaging the product.

### Age decay

Older memories should not keep equal influence forever.

Recommended weighting:

- 0-14 days: high recall weight
- 15-45 days: medium recall weight
- 46-120 days: low recall weight unless linked to active threads
- 120+ days: summary-first retrieval only

### Compaction

Older raw episodes should be periodically compressed into arc summaries.

Recommended compaction windows:

- weekly summaries for recent periods,
- monthly arc summaries for older periods,
- pin important unresolved threads so they stay individually retrievable.

### Arc summaries

Arc summaries should say things like:

- "the character has recently treated ordinary paper fragments as private signs,"
- "the station/stairwell transition motif has become too dominant,"
- "a quiet closure pattern has repeated too often."

These summaries help the planner reason at a higher level without carrying every raw episode forever.

### Dominance detection

The system should continuously measure whether memory is over-shaping content.

Signals:

- one object family dominates retrieval,
- one place cluster dominates posted canon,
- one emotional landing recurs too often,
- one thread never cools down,
- retrieval repeatedly returns near-identical contexts.

When dominance is high, the runtime should:

- down-weight the dominant cluster,
- increase contrast retrieval,
- optionally trigger a "memory light" mode for one run.

## Contamination Controls

### Test contamination

This must be solved structurally, not socially.

Controls:

- tests always run in `test` namespace,
- test memory path must be passed explicitly,
- CI fails if a test points to `prod`,
- test runs are auto-pruned after completion,
- fixtures are copied into temp directories, not mutated in place.

### Dry-run contamination

Controls:

- default simulate writes only to `shadow`,
- promotion to `prod` must be explicit,
- shadow memory is easy to clear or rotate,
- `prod` retrieval can be read safely without `prod` writes.

### Low-confidence contamination

Controls:

- imported legacy entries carry lower confidence,
- failed or partial runs do not become canonical,
- uncertain operator-imported entries go to `quarantine.jsonl`,
- retrieval excludes quarantine by default.

## Content-Safety Against Memory Pollution

This is the part most directly tied to product quality.

### The system must avoid these failure modes

#### Failure mode 1: memory becomes a repetition amplifier

Example:

- the character once posted a paper fragment moment,
- the system keeps recalling it because it was emotionally strong,
- eventually many days start orbiting that motif.

Fix:

- novelty suppression,
- contrast retrieval,
- retrieval caps per motif,
- dominance-based down-weighting.

#### Failure mode 2: memory becomes too conservative

Example:

- the system sees many past motifs,
- becomes afraid to resemble anything,
- outputs flat and generic content.

Fix:

- retrieve fewer but higher-signal memories,
- optimize for thread continuity, not maximal difference on every dimension,
- keep "new grounded event" generation prior to memory matching.

#### Failure mode 3: test runs become false canon

Fix:

- namespaces,
- no default write to `prod`,
- promotion gates.

#### Failure mode 4: old memory crowds out current reality

Fix:

- day context and grounded world context remain primary,
- retrieval is supportive rather than dominant,
- strong age decay unless thread-linked.

## Operational Controls

The operator should be able to manage memory intentionally.

Recommended controls:

- `memoryMode`: `prod | shadow | sandbox | test`
- `promotionMode`: `none | manual | publish_only`
- `memoryRecallBudget`: small / medium / large
- `clearShadowMemory`
- `rebuildDerivedIndexes`
- `quarantineLegacyImport`
- `pinThread`
- `resolveThread`

These are product tools, not only engineering tools.

## Metrics We Should Track

To know whether memory is helping or hurting, we should track:

- retrieval source breakdown per run,
- thread reuse rate,
- motif dominance rate,
- percent of runs with contrast retrieval activated,
- average memory age of retrieved context,
- number of prod writes vs shadow writes,
- dry-run to publish divergence,
- repeated-event complaint rate in evaluation.

## Implementation Plan

### Phase 1: Namespace-safe storage

Build:

- `runtime/memory/profiles/<profile>/<namespace>/`
- explicit memory mode in runtime config and CLI
- test isolation rules

### Phase 2: Canonical schemas and write pipeline

Build:

- canonical event and posted-moment writers
- thread state management
- promotion rules

### Phase 3: Retrieval pipeline

Build:

- `retrieved_memory_context.json`
- bucketed retrieval
- hard caps and contrast retrieval

### Phase 4: Derived indexes and compaction

Build:

- semantic index
- arc summaries
- compaction jobs
- dominance monitoring

### Phase 5: Product controls

Build:

- memory mode switching,
- shadow reset,
- manual promotion,
- thread management UI or CLI.

## Bottom Line

Yes, memory is a big engineering problem.

So the answer is:

- no, it should not stay as a vague entrypoint,
- yes, it needs its own subsystem,
- and the subsystem must be designed primarily around contamination control and long-run content quality.

For this product, good memory is not "more memory."

It is:

- the right memory,
- in the right namespace,
- retrieved in the right amount,
- with enough decay and compaction that it supports continuity without taking the whole product hostage.
