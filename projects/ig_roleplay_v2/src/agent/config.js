const path = require('path');
const {
  readJsonOptional,
  resolveRelative
} = require('../common/runtime');

function defaultConfigPath() {
  return path.resolve(__dirname, '..', '..', 'config', 'runtime', 'agent_runtime.config.json');
}

function loadAgentConfig(configPath = defaultConfigPath()) {
  const config = readJsonOptional(configPath, {});
  const paths = config.paths || {};
  return {
    configPath,
    config,
    version: config.version || '3.0.0-alpha.1',
    runtimeDir: resolveRelative(configPath, paths.runtimeDir || '../../runtime'),
    legacySignalsPath: resolveRelative(configPath, paths.legacySignalsPath || '../../../../data/ig_roleplay/signals.json'),
    legacyDataDir: resolveRelative(configPath, paths.legacyDataDir || '../../../../data/ig_roleplay'),
    characterEditableDir: resolveRelative(configPath, paths.characterEditableDir || '../../character/editable'),
    characterCompiledDir: resolveRelative(configPath, paths.characterCompiledDir || '../../character/compiled'),
    worldFactsPath: resolveRelative(configPath, paths.worldFactsPath || '../world/world_facts.json'),
    manualExternalEventsPath: resolveRelative(configPath, paths.manualExternalEventsPath || '../world/manual_external_events.json'),
    imageStyleProfilePath: resolveRelative(configPath, paths.imageStyleProfilePath || '../render/image_style_profile.json'),
    referenceLibraryPath: resolveRelative(configPath, paths.referenceLibraryPath || '../../vision/reference_library.json'),
    generationPolicyPath: resolveRelative(configPath, paths.generationPolicyPath || '../policies/agent_generation_policy.json'),
    creativeModelPath: resolveRelative(configPath, paths.creativeModelPath || '../creative_model.json')
  };
}

module.exports = {
  defaultConfigPath,
  loadAgentConfig
};
