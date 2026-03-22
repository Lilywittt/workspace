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
const { buildFallbackSituationHypotheses } = require('./lib/world_graph');

function asStringArray(values, limit = 6) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)))
    .slice(0, limit);
}

function normalizeHypothesis(item, index) {
  return {
    hypothesisId: String(item?.hypothesisId || `situation_hyp_${String(index + 1).padStart(2, '0')}`).trim(),
    sourceSeedId: String(item?.sourceSeedId || '').trim(),
    lane: String(item?.lane || '').trim(),
    sceneProgramId: String(item?.sceneProgramId || '').trim(),
    affordanceId: String(item?.affordanceId || '').trim(),
    locationArchetype: String(item?.locationArchetype || '').trim(),
    objectFamily: String(item?.objectFamily || '').trim(),
    suggestedObjectBindings: asStringArray(item?.suggestedObjectBindings, 3),
    weatherRole: String(item?.weatherRole || '').trim(),
    emotionalLanding: String(item?.emotionalLanding || '').trim(),
    presenceMode: String(item?.presenceMode || '').trim(),
    situationType: String(item?.situationType || '').trim(),
    relationshipTension: String(item?.relationshipTension || '').trim(),
    actionArc: asStringArray(item?.actionArc, 3),
    captionHooks: asStringArray(item?.captionHooks, 4),
    imageHooks: asStringArray(item?.imageHooks, 4),
    noveltyClaim: String(item?.noveltyClaim || '').trim(),
    premiseSeed: String(item?.premiseSeed || '').trim(),
    whyNow: String(item?.whyNow || '').trim()
  };
}

function compactText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTaskInput(activationMap, worldGraphSnapshot, worldStateSnapshot, continuityCreativeReview, creativePersona) {
  return {
    lane: worldStateSnapshot?.characterState?.lanePreference || 'life_record',
    needState: asStringArray(worldStateSnapshot?.characterState?.needState || [], 5),
    attentionShape: String(worldStateSnapshot?.characterState?.attentionShape || '').trim(),
    continuitySummary: compactText(continuityCreativeReview?.summary || ''),
    freshnessTargets: asStringArray(continuityCreativeReview?.freshnessTargets || [], 4),
    activatedSeeds: (activationMap?.activatedSeeds || []).slice(0, 6).map(seed => ({
      seedId: seed.seedId,
      sceneProgramId: seed.sceneProgramId,
      affordanceId: seed.affordanceId,
      locationArchetype: seed.locationArchetype,
      objectFamily: seed.objectFamily,
      suggestedObjectBindings: asStringArray(seed.suggestedObjectBindings || [], 3),
      emotionalLanding: seed.emotionalLanding,
      weatherRole: seed.weatherRole,
      presenceMode: seed.presenceMode,
      reasons: asStringArray(seed.reasons || [], 3)
    })),
    activatedPlaces: (worldGraphSnapshot?.graphSummary?.topPlaceIds || []).slice(0, 6),
    activatedObjects: (worldGraphSnapshot?.graphSummary?.topObjectFamilies || []).slice(0, 6),
    activatedPrograms: (worldGraphSnapshot?.graphSummary?.topProgramIds || []).slice(0, 6),
    creativePersona,
    instructions: {
      hardBoundary: 'Only use sceneProgramId, locationArchetype, objectFamily, affordanceId, and sourceSeedId that already exist in the provided activation map.',
      goal: 'Generate structurally different daily-life situations, not surface-level rewrites of the same indoor study basin.',
      brevity: 'Keep every field compact so the full JSON stays short and parseable.'
    }
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

  const activationMap = readJsonRequired(path.join(currentDir, 'activation_map.json'), 'activation map');
  const worldGraphSnapshot = readJsonRequired(path.join(currentDir, 'world_graph_snapshot.json'), 'world graph snapshot');
  const worldStateSnapshot = readJsonRequired(path.join(currentDir, 'world_state_snapshot.json'), 'world state snapshot');
  const continuityCreativeReview = readJsonOptional(path.join(currentDir, 'continuity_creative_review.json'), {});
  const settingModel = readJsonRequired(resolveRelative(configPath, './setting_model.json'), 'setting model');
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');
  const creativePersona = buildCreativePersonaInput(identityProfile);
  const skillPath = resolveRelative(configPath, '../../../skills/situation-hypotheses-planner/SKILL.md');
  const modelConfigPath = resolveRelative(configPath, './creative_model.json');

  let hypotheses = null;
  let source = 'skill';
  let status = 'situation_hypotheses_ready';
  let errorMessage = '';

  try {
    const draft = await runSkillJsonTask({
      skillPath,
      modelConfigPath,
      taskLabel: 'Propose situation hypotheses for the next Instagram roleplay run using the activated world graph.',
      outputContract: {
        hypotheses: [
          {
            hypothesisId: 'string id',
            sourceSeedId: 'seed id from activation map',
            lane: 'selfie or life_record',
            sceneProgramId: 'scene program id from activation map',
            affordanceId: 'affordance id from activation map',
            locationArchetype: 'location archetype id from activation map',
            objectFamily: 'object family id from activation map',
            suggestedObjectBindings: ['short object binding'],
            weatherRole: 'primary_scene_driver or reflective_support or texture_modifier or background_only',
            emotionalLanding: 'emotional landing family id',
            presenceMode: 'full_selfie or partial_presence or wide_scene_with_character_trace',
            situationType: 'short semantic label',
            relationshipTension: 'one short sentence',
            actionArc: ['beat 1', 'beat 2', 'beat 3'],
            captionHooks: ['short hook'],
            imageHooks: ['short hook'],
            noveltyClaim: 'one short sentence',
            premiseSeed: 'one short sentence',
            whyNow: 'one short sentence'
          }
        ],
        summary: 'one short sentence'
      },
      input: buildTaskInput(
        activationMap,
        worldGraphSnapshot,
        worldStateSnapshot,
        continuityCreativeReview,
        creativePersona
      )
    });
    hypotheses = Array.isArray(draft?.hypotheses)
      ? draft.hypotheses.map(normalizeHypothesis)
      : [];
    if (hypotheses.length === 0) {
      throw new Error('Skill returned zero hypotheses.');
    }
  } catch (err) {
    hypotheses = buildFallbackSituationHypotheses({
      activationMap,
      worldState: worldStateSnapshot,
      settingModel,
      reflectionNotes: { recurringObjects: worldStateSnapshot?.worldMemoryRefs?.recurringObjects || [] },
      continuityReview: continuityCreativeReview
    }).map(normalizeHypothesis);
    source = 'fallback';
    status = 'situation_hypotheses_fallback';
    errorMessage = err.message;
  }

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    source,
    status,
    hypothesisCount: hypotheses.length,
    sourceArtifacts: {
      activationMapPath: path.join(currentDir, 'activation_map.json'),
      worldGraphSnapshotPath: path.join(currentDir, 'world_graph_snapshot.json'),
      worldStateSnapshotPath: path.join(currentDir, 'world_state_snapshot.json'),
      continuityCreativeReviewPath: path.join(currentDir, 'continuity_creative_review.json')
    },
    hypotheses,
    errorMessage
  };

  const written = writeRuntimeArtifact(runtimeDir, 'situation_hypotheses_ai.json', 'situationhypotheses', output);
  console.log(`situation hypotheses created: ${written.currentPath}`);
  console.log(`situation hypotheses archived: ${written.archivedPath}`);
  console.log(`situation hypotheses status: ${output.status}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
