const fs = require('fs');
const path = require('path');
const {
  readJsonOptional,
  runtimeCurrentDir,
  runtimeRunsDir
} = require('./runtime');

function compactText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values, limit = 12) {
  return Array.from(new Set((values || [])
    .map(item => compactText(item))
    .filter(Boolean)))
    .slice(0, limit);
}

function normalizeLane(style) {
  const value = String(style || '').trim().toLowerCase();
  if (value === 'daily-life') return 'life_record';
  return value || 'unknown';
}

function firstLine(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean) || '';
}

function topUnique(values, limit = 6) {
  const counts = new Map();
  for (const value of values || []) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function readBundleArtifact(bundleDir, fileName) {
  const artifactPath = path.join(bundleDir, 'artifacts', fileName);
  return readJsonOptional(artifactPath, null);
}

function listRunBundleDirs(runtimeDir) {
  const bundlesDir = path.join(runtimeDir, 'history', 'run_bundles');
  if (!fs.existsSync(bundlesDir)) return [];
  return fs.readdirSync(bundlesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(bundlesDir, entry.name))
    .sort((a, b) => {
      const aStat = fs.statSync(a);
      const bStat = fs.statSync(b);
      return bStat.mtimeMs - aStat.mtimeMs;
    });
}

function listRuntimeRunArtifactDirs(runtimeDir, artifactPrefix) {
  const runsDir = runtimeRunsDir(runtimeDir);
  if (!fs.existsSync(runsDir)) return [];
  return fs.readdirSync(runsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith(`${artifactPrefix}-`))
    .map(entry => path.join(runsDir, entry.name))
    .sort((a, b) => {
      const aStat = fs.statSync(a);
      const bStat = fs.statSync(b);
      return bStat.mtimeMs - aStat.mtimeMs;
    });
}

function keywordMatches(text, patterns) {
  const source = compactText(text).toLowerCase();
  return patterns.some(pattern => source.includes(pattern));
}

function inferLocationArchetype(scenePlan, imageRequest) {
  if (scenePlan?.sceneSemantics?.locationArchetype) {
    return scenePlan.sceneSemantics.locationArchetype;
  }

  const source = [
    scenePlan?.narrative?.premise,
    ...(scenePlan?.narrative?.microPlot || []),
    ...(scenePlan?.visual?.concreteSceneCues || []),
    ...(scenePlan?.visual?.sceneNotes || []),
    imageRequest?.promptPackage?.promptBlocks?.scene
  ]
    .map(compactText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (keywordMatches(source, ['bookstore', 'shelf', 'page edges', 'aisle'])) return 'bookstore_aisle';
  if (keywordMatches(source, ['station', 'platform', 'metro', 'subway', 'train'])) return 'station_edge';
  if (keywordMatches(source, ['kitchen', 'countertop', 'steam', 'cup'])) return 'kitchen_counter';
  if (keywordMatches(source, ['laundry', 'fabric', 'folding'])) return 'laundry_corner';
  if (keywordMatches(source, ['stairwell', 'corridor', 'landing'])) return 'stairwell_landing';
  if (keywordMatches(source, ['covered walkway', 'shelter', 'awning', 'rain shelter'])) return 'covered_walkway';
  if (keywordMatches(source, ['campus', 'school gate', 'after class', 'after school'])) return 'campus_edge';
  if (keywordMatches(source, ['window seat', 'window ledge', 'by the window'])) return 'window_seat';
  if (keywordMatches(source, ['desk', 'notebook', 'textbook', 'planner', 'lamp', 'study'])) return 'indoor_desk_corner';
  if (keywordMatches(source, ['counter', 'receipt', 'convenience store', 'cashier'])) return 'convenience_counter';
  return 'indoor_desk_corner';
}

function inferObjectFamily(scenePlan, selectedCaption, imageRequest) {
  if (scenePlan?.sceneSemantics?.objectFamily) {
    return scenePlan.sceneSemantics.objectFamily;
  }

  const source = [
    scenePlan?.narrative?.premise,
    ...(scenePlan?.narrative?.microPlot || []),
    selectedCaption?.caption,
    imageRequest?.promptPackage?.promptBlocks?.scene
  ]
    .map(compactText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (keywordMatches(source, ['hairclip', 'hairpin', 'ribbon', 'badge', 'keychain'])) return 'accessory';
  if (keywordMatches(source, ['paper crane', 'petal', 'leaf', 'ticket', 'receipt corner'])) return 'paper_fragment';
  if (keywordMatches(source, ['bookmark', 'charm', 'old note', 'ticket stub'])) return 'keepsake';
  if (keywordMatches(source, ['pencil', 'planner', 'sticky note', 'paper clip', 'pen'])) return 'stationery';
  if (keywordMatches(source, ['cocoa', 'tea', 'blanket', 'cup sleeve', 'warm drink', 'mug'])) return 'comfort_item';
  if (keywordMatches(source, ['coin pouch', 'library card', 'shopping list', 'earphone', 'lip balm'])) return 'bag_contents';
  return 'stationery';
}

function inferActionKernel(scenePlan, selectedCaption) {
  if (scenePlan?.sceneSemantics?.actionKernel) {
    return scenePlan.sceneSemantics.actionKernel;
  }

  const source = [
    scenePlan?.narrative?.premise,
    ...(scenePlan?.narrative?.microPlot || []),
    selectedCaption?.caption
  ]
    .map(compactText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (keywordMatches(source, ['find', 'found', 'rediscover', 'notice again', 'between pages'])) return 'find_unfold_notice_again';
  if (keywordMatches(source, ['tidy', 'sort', 'arrange', 'reset', 'put back'])) return 'sort_reset_arrange';
  if (keywordMatches(source, ['wait', 'train', 'carry', 'platform', 'pass through'])) return 'wait_carry_pass_through';
  if (keywordMatches(source, ['browse', 'bookstore', 'page', 'shelf'])) return 'browse_pause_notice';
  if (keywordMatches(source, ['buy', 'purchase', 'counter', 'carry back'])) return 'choose_pay_carry_back';
  if (keywordMatches(source, ['repair', 'return', 'fix', 'restore'])) return 'return_fix_restore';
  if (keywordMatches(source, ['fold', 'laundry', 'fabric'])) return 'fold_sort_pause';
  if (keywordMatches(source, ['warm', 'heat', 'breathe', 'cup'])) return 'heat_hold_breathe';
  if (keywordMatches(source, ['mirror', 'adjust', 'check'])) return 'adjust_check_capture';
  if (keywordMatches(source, ['touch', 'accessory', 'clip', 'hair'])) return 'touch_adjust_notice';
  if (keywordMatches(source, ['pause', 'listen', 'hold', 'threshold'])) return 'pause_listen_hold';
  return 'sort_reset_arrange';
}

function inferWeatherRole(scenePlan, imageRequest) {
  if (scenePlan?.sceneSemantics?.weatherRole) {
    return scenePlan.sceneSemantics.weatherRole;
  }

  const source = [
    scenePlan?.freshness?.weatherSignal,
    imageRequest?.promptPackage?.promptBlocks?.scene
  ]
    .map(compactText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!source) return 'background_only';
  if (keywordMatches(source, ['storm', 'heavy rain', 'downpour', 'thunder'])) return 'primary_scene_driver';
  if (keywordMatches(source, ['light rain', 'drizzle', 'mist', 'fog', 'muted room tone', 'wet pavement'])) return 'reflective_support';
  if (keywordMatches(source, ['cool damp air', 'sunlight', 'daylight', 'wind', 'temperature'])) return 'texture_modifier';
  return 'background_only';
}

function inferEmotionalLanding(scenePlan, selectedCaption) {
  if (scenePlan?.sceneSemantics?.emotionalLanding) {
    return scenePlan.sceneSemantics.emotionalLanding;
  }

  const source = [
    scenePlan?.narrative?.premise,
    ...(scenePlan?.narrative?.microPlot || []),
    selectedCaption?.caption
  ]
    .map(compactText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (keywordMatches(source, ['finish', 'finished', 'quiet loop', '句点', '收好'])) return 'quiet_completion';
  if (keywordMatches(source, ['remember', 'memory', 'past self', '旧', '想起'])) return 'memory_return';
  if (keywordMatches(source, ['reset', 'recalibrate', '重新', '慢下来'])) return 'tiny_reset';
  if (keywordMatches(source, ['omen', 'secret sign', '暗号', '征兆'])) return 'private_omen';
  if (keywordMatches(source, ['order', 'arrange', 'put back', '整理'])) return 'gentle_order';
  if (keywordMatches(source, ['quietly like', 'fondness', '舍不得', '喜欢'])) return 'shy_attachment';
  return 'tiny_reset';
}

function inferCaptionEndingFamily(text) {
  const source = compactText(text).toLowerCase();
  if (!source) return 'unknown';
  if (keywordMatches(source, ['句点', '收好', '完成', 'finish', 'small loop'])) return 'quiet_completion';
  if (keywordMatches(source, ['想起', '从前', '过去', 'memory', 'earlier self'])) return 'memory_return';
  if (keywordMatches(source, ['暗号', '征兆', '像被世界', 'secret sign', 'omen'])) return 'private_omen';
  if (keywordMatches(source, ['重新', '整理好', 'reset', 'steady again'])) return 'tiny_reset';
  if (keywordMatches(source, ['喜欢', '舍不得', 'keep it', 'fondness'])) return 'shy_attachment';
  return 'soft_observation';
}

function extractSemanticEntry({ scenePlan, selectedCaption, imageRequest, createdAt, source = 'history' }) {
  if (!scenePlan) return null;
  const locationArchetype = inferLocationArchetype(scenePlan, imageRequest);
  const objectFamily = inferObjectFamily(scenePlan, selectedCaption, imageRequest);
  return {
    source,
    createdAt: createdAt || scenePlan.createdAt || '',
    runId: scenePlan.runId || '',
    lane: normalizeLane(scenePlan.lane),
    sceneProgramId: scenePlan?.sceneSemantics?.sceneProgramId || 'legacy_program',
    locationArchetype,
    locationCluster: scenePlan?.sceneSemantics?.locationCluster || '',
    actionKernel: inferActionKernel(scenePlan, selectedCaption),
    objectFamily,
    objectBinding: scenePlan?.sceneSemantics?.objectBindings?.[0] || '',
    weatherRole: inferWeatherRole(scenePlan, imageRequest),
    emotionalLanding: inferEmotionalLanding(scenePlan, selectedCaption),
    presenceMode: scenePlan?.sceneSemantics?.presencePolicy || scenePlan?.visual?.presenceMode || '',
    captionEndingFamily: inferCaptionEndingFamily(selectedCaption?.caption || ''),
    sceneSummary: compactText(scenePlan?.narrative?.premise || '')
  };
}

function readHistoricalSemanticEntries(runtimeDir, limit = 12) {
  const entries = [];
  const currentDir = runtimeCurrentDir(runtimeDir);
  const currentScenePlan = readJsonOptional(path.join(currentDir, 'scene_plan.json'), null);
  if (currentScenePlan) {
    const currentSelectedCaption = readJsonOptional(path.join(currentDir, 'selected_caption.json'), null);
    const currentImageRequest = readJsonOptional(path.join(currentDir, 'image_request.json'), null);
    const currentEntry = extractSemanticEntry({
      scenePlan: currentScenePlan,
      selectedCaption: currentSelectedCaption,
      imageRequest: currentImageRequest,
      createdAt: currentScenePlan.createdAt,
      source: 'current'
    });
    if (currentEntry) entries.push(currentEntry);
  }

  const seenRunIds = new Set(entries.map(entry => entry.runId).filter(Boolean));
  const scenePlanRunDirs = listRuntimeRunArtifactDirs(runtimeDir, 'sceneplan').slice(0, limit * 4);
  for (const runDir of scenePlanRunDirs) {
    const scenePlan = readJsonOptional(path.join(runDir, 'scene_plan.json'), null);
    if (!scenePlan) continue;
    const runCreatedAt = scenePlan.createdAt || fs.statSync(runDir).mtime.toISOString();
    const entry = extractSemanticEntry({
      scenePlan,
      createdAt: runCreatedAt,
      source: 'runtime_run'
    });
    if (entry && !seenRunIds.has(entry.runId)) {
      entries.push(entry);
      if (entry.runId) seenRunIds.add(entry.runId);
    }
    if (entries.length >= limit) {
      return entries.slice(0, limit);
    }
  }

  const bundleDirs = listRunBundleDirs(runtimeDir).slice(0, limit);
  for (const bundleDir of bundleDirs) {
    const manifest = readJsonOptional(path.join(bundleDir, 'manifest.json'), {});
    const scenePlan = readBundleArtifact(bundleDir, 'scene_plan.json');
    if (!scenePlan) continue;
    const selectedCaption = readBundleArtifact(bundleDir, 'selected_caption.json');
    const imageRequest = readBundleArtifact(bundleDir, 'image_request.json');
    const entry = extractSemanticEntry({
      scenePlan,
      selectedCaption,
      imageRequest,
      createdAt: manifest.createdAt,
      source: 'run_bundle'
    });
    if (entry && !seenRunIds.has(entry.runId)) {
      entries.push(entry);
      if (entry.runId) seenRunIds.add(entry.runId);
    }
  }
  return entries.slice(0, limit);
}

function buildSemanticStats(entries, limit = 6) {
  return {
    scenePrograms: topUnique(entries.map(entry => entry.sceneProgramId), limit),
    locationArchetypes: topUnique(entries.map(entry => entry.locationArchetype), limit),
    actionKernels: topUnique(entries.map(entry => entry.actionKernel), limit),
    objectFamilies: topUnique(entries.map(entry => entry.objectFamily), limit),
    weatherRoles: topUnique(entries.map(entry => entry.weatherRole), limit),
    emotionalLandings: topUnique(entries.map(entry => entry.emotionalLanding), limit),
    presenceModes: topUnique(entries.map(entry => entry.presenceMode), limit),
    captionEndingFamilies: topUnique(entries.map(entry => entry.captionEndingFamily), limit),
    locationClusters: topUnique(entries.map(entry => entry.locationCluster), limit)
  };
}

module.exports = {
  buildSemanticStats,
  compactText,
  extractSemanticEntry,
  firstLine,
  inferCaptionEndingFamily,
  normalizeLane,
  readHistoricalSemanticEntries,
  topUnique,
  uniqueStrings
};
