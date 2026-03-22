# Character Editable Surface

Operators should edit the character here.

Files:

- `core.identity.json`
  - stable identity and temperament
- `voice.style.json`
  - writing voice and emotional expression rules
- `visual.identity.json`
  - stable visual anchors and allowed variations
- `posting.behavior.json`
  - what kinds of moments she tends to share or keep private

The runtime compiles these files into:

- `../compiled/character_profile.json`

Pipeline code should read the compiled profile, not each editable file directly.
