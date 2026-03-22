const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { validateSituationHypotheses } = require('./lib/world_graph');

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const identityProfilePath = resolveRelative(configPath, (config.paths && config.paths.identityProfile) || '../character/identity_profile.json');
  const currentDir = path.join(runtimeDir, 'current');

  const graphConfig = readJsonRequired(resolveRelative(configPath, './world_graph.json'), 'world graph config');
  const settingModel = readJsonRequired(resolveRelative(configPath, './setting_model.json'), 'setting model');
  const catalog = readJsonRequired(resolveRelative(configPath, './scene_program_catalog.json'), 'scene program catalog');
  const worldStateSnapshot = readJsonRequired(path.join(currentDir, 'world_state_snapshot.json'), 'world state snapshot');
  const worldGraphSnapshot = readJsonRequired(path.join(currentDir, 'world_graph_snapshot.json'), 'world graph snapshot');
  const activationMap = readJsonRequired(path.join(currentDir, 'activation_map.json'), 'activation map');
  const hypothesesDoc = readJsonRequired(path.join(currentDir, 'situation_hypotheses_ai.json'), 'situation hypotheses');
  const noveltyLedger = readJsonOptional(path.join(currentDir, 'novelty_ledger.json'), {});
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');

  const output = validateSituationHypotheses({
    graphConfig,
    hypothesesDoc,
    activationMap,
    worldGraphSnapshot,
    settingModel,
    catalog,
    noveltyLedger,
    worldState: worldStateSnapshot,
    identityProfile,
    desiredCount: 5
  });

  output.sourceArtifacts = {
    situationHypothesesPath: path.join(currentDir, 'situation_hypotheses_ai.json'),
    activationMapPath: path.join(currentDir, 'activation_map.json'),
    worldGraphSnapshotPath: path.join(currentDir, 'world_graph_snapshot.json')
  };

  const written = writeRuntimeArtifact(runtimeDir, 'validated_situation_hypotheses.json', 'validatedsituations', output);
  console.log(`validated situation hypotheses created: ${written.currentPath}`);
  console.log(`validated situation hypotheses archived: ${written.archivedPath}`);
}

main();
