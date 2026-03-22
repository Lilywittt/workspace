const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { buildWorldGraphSnapshot } = require('./lib/world_graph');

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
  const worldState = readJsonRequired(path.join(currentDir, 'world_state_snapshot.json'), 'world state snapshot');
  const affordancePool = readJsonRequired(path.join(currentDir, 'affordance_pool.json'), 'affordance pool');
  const noveltyLedger = readJsonOptional(path.join(currentDir, 'novelty_ledger.json'), {});
  const reflectionNotes = readJsonOptional(path.join(currentDir, 'reflection_notes.json'), {});
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');

  const output = buildWorldGraphSnapshot({
    config,
    graphConfig,
    settingModel,
    catalog,
    worldState,
    affordancePool,
    noveltyLedger,
    reflectionNotes,
    identityProfile
  });

  output.sourceArtifacts = {
    worldStateSnapshotPath: path.join(currentDir, 'world_state_snapshot.json'),
    affordancePoolPath: path.join(currentDir, 'affordance_pool.json'),
    noveltyLedgerPath: path.join(currentDir, 'novelty_ledger.json'),
    reflectionNotesPath: path.join(currentDir, 'reflection_notes.json')
  };

  const written = writeRuntimeArtifact(runtimeDir, 'world_graph_snapshot.json', 'worldgraphsnapshot', output);
  console.log(`world graph snapshot created: ${written.currentPath}`);
  console.log(`world graph snapshot archived: ${written.archivedPath}`);
}

main();
