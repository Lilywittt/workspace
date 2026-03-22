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

function buildFallback(selectedCandidate, selectedHypothesis, criticEntry) {
  return {
    dynamicProgramName: `${String(selectedCandidate?.sceneProgramId || 'scene_program').replace(/_/g, ' ')} / ${String(selectedHypothesis?.situationType || 'daily fragment').replace(/_/g, ' ')}`,
    executionIntention: String(selectedHypothesis?.premiseSeed || '').trim() || 'Keep the chosen situation concrete, small, and emotionally exact.',
    actionBeats: asStringArray([
      ...(selectedHypothesis?.actionArc || []),
      ...(selectedCandidate?.actionSequence || [])
    ], 3).slice(0, 3),
    frameIntent: asStringArray([
      `Keep ${String(selectedCandidate?.locationArchetype || '').replace(/_/g, ' ')} readable without turning it into wallpaper.`,
      `Let ${(selectedCandidate?.objectBindings || [])[0] || selectedCandidate?.objectFamily || 'one small object'} stay legible in frame.`,
      ...(selectedHypothesis?.imageHooks || [])
    ], 5),
    captionHooks: asStringArray([
      ...(selectedHypothesis?.captionHooks || []),
      ...(selectedCandidate?.captionHooks || [])
    ], 5),
    imageHooks: asStringArray([
      ...(selectedHypothesis?.imageHooks || []),
      ...(selectedCandidate?.imageHooks || [])
    ], 5),
    antiRepeatNotes: asStringArray([
      ...(criticEntry?.hiddenSimilarity || []),
      criticEntry?.suggestedAdjustment || ''
    ], 4),
    microTension: String(selectedHypothesis?.relationshipTension || '').trim() || 'Keep the scene emotionally alive without escalating it into spectacle.',
    summary: 'Fallback program instance: selected situation locked into a run-specific executable scene instance.'
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const identityProfilePath = resolveRelative(configPath, (config.paths && config.paths.identityProfile) || '../character/identity_profile.json');
  const currentDir = path.join(runtimeDir, 'current');

  const selectedSceneCandidate = readJsonRequired(path.join(currentDir, 'selected_scene_candidate.json'), 'selected scene candidate');
  const validatedHypotheses = readJsonRequired(path.join(currentDir, 'validated_situation_hypotheses.json'), 'validated situation hypotheses');
  const semanticRepeatCritic = readJsonOptional(path.join(currentDir, 'semantic_repeat_critic.json'), {});
  const worldStateSnapshot = readJsonOptional(path.join(currentDir, 'world_state_snapshot.json'), {});
  const continuityCreativeReview = readJsonOptional(path.join(currentDir, 'continuity_creative_review.json'), {});
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');
  const creativePersona = buildCreativePersonaInput(identityProfile);
  const skillPath = resolveRelative(configPath, '../../../skills/program-instance-architect/SKILL.md');
  const modelConfigPath = resolveRelative(configPath, './creative_model.json');

  const selectedCandidate = selectedSceneCandidate?.selectedCandidate || {};
  const selectedHypothesis = (validatedHypotheses?.acceptedHypotheses || []).find(item => item.hypothesisId === selectedCandidate.hypothesisId) || {};
  const criticEntry = (semanticRepeatCritic?.critiques || []).find(item => item.hypothesisId === selectedHypothesis.hypothesisId) || {};

  let draft = null;
  let source = 'skill';
  let status = 'program_instance_ready';
  let errorMessage = '';

  try {
    draft = await runSkillJsonTask({
      skillPath,
      modelConfigPath,
      taskLabel: 'Turn the selected situation hypothesis into a run-specific program instance for scene execution.',
      outputContract: {
        dynamicProgramName: 'short name',
        executionIntention: 'one concise paragraph',
        actionBeats: ['beat 1', 'beat 2', 'beat 3'],
        frameIntent: ['short bullet'],
        captionHooks: ['short bullet'],
        imageHooks: ['short bullet'],
        antiRepeatNotes: ['short bullet'],
        microTension: 'one short sentence',
        summary: 'one short sentence'
      },
      input: {
        selectedSceneCandidate,
        selectedHypothesis,
        semanticRepeatCriticEntry: criticEntry,
        worldStateSnapshot,
        continuityCreativeReview,
        creativePersona,
        instructions: {
          goal: 'Produce a dynamic program instance for this one run, not a generic reusable template.',
          hardBoundary: 'Do not change the selected sceneProgramId, locationArchetype, objectFamily, or presenceMode.'
        }
      }
    });
  } catch (err) {
    draft = buildFallback(selectedCandidate, selectedHypothesis, criticEntry);
    source = 'fallback';
    status = 'program_instance_fallback';
    errorMessage = err.message;
  }

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    source,
    status,
    selectedCandidateId: String(selectedSceneCandidate?.selectedCandidateId || '').trim(),
    hypothesisId: String(selectedHypothesis?.hypothesisId || '').trim(),
    sceneProgramId: String(selectedCandidate?.sceneProgramId || '').trim(),
    dynamicProgramName: String(draft?.dynamicProgramName || '').trim(),
    executionIntention: String(draft?.executionIntention || '').trim(),
    actionBeats: asStringArray(draft?.actionBeats, 3).slice(0, 3),
    frameIntent: asStringArray(draft?.frameIntent, 6),
    captionHooks: asStringArray(draft?.captionHooks, 6),
    imageHooks: asStringArray(draft?.imageHooks, 6),
    antiRepeatNotes: asStringArray(draft?.antiRepeatNotes, 6),
    microTension: String(draft?.microTension || '').trim(),
    summary: String(draft?.summary || '').trim(),
    errorMessage
  };

  const written = writeRuntimeArtifact(runtimeDir, 'program_instance_ai.json', 'programinstance', output);
  console.log(`program instance created: ${written.currentPath}`);
  console.log(`program instance archived: ${written.archivedPath}`);
  console.log(`program instance status: ${output.status}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
