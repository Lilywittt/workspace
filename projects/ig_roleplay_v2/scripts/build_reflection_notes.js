const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');

function uniqueStrings(values, limit = 10) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)))
    .slice(0, limit);
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const noveltyLedger = readJsonOptional(path.join(runtimeDir, 'current', 'novelty_ledger.json'), {});

  const recurringObjects = (noveltyLedger?.counts?.objectFamily || [])
    .filter(item => Number(item.count) >= 2)
    .map(item => item.value)
    .slice(0, 6);
  const familiarPlaces = (noveltyLedger?.counts?.locationArchetype || [])
    .filter(item => Number(item.count) >= 2)
    .map(item => item.value)
    .slice(0, 6);
  const stableEmotionalLandings = (noveltyLedger?.counts?.emotionalLanding || [])
    .filter(item => Number(item.count) >= 2)
    .map(item => item.value)
    .slice(0, 6);
  const recurringScenePrograms = (noveltyLedger?.counts?.sceneProgramId || [])
    .filter(item => Number(item.count) >= 2)
    .map(item => item.value)
    .slice(0, 6);

  const fatiguePatterns = uniqueStrings([
    noveltyLedger?.fatigueFlags?.weatherPrimaryOveruse ? 'Weather has been acting as the main scene driver too often.' : '',
    noveltyLedger?.fatigueFlags?.indoorClusterOveruse ? 'Indoor clusters have become dominant enough to flatten the world.' : '',
    noveltyLedger?.fatigueFlags?.studyAftermathClusterOveruse ? 'Study-adjacent scenes are starting to feel over-represented.' : '',
    ...((noveltyLedger?.dominance?.sceneClusters || []).map(item => `Cooldown scene cluster: ${item.value}`))
  ], 8);

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    source: 'code',
    status: 'reflection_notes_ready',
    sourceNoveltyLedgerPath: path.join(runtimeDir, 'current', 'novelty_ledger.json'),
    recurringObjects,
    familiarPlaces,
    stableEmotionalLandings,
    recurringScenePrograms,
    fatiguePatterns,
    guidanceNotes: uniqueStrings([
      recurringObjects.length > 0 ? `Keep recurring object families as memory texture, not default crutches: ${recurringObjects.join(', ')}` : '',
      familiarPlaces.length > 0 ? `Use familiar places selectively so they feel lived-in instead of repetitive: ${familiarPlaces.join(', ')}` : '',
      ...fatiguePatterns
    ], 8)
  };

  const written = writeRuntimeArtifact(runtimeDir, 'reflection_notes.json', 'reflectionnotes', output);
  console.log(`reflection notes created: ${written.currentPath}`);
  console.log(`reflection notes archived: ${written.archivedPath}`);
}

main();
