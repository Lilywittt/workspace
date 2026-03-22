const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { buildWorldStateSnapshot } = require('./lib/world_state');

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const paths = config.paths || {};
  const runtimeDir = resolveRelative(configPath, paths.runtimeDir || '../runtime');
  const legacyDataDir = resolveRelative(configPath, paths.legacyDataDir || '../../../data/ig_roleplay');
  const identityProfilePath = resolveRelative(configPath, paths.identityProfile || '../character/identity_profile.json');
  const currentDir = path.join(runtimeDir, 'current');

  const settingModel = readJsonRequired(resolveRelative(configPath, './setting_model.json'), 'setting model');
  const rules = readJsonRequired(resolveRelative(configPath, './world_state_rules.json'), 'world state rules');
  const signals = readJsonOptional(path.join(legacyDataDir, 'signals.json'), {});
  const continuitySnapshot = readJsonRequired(path.join(currentDir, 'continuity_snapshot.json'), 'continuity snapshot');
  const noveltyLedger = readJsonOptional(path.join(currentDir, 'novelty_ledger.json'), {});
  const reflectionNotes = readJsonOptional(path.join(currentDir, 'reflection_notes.json'), {});
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');

  const output = buildWorldStateSnapshot({
    config,
    settingModel,
    rules,
    signals,
    continuitySnapshot,
    noveltyLedger,
    reflectionNotes,
    identityProfile
  });
  output.source = 'code';
  output.status = 'world_state_snapshot_ready';

  const written = writeRuntimeArtifact(runtimeDir, 'world_state_snapshot.json', 'worldstate', output);
  console.log(`world state snapshot created: ${written.currentPath}`);
  console.log(`world state snapshot archived: ${written.archivedPath}`);
}

main();
