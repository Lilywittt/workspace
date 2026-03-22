const fs = require('fs');
const path = require('path');
const { buildFinalDelivery } = require('./lib/final_delivery');
const {
  buildRunStamp,
  ensureDir,
  parseArgs,
  readJson,
  resolveRelative,
  runtimeCurrentDir,
  runtimeFinalCurrentDir,
  runtimeFinalHistoryDir
} = require('./lib/runtime');

function resetDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, String(text || ''), 'utf8');
}

function copyImageIfPresent(sourcePath, targetDir) {
  const normalizedSource = String(sourcePath || '').trim();
  if (!normalizedSource || !fs.existsSync(normalizedSource)) {
    return '';
  }
  ensureDir(targetDir);
  const targetPath = path.join(targetDir, path.basename(normalizedSource));
  fs.copyFileSync(normalizedSource, targetPath);
  return targetPath;
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJson(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const currentDir = runtimeCurrentDir(runtimeDir);
  const finalCurrentDir = runtimeFinalCurrentDir(runtimeDir);
  const finalHistoryRoot = runtimeFinalHistoryDir(runtimeDir);

  const scenePlan = readJson(path.join(currentDir, 'scene_plan.json'), null);
  const selectedCaption = readJson(path.join(currentDir, 'selected_caption.json'), null);
  const generatedImage = readJson(path.join(currentDir, 'generated_image.json'), null);
  const postPackage = readJson(path.join(currentDir, 'post_package.json'), null);
  const publishResult = readJson(path.join(currentDir, 'publish_result.json'), {});

  if (!scenePlan || !selectedCaption || !postPackage || !generatedImage) {
    throw new Error('scene_plan.json, selected_caption.json, post_package.json, or generated_image.json is missing');
  }

  const deliveryId = args['delivery-id']
    || `finaldelivery-${buildRunStamp()}-${String(scenePlan.runId || 'scene').replace(/[^a-zA-Z0-9_-]+/g, '_')}`;
  const historyDir = path.join(finalHistoryRoot, deliveryId);

  resetDir(finalCurrentDir);
  ensureDir(historyDir);

  const captionCurrentPath = path.join(finalCurrentDir, 'caption.txt');
  const captionHistoryPath = path.join(historyDir, 'caption.txt');
  const fullCaptionText = String(postPackage.fullCaptionText || '').trim();
  writeText(captionCurrentPath, fullCaptionText);
  writeText(captionHistoryPath, fullCaptionText);

  const imageCurrentPath = copyImageIfPresent(generatedImage.localFilePath, finalCurrentDir);
  const imageHistoryPath = copyImageIfPresent(generatedImage.localFilePath, historyDir);

  const sourcePaths = {
    postPackagePath: path.join(currentDir, 'post_package.json'),
    generatedImagePath: path.join(currentDir, 'generated_image.json'),
    publishResultPath: path.join(currentDir, 'publish_result.json')
  };

  const currentDelivery = buildFinalDelivery({
    config,
    deliveryId,
    scenePlan,
    selectedCaption,
    generatedImage,
    postPackage,
    publishResult,
    captionTextPath: captionCurrentPath,
    imagePath: imageCurrentPath,
    sourcePaths
  });
  const historyDelivery = buildFinalDelivery({
    config,
    deliveryId,
    scenePlan,
    selectedCaption,
    generatedImage,
    postPackage,
    publishResult,
    captionTextPath: captionHistoryPath,
    imagePath: imageHistoryPath,
    sourcePaths
  });

  const currentPath = path.join(finalCurrentDir, 'final_delivery.json');
  const historyPath = path.join(historyDir, 'final_delivery.json');
  writeJson(currentPath, currentDelivery);
  writeJson(historyPath, historyDelivery);

  console.log(`final delivery created: ${currentPath}`);
  console.log(`final delivery archived: ${historyPath}`);
  console.log(`final delivery publishable: ${currentDelivery.deliveryReadiness.publishable}`);
}

main();
