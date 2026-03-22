const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { runSkillJsonTask } = require('./lib/creative_llm');
const { buildCreativePersonaInput } = require('./lib/persona_guidance');

function asStringArray(values, limit = 6) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)))
    .slice(0, limit);
}

function pickLane(value, fallback = 'life_record') {
  const normalized = String(value || '').trim().toLowerCase();
  return ['selfie', 'life_record'].includes(normalized) ? normalized : fallback;
}

function buildFallback(snapshot) {
  const recommendation = snapshot?.recommendation || {};
  const preferredLane = pickLane(recommendation.preferredLane, 'life_record');
  return {
    laneSoftPreference: preferredLane,
    freshnessTargets: [
      'Shift the emotional angle slightly instead of repeating the same mood.',
      'Prefer a smaller lived moment over a broad summary.',
      'Keep the post feeling personal rather than topical.'
    ],
    avoidMotifs: [
      'Do not reuse the same opening line.',
      'Do not stack the same hashtag cluster again.',
      'Avoid turning the post into empty mood wallpaper.'
    ],
    narrativeNudges: [
      'Let the next post feel like a continuation of life, not a reset.',
      'Keep one intimate detail in focus.'
    ],
    captionAdvice: [
      'Open with a fresh image or feeling, not a repeated weather phrase.',
      'Keep the cause-action-feeling arc visible.'
    ],
    imageAdvice: [
      preferredLane === 'selfie'
        ? 'If a selfie is allowed, keep it natural and non-performative.'
        : 'Keep character presence readable even if the face is not fully shown.'
    ],
    summary: 'Fallback continuity review: keep freshness, reduce repetition, and respect current lane rhythm.'
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const legacyDataDir = resolveRelative(configPath, (config.paths && config.paths.legacyDataDir) || '../../../data/ig_roleplay');
  const identityProfilePath = resolveRelative(configPath, (config.paths && config.paths.identityProfile) || '../character/identity_profile.json');
  const currentDir = path.join(runtimeDir, 'current');
  const snapshot = readJsonOptional(path.join(currentDir, 'continuity_snapshot.json'), null);
  const noveltyLedger = readJsonOptional(path.join(currentDir, 'novelty_ledger.json'), {});
  const reflectionNotes = readJsonOptional(path.join(currentDir, 'reflection_notes.json'), {});
  const worldStateSnapshot = readJsonOptional(path.join(currentDir, 'world_state_snapshot.json'), {});
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');
  const creativePersona = buildCreativePersonaInput(identityProfile);
  const signals = readJsonOptional(path.join(legacyDataDir, 'signals.json'), {});
  const skillPath = resolveRelative(configPath, '../../../skills/continuity-creative-reviewer/SKILL.md');
  const modelConfigPath = resolveRelative(configPath, './creative_model.json');

  if (!snapshot) {
    throw new Error('continuity_snapshot.json is missing');
  }

  let draft = null;
  let status = 'creative_review_ready';
  let source = 'skill';
  let errorMessage = '';

  try {
    draft = await runSkillJsonTask({
      skillPath,
      modelConfigPath,
      taskLabel: 'Review the recent posting rhythm and propose creative refresh directions for the next run.',
      outputContract: {
        laneSoftPreference: 'selfie or life_record',
        freshnessTargets: ['short bullet', 'short bullet'],
        avoidMotifs: ['short bullet'],
        narrativeNudges: ['short bullet'],
        captionAdvice: ['short bullet'],
        imageAdvice: ['short bullet'],
        summary: 'one concise summary sentence'
      },
      input: {
        continuitySnapshot: snapshot,
        noveltyLedger,
        reflectionNotes,
        worldStateSnapshot,
        dailySignals: {
          date: signals?.date || '',
          weather: signals?.weather || {},
          trends: signals?.trends || [],
          news: (signals?.news || []).slice(0, 3)
        },
        creativePersona,
        instructions: {
          language: 'english json fields, but keep advice useful for Chinese creative writing',
          doNotBreakPolicy: 'Do not override hard rhythm facts; only suggest creative direction.'
        }
      }
    });
  } catch (err) {
    draft = buildFallback(snapshot);
    status = 'creative_review_fallback';
    source = 'fallback';
    errorMessage = err.message;
  }

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    sceneWindow: snapshot.historyWindow || 7,
    sourceSnapshotPath: path.join(currentDir, 'continuity_snapshot.json'),
    source,
    status,
    laneSoftPreference: pickLane(draft.laneSoftPreference, snapshot?.recommendation?.preferredLane || 'life_record'),
    freshnessTargets: asStringArray(draft.freshnessTargets, 6),
    avoidMotifs: asStringArray(draft.avoidMotifs, 6),
    narrativeNudges: asStringArray(draft.narrativeNudges, 6),
    captionAdvice: asStringArray(draft.captionAdvice, 6),
    imageAdvice: asStringArray(draft.imageAdvice, 6),
    summary: String(draft.summary || '').trim(),
    errorMessage
  };

  const written = writeRuntimeArtifact(runtimeDir, 'continuity_creative_review.json', 'continuitycreative', output);
  console.log(`continuity creative review created: ${written.currentPath}`);
  console.log(`continuity creative review archived: ${written.archivedPath}`);
  console.log(`continuity creative review status: ${output.status}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
