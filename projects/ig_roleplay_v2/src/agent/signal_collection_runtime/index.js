const fs = require('fs');
const path = require('path');

const { ensureDir } = require('../../common/runtime');
const {
  addHealthRecord,
  compactText,
  dedupeEntries,
  normalizeSource,
  parseHtmlListItems,
  uniqueStrings
} = require('./shared');
const {
  buildEmptySignals,
  buildRuntimeContext,
  defaultSignalCollectionConfigPath,
  loadSignalCollectionConfig,
  readPipelineConfig
} = require('./config');
const {
  applySourcePostprocess,
  createSourcePostprocessRegistry
} = require('./postprocess');
const { collectorForSource, createCollectorRegistry } = require('./registry');

const ENTRY_COLLECTIONS = [
  'animeFandom',
  'news',
  'localEvents',
  'popCulture',
  'socialChatter',
  'externalSignals'
];

const COVERAGE_COUNTERS = {
  weather: signals => (signals.weather ? 1 : 0),
  airQuality: signals => (signals.airQuality && !signals.airQuality.error ? 1 : 0),
  animeFandom: signals => (signals.animeFandom || []).length,
  news: signals => (signals.news || []).length,
  trends: signals => (signals.trends || []).length,
  localEvents: signals => (signals.localEvents || []).length,
  popCulture: signals => (signals.popCulture || []).length,
  socialChatter: signals => (signals.socialChatter || []).length,
  externalSignals: signals => (signals.externalSignals || []).length
};

const REPORT_SAMPLE_READERS = {
  animeFandom: signals => (signals.animeFandom || []).slice(0, 4).map(item => item.text || item.title),
  trends: signals => (signals.trends || []).slice(0, 4),
  localEvents: signals => (signals.localEvents || []).slice(0, 3).map(item => item.text || item.title),
  popCulture: signals => (signals.popCulture || []).slice(0, 3).map(item => item.text || item.title),
  socialChatter: signals => (signals.socialChatter || []).slice(0, 3).map(item => item.text || item.title)
};

function pushSourceHealth(records, record = {}) {
  addHealthRecord(records, {
    fetchedAt: new Date().toISOString(),
    latencyMs: 0,
    ...record
  });
}

function mergeSourceOutput(accumulator, output = {}, runtimeContext) {
  if (output.resolvedLocation) {
    accumulator.location = {
      ...accumulator.location,
      ...output.resolvedLocation
    };
  }
  if (output.weather) accumulator.weather = output.weather;
  if (output.airQuality) accumulator.airQuality = output.airQuality;

  for (const category of ENTRY_COLLECTIONS) {
    accumulator[category] = dedupeEntries(
      [...accumulator[category], ...(output[category] || [])],
      runtimeContext.limits[category]
    );
  }

  accumulator.trends = uniqueStrings(
    [...accumulator.trends, ...(output.trends || [])],
    runtimeContext.limits.trends
  );
  (output.sourceHealth || []).forEach(record => addHealthRecord(accumulator.sourceHealth, record));
  accumulator.notes = uniqueStrings([
    ...accumulator.notes,
    ...(output.notes || [])
  ], 16);
}

function buildCollectionCoverage(signals = {}) {
  const categoryCounts = Object.fromEntries(
    Object.entries(COVERAGE_COUNTERS).map(([categoryName, counter]) => [
      categoryName,
      Number(counter(signals) || 0)
    ])
  );

  return {
    activeCategories: Object.entries(categoryCounts)
      .filter(([, count]) => count > 0)
      .map(([name]) => name),
    categoryCounts,
    healthySources: (signals.sourceHealth || [])
      .filter(item => item.status === 'ok')
      .map(item => item.sourceId),
    degradedSources: (signals.sourceHealth || [])
      .filter(item => item.status === 'degraded')
      .map(item => item.sourceId),
    failedSources: (signals.sourceHealth || [])
      .filter(item => item.status === 'error')
      .map(item => item.sourceId)
  };
}

function buildCollectionReport(signals = {}, runtimeContext = {}) {
  return {
    version: compactText(runtimeContext.version || '3.1.0-alpha.1'),
    collectedAt: signals.collectedAt || new Date().toISOString(),
    location: signals.location || {},
    coverage: signals.collectionCoverage || buildCollectionCoverage(signals),
    sourceHealth: signals.sourceHealth || [],
    samples: Object.fromEntries(
      Object.entries(REPORT_SAMPLE_READERS).map(([categoryName, reader]) => [
        categoryName,
        reader(signals)
      ])
    ),
    notes: uniqueStrings([
      ...(signals.notes || []),
      `Collector location: ${compactText(runtimeContext.location?.name || 'unknown')}`
    ], 16)
  };
}

async function collectSignals({
  collectionConfig,
  pipelineConfig,
  fetchImpl = fetch,
  now = new Date(),
  registry = null,
  postprocess = null
}) {
  const runtimeContext = buildRuntimeContext({
    collectionConfig,
    pipelineConfig,
    now
  });
  const signals = buildEmptySignals(runtimeContext);
  const normalizedSources = (collectionConfig.config?.sources || [])
    .map((source, index) => normalizeSource(source, index));
  const registryApi = Array.isArray(registry)
    ? createCollectorRegistry(registry)
    : (registry || { collectorForSource });
  const postprocessApi = postprocess && !Array.isArray(postprocess) && typeof postprocess.applySourcePostprocess === 'function'
    ? postprocess
    : Array.isArray(postprocess)
      ? createSourcePostprocessRegistry(postprocess)
      : { applySourcePostprocess };

  for (const source of normalizedSources) {
    if (!source.enabled) {
      pushSourceHealth(signals.sourceHealth, {
        sourceId: source.id,
        kind: source.kind,
        sourceLabel: source.sourceLabel,
        status: 'degraded',
        itemCount: 0,
        categories: [source.category].filter(Boolean),
        note: 'Source is currently disabled.'
      });
      continue;
    }

    const collector = registryApi.collectorForSource(source);
    if (!collector) {
      pushSourceHealth(signals.sourceHealth, {
        sourceId: source.id,
        kind: source.kind,
        sourceLabel: source.sourceLabel,
        status: 'error',
        itemCount: 0,
        categories: [source.category].filter(Boolean),
        note: `Unsupported source kind: ${source.kind}`
      });
      continue;
    }

    try {
      const output = await collector(source, runtimeContext, fetchImpl);
      const cleanedOutput = postprocessApi.applySourcePostprocess({
        source,
        output,
        runtimeContext
      });
      mergeSourceOutput(signals, cleanedOutput, runtimeContext);
    } catch (err) {
      pushSourceHealth(signals.sourceHealth, {
        sourceId: source.id,
        kind: source.kind,
        sourceLabel: source.sourceLabel,
        status: 'error',
        itemCount: 0,
        categories: [source.category].filter(Boolean),
        note: err.message
      });
      signals.notes = uniqueStrings([
        ...signals.notes,
        `${source.id}: ${err.message}`
      ], 16);
    }
  }

  signals.collectionCoverage = buildCollectionCoverage(signals);
  if (signals.weather && signals.collectionCoverage.activeCategories.length === 1) {
    signals.notes = uniqueStrings([
      ...signals.notes,
      'Only weather-class signals are currently active, so topical diversity will still be narrow.'
    ], 16);
  }

  return {
    signals,
    report: buildCollectionReport(signals, runtimeContext),
    runtimeContext
  };
}

function writeSignalCollectionArtifacts({
  collectionConfig,
  signals,
  report
}) {
  ensureDir(path.dirname(collectionConfig.outputSignalsPath));
  ensureDir(path.dirname(collectionConfig.outputReportPath));
  fs.writeFileSync(collectionConfig.outputSignalsPath, JSON.stringify(signals, null, 2), 'utf8');
  fs.writeFileSync(collectionConfig.outputReportPath, JSON.stringify(report, null, 2), 'utf8');

  return {
    signalsPath: collectionConfig.outputSignalsPath,
    reportPath: collectionConfig.outputReportPath
  };
}

module.exports = {
  buildCollectionCoverage,
  buildCollectionReport,
  buildRuntimeContext,
  collectSignals,
  createCollectorRegistry,
  createSourcePostprocessRegistry,
  defaultSignalCollectionConfigPath,
  loadSignalCollectionConfig,
  parseHtmlListItems,
  readPipelineConfig,
  writeSignalCollectionArtifacts
};
