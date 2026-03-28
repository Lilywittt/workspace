const path = require('path');
const { parseArgs } = require('../src/common/runtime');
const {
  collectSignals,
  loadSignalCollectionConfig,
  readPipelineConfig,
  writeSignalCollectionArtifacts
} = require('../src/agent/signal_collection');

async function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config ? path.resolve(args.config) : undefined;
  const collectionConfig = loadSignalCollectionConfig(configPath);
  const pipelineConfig = readPipelineConfig(collectionConfig.legacyPipelineConfigPath);
  const { signals, report } = await collectSignals({
    collectionConfig,
    pipelineConfig
  });
  const output = writeSignalCollectionArtifacts({
    collectionConfig,
    signals,
    report
  });

  console.log(`[signals] updated ${output.signalsPath}`);
  console.log(`[signals] report ${output.reportPath}`);
  console.log(`[signals] active categories: ${signals.collectionCoverage.activeCategories.join(', ') || 'none'}`);
}

main().catch(err => {
  console.error(`[signals] refresh failed: ${err.message}`);
  process.exit(1);
});
