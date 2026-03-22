const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { buildScenePlanCandidateResult } = require('./lib/scene_programs');

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const paths = config.paths || {};
  const runtimeDir = resolveRelative(configPath, paths.runtimeDir || '../runtime');
  const identityProfilePath = resolveRelative(configPath, paths.identityProfile || '../character/identity_profile.json');
  const currentDir = path.join(runtimeDir, 'current');

  const settingModel = readJsonRequired(resolveRelative(configPath, './setting_model.json'), 'setting model');
  const catalog = readJsonRequired(resolveRelative(configPath, './scene_program_catalog.json'), 'scene program catalog');
  const noveltyPolicy = readJsonRequired(resolveRelative(configPath, './novelty_policy.json'), 'novelty policy');
  const worldState = readJsonRequired(path.join(currentDir, 'world_state_snapshot.json'), 'world state snapshot');
  const affordancePool = readJsonRequired(path.join(currentDir, 'affordance_pool.json'), 'affordance pool');
  const noveltyLedger = readJsonOptional(path.join(currentDir, 'novelty_ledger.json'), {});
  const continuityReview = readJsonOptional(path.join(currentDir, 'continuity_creative_review.json'), {});
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');
  const validatedSituationHypotheses = readJsonOptional(path.join(currentDir, 'validated_situation_hypotheses.json'), {});
  const semanticRepeatCritic = readJsonOptional(path.join(currentDir, 'semantic_repeat_critic.json'), {});
  const activationMap = readJsonOptional(path.join(currentDir, 'activation_map.json'), {});
  const worldGraphSnapshot = readJsonOptional(path.join(currentDir, 'world_graph_snapshot.json'), {});

  const result = buildScenePlanCandidateResult({
    config,
    settingModel,
    catalog,
    noveltyPolicy,
    worldState,
    affordancePool,
    noveltyLedger,
    continuityReview,
    identityProfile,
    validatedSituationHypotheses,
    semanticRepeatCritic,
    activationMap,
    worldGraphSnapshot
  });

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    source: result.source,
    plannerMode: result.plannerMode,
    status: 'scene_plan_candidates_ready',
    sourceArtifacts: {
      worldStateSnapshotPath: path.join(currentDir, 'world_state_snapshot.json'),
      affordancePoolPath: path.join(currentDir, 'affordance_pool.json'),
      noveltyLedgerPath: path.join(currentDir, 'novelty_ledger.json'),
      validatedSituationHypothesesPath: path.join(currentDir, 'validated_situation_hypotheses.json'),
      semanticRepeatCriticPath: path.join(currentDir, 'semantic_repeat_critic.json')
    },
    candidateCount: result.candidates.length,
    candidates: result.candidates
  };

  const written = writeRuntimeArtifact(runtimeDir, 'scene_plan_candidates.json', 'sceneplancandidates', output);
  console.log(`scene plan candidates created: ${written.currentPath}`);
  console.log(`scene plan candidates archived: ${written.archivedPath}`);
  console.log(`scene plan candidate mode: ${output.plannerMode}`);
}

main();
