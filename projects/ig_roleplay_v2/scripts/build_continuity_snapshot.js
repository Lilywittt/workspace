const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonl,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const {
  buildSemanticStats,
  normalizeLane,
  readHistoricalSemanticEntries
} = require('./lib/history_semantics');

function countLeadingSame(items, target) {
  let count = 0;
  for (const item of items) {
    if (item === target) count += 1;
    else break;
  }
  return count;
}

function extractHashtags(text) {
  return Array.from(String(text || '').matchAll(/#[^\s#]+/g)).map(match => match[0]);
}

function firstLine(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean) || '';
}

function topUnique(values, limit) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const paths = config.paths || {};
  const planner = config.planner || {};
  const primaryLane = String(planner.primaryLane || 'selfie').toLowerCase();
  const secondaryLane = String(planner.secondaryLane || 'life_record').toLowerCase();
  const maxConsecutive = Number(planner.maxConsecutivePrimaryLane || 2);
  const historyWindow = Number(planner.historyWindow || 7);
  const semanticHistoryWindow = Number(readJsonOptional(resolveRelative(configPath, './world_state_rules.json'), {}).historyWindowForSemantics || 12);

  const legacyDataDir = resolveRelative(configPath, paths.legacyDataDir || '../../../data/ig_roleplay');
  const runtimeDir = resolveRelative(configPath, paths.runtimeDir || '../runtime');
  const postedPath = path.join(legacyDataDir, 'posted.jsonl');
  const posted = readJsonl(postedPath);
  const recent = posted.slice(-historyWindow);
  const reversedRecent = [...recent].reverse();
  const recentLanes = reversedRecent.map(post => normalizeLane(post.image_style || post.lane));

  const laneCounts = recentLanes.reduce((acc, lane) => {
    acc[lane] = (acc[lane] || 0) + 1;
    return acc;
  }, {});
  const currentStreakLane = recentLanes[0] || null;
  const currentStreakCount = currentStreakLane ? countLeadingSame(recentLanes, currentStreakLane) : 0;

  const recentPosts = reversedRecent.map(post => ({
    at: post.at || null,
    lane: normalizeLane(post.image_style || post.lane),
    captionPreview: firstLine(post.caption).slice(0, 120),
    hashtags: extractHashtags(post.caption).slice(0, 6)
  }));

  const hashtagStats = topUnique(recentPosts.flatMap(post => post.hashtags), 8);
  const openingStats = topUnique(recentPosts.map(post => post.captionPreview), 5);
  const semanticEntries = readHistoricalSemanticEntries(runtimeDir, semanticHistoryWindow);
  const semanticStats = buildSemanticStats(semanticEntries, 8);
  const sceneFatigue = [
    ...(semanticStats.scenePrograms || []).filter(item => item.count >= 2).map(item => item.value),
    ...(semanticStats.locationClusters || []).filter(item => item.count >= 3).map(item => item.value)
  ].slice(0, 6);

  const recommendation = currentStreakLane === primaryLane && currentStreakCount >= maxConsecutive
    ? {
        preferredLane: secondaryLane,
        reason: `Current ${primaryLane} streak is ${currentStreakCount}, so the next run should switch to ${secondaryLane}`,
        sceneFatigue
      }
    : {
        preferredLane: primaryLane,
        reason: `Current primary-lane streak does not exceed ${maxConsecutive}, so ${primaryLane} remains preferred`,
        sceneFatigue
      };

  const snapshot = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    historyWindow,
    sourceSnapshot: {
      postedPath
    },
    recentPosts,
    laneStats: {
      counts: laneCounts,
      currentStreak: {
        lane: currentStreakLane,
        count: currentStreakCount
      }
    },
    semanticHistory: {
      historyWindow: semanticHistoryWindow,
      recentEntries: semanticEntries,
      stats: semanticStats
    },
    duplicateGuards: {
      frequentHashtags: hashtagStats,
      recentOpenings: openingStats
    },
    recommendation
  };

  const runId = `continuity-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  const written = writeRuntimeArtifact(runtimeDir, 'continuity_snapshot.json', 'continuity', snapshot, { runId });
  console.log(`continuity snapshot created: ${written.currentPath}`);
  console.log(`continuity snapshot archived: ${written.archivedPath}`);
}

main();
