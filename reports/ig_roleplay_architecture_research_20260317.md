# Instagram Roleplay Agent Architecture Research (2026-03-17)

## Purpose

This research supports one concrete engineering goal:

- redesign the current Instagram roleplay automation into a durable character runtime,
- not just a one-shot prompt chain.

The target product is a daily roleplay account that should feel like the same anime-style character living day after day, with:

- stable persona,
- stable visual identity,
- controlled emotional variation,
- image + caption coherence,
- scheduled execution,
- archived run artifacts,
- reviewable publishing flow.

## Research Scope

### Open-source systems studied in depth

1. `AIRI`
   - local clone: `F:\openclaw-dev\workspace\research\airi`
   - key files:
     - `F:\openclaw-dev\workspace\research\airi\packages\server-runtime\src\index.ts`
     - `F:\openclaw-dev\workspace\research\airi\apps\server\src\schemas\characters.ts`
     - `F:\openclaw-dev\workspace\research\airi\services\telegram-bot\src\db\schema.ts`
     - `F:\openclaw-dev\workspace\research\airi\services\telegram-bot\src\llm\actions.ts`
     - `F:\openclaw-dev\workspace\research\airi\services\telegram-bot\src\prompts\personality-v1.velin.md`
     - `F:\openclaw-dev\workspace\research\airi\services\telegram-bot\src\prompts\system-ticking-v1.velin.md`
     - `F:\openclaw-dev\workspace\research\airi\services\twitter-services\docs\architecture-20250304.md`
     - `F:\openclaw-dev\workspace\research\airi\services\twitter-services\src\adapters\airi-adapter.ts`
     - `F:\openclaw-dev\workspace\research\airi\services\twitter-services\src\adapters\mcp-adapter.ts`

2. `SillyTavern`
   - local clone: `F:\openclaw-dev\workspace\research\SillyTavern`
   - key files:
     - `F:\openclaw-dev\workspace\research\SillyTavern\default\content\settings.json`
     - `F:\openclaw-dev\workspace\research\SillyTavern\public\scripts\world-info.js`
     - `F:\openclaw-dev\workspace\research\SillyTavern\public\scripts\PromptManager.js`
     - `F:\openclaw-dev\workspace\research\SillyTavern\public\scripts\extensions\expressions\index.js`

3. `elizaOS`
   - local clone: `F:\openclaw-dev\workspace\research\eliza`
   - key files:
     - `F:\openclaw-dev\workspace\research\eliza\packages\docs\agents\character-interface.mdx`
     - `F:\openclaw-dev\workspace\research\eliza\packages\docs\agents\memory-and-state.mdx`
     - `F:\openclaw-dev\workspace\research\eliza\packages\docs\agents\runtime-and-lifecycle.mdx`
     - `F:\openclaw-dev\workspace\research\eliza\packages\docs\agents\personality-and-behavior.mdx`
     - `F:\openclaw-dev\workspace\research\eliza\packages\app-core\src\actions\character.ts`
     - `F:\openclaw-dev\workspace\research\eliza\packages\app-core\src\actions\triggers.ts`
     - `F:\openclaw-dev\workspace\research\eliza\packages\app-core\src\autonomy\index.ts`

### Public market references

Closed-source products cannot be treated as code-confirmed architecture. They are only used as product-surface signals.

- [AIRI](https://github.com/moeru-ai/airi)
- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- [elizaOS](https://github.com/elizaOS/eliza)
- [Inworld](https://inworld.ai/)
- [Kindroid](https://kindroid.ai/)
- [Replika](https://replika.com/)

## Findings

## 1. AIRI: character runtime and channel services are intentionally separated

### 1.1 Character is an asset graph, not a single prompt blob

`characters.ts` separates:

- `characters`
- `character_covers`
- `avatar_model`
- `character_capabilities`
- `character_i18n`
- `character_prompts`

Implication for this project:

- `persona.md` cannot remain the only source of truth
- we need separate assets for identity, voice, visual anchors, and capabilities

### 1.2 Runtime is a module bus, not direct UI-to-tool wiring

`server-runtime/src/index.ts` implements:

- peer registration,
- authentication,
- heartbeat,
- routing,
- health broadcast,
- module registry sync.

Implication:

- caption generation, image generation, scheduling, and Instagram publishing should not stay fused in one direct chain
- even without adopting AIRI's exact event bus, this project should adopt explicit stage boundaries and data contracts

### 1.3 AIRI uses a ticking loop, not only reactive chat

`system-ticking-v1.velin.md` and `actions.ts` show:

- the runtime periodically composes context,
- asks the model to choose an action,
- executes the chosen action,
- feeds the result back,
- and repeats on the next tick.

Implication:

- the daily Instagram run should not jump straight from "time reached" to "publish"
- it should first enter a planning phase that decides lane, mood, micro-plot, and continuity constraints

This directly motivates a dedicated `scene planner` layer.

### 1.4 Memory is stratified

`schema.ts` includes:

- `memory_fragments`
- `memory_tags`
- `memory_episodic`
- `memory_long_term_goals`
- `memory_short_term_ideas`

Implication:

- "last 7 posts" is not enough memory
- this project needs at least:
  - posting history,
  - continuity memory,
  - repeated phrase guard,
  - visual continuity notes,
  - reusable life motifs

### 1.5 Social platform automation is an adapter layer

The Twitter service in AIRI is split into:

- adapter layer,
- core services layer,
- browser adapter layer.

Implication:

- Instagram publishing must be a platform adapter, not part of the roleplay brain
- future multi-platform expansion should reuse content planning and generation layers

## 2. SillyTavern: context is layered composition

SillyTavern is not a full autonomous runtime like AIRI, but it is very important for roleplay architecture.

### 2.1 Lore, world state, and prompt pieces are layered

From `world-info.js` and `PromptManager.js`, the key pattern is:

- character card,
- lorebook/world info,
- injection depth,
- budget,
- activation logic,
- prompt pieces with explicit positions.

Implication:

- this project should not keep all control inside one generation prompt
- we need separate layers for:
  - character identity,
  - daily signals,
  - continuity state,
  - platform style rules,
  - current generation task

### 2.2 Expression is a dedicated subsystem

`extensions/expressions/index.js` shows:

- emotion classification,
- expression asset selection,
- and expression-to-visual mapping as a separate concern.

Implication:

- selfie generation needs emotion state as structured input
- caption emotion and image expression must come from the same upstream plan

## 3. elizaOS: character and agent runtime must be different things

### 3.1 Character is a blueprint, agent is a live instance

`character-interface.mdx` and `runtime-and-lifecycle.mdx` clearly distinguish:

- `Character` = configuration blueprint
- `Agent` = live runtime instance

Implication:

- current V1 mixes long-term persona and per-run state
- V2 must separate:
  - character asset graph,
  - daily run instance

### 3.2 State composition is a runtime responsibility

`memory-and-state.mdx` describes:

- memory creation,
- retrieval,
- pruning,
- hybrid context composition,
- runtime-managed state assembly.

Implication:

- each script should not independently read ad hoc files
- the project needs a dedicated context compilation stage

### 3.3 Trigger and autonomy are first-class features

`triggers.ts` and `autonomy/index.ts` emphasize:

- scheduled runs,
- run status,
- replay/health,
- event ordering,
- gap detection.

Implication:

- `posted.jsonl` alone is not enough operational history
- every run should produce a formal artifact bundle

## 4. Closed-source product signals

### Inworld

Public materials emphasize:

- characters,
- goals,
- relationships,
- scenes/workflows.

Implication:

- companion/social agents need more than persona text
- they also need stateful goals and relationship-aware behavior

### Kindroid and Replika

Their product surfaces emphasize:

- persistent companionship,
- continuity of identity,
- memory and relationship growth,
- strong image/avatar experience.

Implication:

- product quality depends less on single-turn eloquence
- and more on whether the character still feels like the same person over time

This strongly supports a dedicated visual identity subsystem.

## Diagnosis of the current V1 pipeline

Current V1 files:

- `F:\openclaw-dev\workspace\skills\ig-roleplay-daily\SKILL.md`
- `F:\openclaw-dev\workspace\skills\ig-roleplay-daily\scripts\update_signals.js`
- `F:\openclaw-dev\workspace\skills\ig-roleplay-daily\scripts\select_image.js`
- `F:\openclaw-dev\workspace\skills\ig-roleplay-daily\scripts\publish_instagram.js`
- `F:\openclaw-dev\workspace\data\ig_roleplay\persona.md`
- `F:\openclaw-dev\workspace\data\ig_roleplay\image_catalog.json`

The main limitations are:

1. no scene planning layer
2. no visual identity asset layer
3. no memory stratification
4. no formal `post package`
5. no lane split between selfie and life record

## Architecture conclusions for this project

V2 should contain:

1. `Character Core`
2. `Signals Layer`
3. `Continuity Layer`
4. `Planning Layer`
5. `Generation Layer`
6. `Release Layer`
7. `Publishing Adapter`
8. `Run Ledger`

## Core design decision

The key architectural move is this:

- do not go directly from signals to final post,
- first compile a `scene_plan.json`,
- then let caption generation and image generation both consume that shared plan.

## Practical result

The V2 workspace has already been created at:

- `F:\openclaw-dev\workspace\projects\ig_roleplay_v2`

The first real implementation step is now:

- structured character assets,
- schema contracts,
- and a runnable `scene planner`.
