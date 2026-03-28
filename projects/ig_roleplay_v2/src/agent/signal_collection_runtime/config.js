const path = require('path');

const {
  readJsonOptional,
  resolveRelative
} = require('../../common/runtime');
const { DEFAULT_LIMITS, buildDateLabel, compactText } = require('./shared');

function defaultSignalCollectionConfigPath() {
  return path.resolve(__dirname, '..', '..', '..', 'config', 'runtime', 'signal_collection.config.json');
}

function loadSignalCollectionConfig(configPath = defaultSignalCollectionConfigPath()) {
  const config = readJsonOptional(configPath, {});
  const paths = config.paths || {};

  return {
    configPath,
    config,
    version: compactText(config.version || '3.1.0-alpha.1'),
    legacyPipelineConfigPath: resolveRelative(
      configPath,
      paths.legacyPipelineConfigPath || '../../../../data/ig_roleplay/pipeline.config.json'
    ),
    outputSignalsPath: resolveRelative(
      configPath,
      paths.outputSignalsPath || '../../../../data/ig_roleplay/signals.json'
    ),
    outputReportPath: resolveRelative(
      configPath,
      paths.outputReportPath || '../../../../data/ig_roleplay/signal_collection_report.json'
    )
  };
}

function readPipelineConfig(filePath) {
  return readJsonOptional(filePath, {});
}

function normalizeLocation(collectionConfig = {}, pipelineConfig = {}) {
  const fallback = collectionConfig.config?.locationDefaults || {};
  const location = pipelineConfig.location || {};

  return {
    name: compactText(location.name || fallback.name || 'unknown'),
    country: compactText(location.country || fallback.country || ''),
    latitude: Number(location.latitude || fallback.latitude || 0) || null,
    longitude: Number(location.longitude || fallback.longitude || 0) || null,
    timezone: compactText(pipelineConfig.timezone || location.timezone || fallback.timezone || 'Asia/Shanghai'),
    language: compactText(pipelineConfig.language || fallback.language || 'zh')
  };
}

function buildRuntimeContext({
  collectionConfig,
  pipelineConfig,
  now = new Date()
}) {
  return {
    now: new Date(now),
    date: buildDateLabel(now),
    version: compactText(collectionConfig?.version || '3.1.0-alpha.1'),
    location: normalizeLocation(collectionConfig, pipelineConfig),
    limits: {
      ...DEFAULT_LIMITS,
      ...(collectionConfig.config?.limits || {})
    }
  };
}

function buildEmptySignals(runtimeContext) {
  return {
    date: runtimeContext.date,
    collectedAt: runtimeContext.now.toISOString(),
    location: {
      name: runtimeContext.location.name,
      country: runtimeContext.location.country || null,
      latitude: runtimeContext.location.latitude,
      longitude: runtimeContext.location.longitude,
      timezone: runtimeContext.location.timezone
    },
    weather: null,
    airQuality: null,
    animeFandom: [],
    news: [],
    trends: [],
    localEvents: [],
    popCulture: [],
    socialChatter: [],
    externalSignals: [],
    sourceHealth: [],
    collectionCoverage: {
      activeCategories: [],
      categoryCounts: {},
      healthySources: [],
      degradedSources: [],
      failedSources: []
    },
    notes: []
  };
}

module.exports = {
  buildEmptySignals,
  buildRuntimeContext,
  defaultSignalCollectionConfigPath,
  loadSignalCollectionConfig,
  normalizeLocation,
  readPipelineConfig
};
