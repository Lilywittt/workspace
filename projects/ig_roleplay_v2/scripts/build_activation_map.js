const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { buildActivationMap } = require('./lib/world_graph');

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const currentDir = path.join(runtimeDir, 'current');

  const graphConfig = readJsonRequired(resolveRelative(configPath, './world_graph.json'), 'world graph config');
  const worldGraphSnapshot = readJsonRequired(path.join(currentDir, 'world_graph_snapshot.json'), 'world graph snapshot');
  const worldState = readJsonRequired(path.join(currentDir, 'world_state_snapshot.json'), 'world state snapshot');
  const reflectionNotes = readJsonOptional(path.join(currentDir, 'reflection_notes.json'), {});
  const continuityReview = readJsonOptional(path.join(currentDir, 'continuity_creative_review.json'), {});
  const noveltyLedger = readJsonOptional(path.join(currentDir, 'novelty_ledger.json'), {});

  const output = buildActivationMap({
    graphConfig,
    worldGraphSnapshot,
    worldState,
    reflectionNotes,
    continuityReview,
    noveltyLedger
  });

  output.sourceArtifacts = {
    worldGraphSnapshotPath: path.join(currentDir, 'world_graph_snapshot.json'),
    worldStateSnapshotPath: path.join(currentDir, 'world_state_snapshot.json'),
    reflectionNotesPath: path.join(currentDir, 'reflection_notes.json'),
    continuityCreativeReviewPath: path.join(currentDir, 'continuity_creative_review.json')
  };

  const written = writeRuntimeArtifact(runtimeDir, 'activation_map.json', 'activationmap', output);
  console.log(`activation map created: ${written.currentPath}`);
  console.log(`activation map archived: ${written.archivedPath}`);
}

main();
