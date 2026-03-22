const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { buildAffordancePool } = require('./lib/world_state');

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const settingModel = readJsonRequired(resolveRelative(configPath, './setting_model.json'), 'setting model');
  const worldState = readJsonRequired(path.join(runtimeDir, 'current', 'world_state_snapshot.json'), 'world state snapshot');

  const output = buildAffordancePool(worldState, settingModel);
  output.source = 'code';
  output.status = 'affordance_pool_ready';
  const written = writeRuntimeArtifact(runtimeDir, 'affordance_pool.json', 'affordancepool', output);
  console.log(`affordance pool created: ${written.currentPath}`);
  console.log(`affordance pool archived: ${written.archivedPath}`);
}

main();
