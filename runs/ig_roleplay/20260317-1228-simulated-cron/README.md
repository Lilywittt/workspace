# Simulated Cron Run

This folder is a snapshot of one simulated scheduled run executed on 2026-03-17.

Inspection order:

1. `signals.json`
   Shows the raw daily inputs used for generation: weather, news, and trends.

2. `selected_image.json`
   Shows which image asset the pipeline selected for this run.

3. `draft_caption.txt`
   Shows the generated Instagram caption draft for this run.

4. `latest_post_record.jsonl`
   Shows the latest dry-run publish record written by `publish_instagram.js`.

Notes:

- This was a `dry_run`, so no real Instagram post was published.
- The image id selected for this run is `selfie_001`.
- Real publishing still requires valid `IG_USER_ID`, `IG_ACCESS_TOKEN`, and a public image URL.
