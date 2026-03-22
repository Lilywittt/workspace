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

function asStringArray(values, limit = 8) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)))
    .slice(0, limit);
}

function normalizePresenceMode(value, fallback = 'partial_presence') {
  const normalized = String(value || '').trim();
  const allowed = ['full_selfie', 'partial_presence', 'wide_scene_with_character_trace'];
  return allowed.includes(normalized) ? normalized : fallback;
}

function buildFallback(signals, continuityReview, sceneFacts, selectedSceneCandidate, worldState, programInstance, selectedHypothesis) {
  const candidate = selectedSceneCandidate?.selectedCandidate || {};
  const objectBinding = (candidate.objectBindings || [])[0] || 'one small object';
  const locationLabel = String(candidate.locationArchetype || 'indoor_desk_corner').replace(/_/g, ' ');
  const actionSequence = asStringArray(programInstance?.actionBeats || selectedHypothesis?.actionArc || candidate.actionSequence || [], 3);
  return {
    requestedPresenceMode: normalizePresenceMode(candidate.presenceMode, sceneFacts?.lane === 'selfie' ? 'full_selfie' : 'partial_presence'),
    narrativePremise: String(programInstance?.executionIntention || '').trim()
      || (sceneFacts?.lane === 'selfie'
        ? `Keep the post intimate and close, treating ${objectBinding} as the mood marker that makes the face-led moment worth capturing.`
        : `Let the post grow from ${objectBinding} inside ${locationLabel}, so the world feels chosen rather than randomly described.`),
    microPlot: actionSequence.length === 3
      ? actionSequence
      : [
          `Cause: today feels shaped by ${String(sceneFacts?.weatherSignal || 'a small shift in weather').trim()}.`,
          `Action: pause at ${objectBinding} inside ${locationLabel} instead of summarizing the whole day.`,
          'Feeling: keep the emotional landing soft, personal, and lightly lingering.'
        ],
    sensoryFocus: String(sceneFacts?.sensoryFocus || worldState?.environment?.weatherSummary || '').trim(),
    sceneNotes: [
      `Anchor the frame in ${locationLabel}.`,
      `Keep ${objectBinding} clearly readable.`,
      ...(programInstance?.frameIntent || []),
      ...(candidate.imageHooks || []),
      ...(continuityReview?.imageAdvice || [])
    ],
    tone: ['gentle', 'light chunibyo', 'private ritual energy', 'daily-life texture', candidate.emotionalLanding || 'tiny_reset'],
    captionFocus: [
      ...(programInstance?.captionHooks || []),
      ...((candidate.captionHooks || []).slice(0, 3)),
      'Use a fresh opening image.',
      ...(continuityReview?.captionAdvice || [])
    ],
    summary: 'Fallback scene draft: selected scene candidate polished into a daily-life creative direction.'
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
  const continuitySnapshot = readJsonRequired(path.join(currentDir, 'continuity_snapshot.json'), 'continuity snapshot');
  const continuityReview = readJsonOptional(path.join(currentDir, 'continuity_creative_review.json'), {});
  const selectedSceneCandidate = readJsonOptional(path.join(currentDir, 'selected_scene_candidate.json'), {});
  const worldStateSnapshot = readJsonOptional(path.join(currentDir, 'world_state_snapshot.json'), {});
  const affordancePool = readJsonOptional(path.join(currentDir, 'affordance_pool.json'), {});
  const programInstance = readJsonOptional(path.join(currentDir, 'program_instance_ai.json'), {});
  const validatedHypotheses = readJsonOptional(path.join(currentDir, 'validated_situation_hypotheses.json'), {});
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');
  const creativePersona = buildCreativePersonaInput(identityProfile);
  const signals = readJsonOptional(path.join(legacyDataDir, 'signals.json'), {});
  const skillPath = resolveRelative(configPath, '../../../skills/scene-plan-creative-director/SKILL.md');
  const modelConfigPath = resolveRelative(configPath, './creative_model.json');

  const selectedCandidate = selectedSceneCandidate?.selectedCandidate || {};
  const selectedHypothesis = (validatedHypotheses?.acceptedHypotheses || []).find(item => item.hypothesisId === selectedCandidate.hypothesisId) || {};

  const sceneFacts = {
    lane: continuitySnapshot?.recommendation?.preferredLane || config?.planner?.primaryLane || 'selfie',
    weatherSignal: signals?.weather?.summary || signals?.weather?.weather_code || '',
    trendSignal: (signals?.trends || [])[0] || '',
    sensoryFocus: String(worldStateSnapshot?.environment?.weatherSummary || signals?.weather?.summary || '').trim()
  };

  let draft = null;
  let source = 'skill';
  let status = 'scene_plan_draft_ready';
  let errorMessage = '';

  try {
    draft = await runSkillJsonTask({
      skillPath,
      modelConfigPath,
      taskLabel: 'Draft the creative scene direction for the next Instagram roleplay post.',
      outputContract: {
        requestedPresenceMode: 'full_selfie or partial_presence or wide_scene_with_character_trace',
        narrativePremise: 'one concise paragraph',
        microPlot: ['cause sentence', 'action sentence', 'feeling sentence'],
        sensoryFocus: 'short sensory phrase',
        sceneNotes: ['short bullet'],
        tone: ['tone keyword'],
        captionFocus: ['short bullet'],
        summary: 'one concise summary sentence'
      },
      input: {
        continuitySnapshot,
        continuityCreativeReview: continuityReview,
        selectedSceneCandidate,
        selectedSituationHypothesis: selectedHypothesis,
        programInstance,
        worldStateSnapshot,
        affordancePool,
        creativePersona,
        visualIdentity: identityProfile?.visualIdentity || {},
        dailySignals: {
          date: signals?.date || '',
          location: signals?.location || {},
          weather: signals?.weather || {},
          trends: signals?.trends || [],
          news: (signals?.news || []).slice(0, 3)
        },
        policy: {
          preferredLane: continuitySnapshot?.recommendation?.preferredLane || '',
          hardRule: 'Do not ignore continuity rhythm; strengthen expression within the allowed lane.'
        }
      }
    });
  } catch (err) {
    draft = buildFallback(signals, continuityReview, sceneFacts, selectedSceneCandidate, worldStateSnapshot, programInstance, selectedHypothesis);
    source = 'fallback';
    status = 'scene_plan_draft_fallback';
    errorMessage = err.message;
  }

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    source,
    status,
    selectedSceneCandidateId: String(selectedSceneCandidate?.selectedCandidateId || '').trim(),
    situationHypothesisId: String(selectedHypothesis?.hypothesisId || '').trim(),
    sceneProgramId: String(selectedSceneCandidate?.selectedCandidate?.sceneProgramId || '').trim(),
    dynamicProgramName: String(programInstance?.dynamicProgramName || '').trim(),
    requestedPresenceMode: normalizePresenceMode(draft.requestedPresenceMode, sceneFacts.lane === 'selfie' ? 'full_selfie' : 'partial_presence'),
    narrativePremise: String(draft.narrativePremise || '').trim(),
    microPlot: asStringArray(draft.microPlot, 3).slice(0, 3),
    sensoryFocus: String(draft.sensoryFocus || '').trim(),
    sceneNotes: asStringArray(draft.sceneNotes, 10),
    tone: asStringArray(draft.tone, 6),
    captionFocus: asStringArray(draft.captionFocus, 8),
    summary: String(draft.summary || '').trim(),
    errorMessage
  };

  const written = writeRuntimeArtifact(runtimeDir, 'scene_plan_draft.json', 'sceneplandraft', output);
  console.log(`scene plan draft created: ${written.currentPath}`);
  console.log(`scene plan draft archived: ${written.archivedPath}`);
  console.log(`scene plan draft status: ${output.status}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
