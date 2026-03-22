const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const {
  buildSemanticStats,
  readHistoricalSemanticEntries,
  topUnique
} = require('./lib/history_semantics');

function buildCountEntries(entries, key, limit = 12) {
  return topUnique(entries.map(entry => entry[key]), limit);
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const continuitySnapshot = readJsonOptional(path.join(runtimeDir, 'current', 'continuity_snapshot.json'), {});
  const policy = readJsonOptional(resolveRelative(configPath, './novelty_policy.json'), {});
  const historyWindow = Number(policy.historyWindow || 12);
  const entries = readHistoricalSemanticEntries(runtimeDir, historyWindow);
  const stats = buildSemanticStats(entries, 8);
  const dominanceThresholds = policy.dominanceThresholds || {};

  const dominance = {
    scenePrograms: (stats.scenePrograms || []).filter(item => item.count >= Number(dominanceThresholds.sceneProgram || 2)),
    locationArchetypes: (stats.locationArchetypes || []).filter(item => item.count >= Number(dominanceThresholds.locationArchetype || 3)),
    objectFamilies: (stats.objectFamilies || []).filter(item => item.count >= Number(dominanceThresholds.objectFamily || 3)),
    weatherRoles: (stats.weatherRoles || []).filter(item => item.count >= Number(dominanceThresholds.weatherRole || 4)),
    sceneClusters: (stats.locationClusters || []).filter(item => item.count >= Number(dominanceThresholds.sceneCluster || 3))
  };

  const indoorClusterHits = entries.filter(entry => /indoor_reset|domestic_reset|comfort_reset|indoors_light_edge|bookish_pause/.test(entry.locationCluster || '')).length;
  const studyAftermathHits = entries.filter(entry => /indoor_reset|bookish_pause/.test(entry.locationCluster || '')).length;
  const weatherPrimaryHits = entries.filter(entry => entry.weatherRole === 'primary_scene_driver').length;

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    source: 'code',
    status: 'novelty_ledger_ready',
    sourceSnapshotPath: path.join(runtimeDir, 'current', 'continuity_snapshot.json'),
    historyWindow,
    recentEntries: entries,
    counts: {
      sceneProgramId: buildCountEntries(entries, 'sceneProgramId'),
      locationArchetype: buildCountEntries(entries, 'locationArchetype'),
      locationCluster: buildCountEntries(entries, 'locationCluster'),
      actionKernel: buildCountEntries(entries, 'actionKernel'),
      objectFamily: buildCountEntries(entries, 'objectFamily'),
      weatherRole: buildCountEntries(entries, 'weatherRole'),
      emotionalLanding: buildCountEntries(entries, 'emotionalLanding'),
      presenceMode: buildCountEntries(entries, 'presenceMode'),
      captionEndingFamily: buildCountEntries(entries, 'captionEndingFamily')
    },
    dominance,
    fatigueFlags: {
      weatherPrimaryOveruse: weatherPrimaryHits >= Number(dominanceThresholds.weatherRole || 4),
      indoorClusterOveruse: indoorClusterHits >= 4,
      studyAftermathClusterOveruse: studyAftermathHits >= 4
    },
    suggestions: {
      coolDownScenePrograms: dominance.scenePrograms.map(item => item.value).slice(0, 4),
      coolDownClusters: dominance.sceneClusters.map(item => item.value).slice(0, 4),
      keepLanePressure: continuitySnapshot?.recommendation?.preferredLane || config?.planner?.primaryLane || 'selfie'
    }
  };

  const written = writeRuntimeArtifact(runtimeDir, 'novelty_ledger.json', 'noveltyledger', output);
  console.log(`novelty ledger created: ${written.currentPath}`);
  console.log(`novelty ledger archived: ${written.archivedPath}`);
}

main();
