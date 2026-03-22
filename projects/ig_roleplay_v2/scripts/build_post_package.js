const path = require('path');
const { buildPostPackage } = require('./lib/post_package');
const {
  parseArgs,
  readJson,
  resolveRelative,
  runtimeCurrentDir,
  writeRuntimeArtifact
} = require('./lib/runtime');

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJson(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const legacyDataDir = resolveRelative(configPath, (config.paths && config.paths.legacyDataDir) || '../../../data/ig_roleplay');
  const currentDir = runtimeCurrentDir(runtimeDir);

  const scenePlan = readJson(path.join(currentDir, 'scene_plan.json'), null);
  const selectedMoment = readJson(path.join(currentDir, 'selected_moment.json'), null);
  const selectedCaption = readJson(path.join(currentDir, 'selected_caption.json'), null);
  const generatedImage = readJson(path.join(currentDir, 'generated_image.json'), null);
  const imageRequest = readJson(path.join(currentDir, 'image_request.json'), null);
  const externalEventPacket = readJson(path.join(currentDir, 'external_event_packet.json'), null);
  const selectedImage = readJson(path.join(legacyDataDir, 'selected_image.json'), {});

  if (!scenePlan || !selectedCaption) {
    throw new Error('scene_plan.json or selected_caption.json is missing');
  }

  const output = buildPostPackage({
    config,
    scenePlan,
    selectedMoment,
    selectedCaption,
    generatedImage,
    imageRequest,
    externalEventPacket,
    selectedImage
  });
  const written = writeRuntimeArtifact(runtimeDir, 'post_package.json', 'postpackage', output);

  console.log(`post package created: ${written.currentPath}`);
  console.log(`post package archived: ${written.archivedPath}`);
}

main();
