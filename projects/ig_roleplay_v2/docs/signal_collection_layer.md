# Signal Collection Layer

## Product Intent

The job of signal collection is not to hand downstream agents a topic menu.
Its job is to widen the character's starting state with small pieces of reality
that can become attention residue, ambient pressure, or passing curiosity.

In product terms, this layer should answer three questions every day:

1. What changed in the outside world today?
2. Which changes would this character plausibly brush against?
3. Which of those touches should survive only as weak texture rather than a literal post topic?

That is why the pipeline is split into:

`source collection -> normalized signals -> exposure -> attention bias -> moment`

instead of:

`headline -> caption`

## Architecture Principles

### 1. API first, page scrape second, manual seed last

Prefer structured APIs for signals that describe real world state:

- weather / air quality
- transit or service alerts
- event feeds
- release schedules

Use list-page extraction only for sources that are stable editorial surfaces, such
as a city events index. If a source needs brittle DOM scraping or login cookies,
it should live in an optional edge collector, not in the core pipeline.

### 2. Separate hard world-state from soft ambient signals

Hard signals describe factual conditions that can alter plausibility:

- weather
- air quality
- timed local events
- venue openings or temporary installations

Soft signals do not change the world graph directly. They only bias what the
character might notice:

- city headlines
- pop culture trend lists
- social chatter summaries
- seasonal marketing surfaces

### 3. Track source health as a product surface

If only weather is healthy today, the product should know that before the run.
The collector now writes both:

- `signals.json`
- `signal_collection_report.json`

The report exists so product can inspect whether today's run had real category
coverage or whether it was effectively weather-only again.

## What To Collect

### Core sources to keep always-on

- Open-Meteo current weather and air quality
  - Use for physical texture: humidity, rain, cloud cover, AQI, wind.
  - This should remain the most reliable source, but not the only one.
- City-facing headlines
  - Use as weak "what is in the air" context.
  - Current implementation uses GDELT because it is simple and keyless.
- Local events index
  - Use for temporary spatial texture: exhibition months, festival weeks, pop-up activity.
  - Current implementation extracts from the Shanghai official events calendar list page.
- Pop culture trend surface
  - Use for reposted trailers, seasonal anime, title fragments, packaging/color echoes.
  - Current implementation uses AniList trending anime.

### Next sources worth adding

- Campus or district activity calendars
  - Better than generic city news for changing the character's reachable world.
- Transit disruption / service alert feeds
  - Strong effect on route choice, crowd density, waiting, signage, and timing.
- Social chatter proxy feeds
  - Prefer summarized or editorial trend surfaces over direct social scraping.
  - The goal is "phrases in circulation", not raw discourse ingestion.
- Retail / exhibition / mall event calendars near the character's normal route
  - These are especially useful because they alter what she can plausibly pass by.

## How To Collect

### Scheduler

- Refresh at least every 3-6 hours for weather and AQI.
- Refresh every 6-12 hours for headlines, events, and pop culture.
- Keep the last healthy artifact if a source fails, but mark the source as degraded.

### Normalization contract

Each collected entry should be converted into a small neutral record:

```json
{
  "signalId": "event_01",
  "category": "localEvents",
  "text": "Sporting events, performances and exhibitions in March.",
  "freshness": "recent",
  "directiveness": "low",
  "sourceType": "signals"
}
```

This keeps collection separate from interpretation.

### Dedupe and anti-collapse

- Dedupe by title/text/url fingerprint, not only source id.
- Cap each category so one noisy source cannot dominate the packet.
- Keep source-level status so product can detect when diversity is fake.
- Let the resonance layer decide salience later; collection should stay broad.

## Current Status In This Repo

The project now has a local collector in:

- `scripts/refresh_signals.js`
- `src/agent/signal_collection.js`
- `config/runtime/signal_collection.config.json`

It currently refreshes four live connectors:

- Open-Meteo weather
- Open-Meteo air quality
- GDELT city headlines
- Shanghai Events Calendar list page
- AniList trending anime

This is enough to move the system away from pure weather collapse, but it is not
yet enough to fully solve same-cluster repetition. The next real leap will come
from route-near local calendars and better social chatter proxies.
