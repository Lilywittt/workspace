const fs = require('fs');
const path = require('path');
const {
  buildFinalDelivery,
  buildImageDiagnosisReportText
} = require('./lib/final_delivery');
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

function writeText(filePath, text, options = {}) {
  const { bom = false } = options;
  ensureDir(path.dirname(filePath));
  const content = `${bom ? '\uFEFF' : ''}${String(text || '')}`;
  fs.writeFileSync(filePath, content, 'utf8');
}

function normalizeHostPath(value = '') {
  return String(value || '').trim().replace(/\//g, '\\');
}

function resolveSharedSourcePath(sourcePath, hostProjectDir, localProjectDir) {
  const normalizedSource = String(sourcePath || '').trim();
  if (!normalizedSource) {
    return '';
  }
  if (fs.existsSync(normalizedSource)) {
    return normalizedSource;
  }

  const normalizedHostProjectDir = normalizeHostPath(hostProjectDir);
  const normalizedWindowsSource = normalizeHostPath(normalizedSource);
  if (
    normalizedHostProjectDir
    && /^[A-Za-z]:\\/.test(normalizedWindowsSource)
    && normalizedWindowsSource.toLowerCase().startsWith(normalizedHostProjectDir.toLowerCase())
  ) {
    const relative = normalizedWindowsSource
      .slice(normalizedHostProjectDir.length)
      .replace(/^[\\/]+/, '');
    const candidate = path.join(localProjectDir, ...relative.split(/[\\/]+/));
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return normalizedSource;
}

function toHostProjectPath(filePath, hostProjectDir, localProjectDir) {
  const normalizedFilePath = String(filePath || '').trim();
  if (!normalizedFilePath) {
    return '';
  }
  if (!hostProjectDir) {
    return normalizedFilePath;
  }

  const localRoot = path.resolve(localProjectDir);
  const localFile = path.resolve(normalizedFilePath);
  if (!localFile.startsWith(localRoot)) {
    return normalizedFilePath;
  }

  const relative = path.relative(localRoot, localFile);
  return path.win32.join(normalizeHostPath(hostProjectDir), ...relative.split(path.sep));
}

function copyImageIfPresent(sourcePath, targetDir, hostProjectDir, localProjectDir) {
  const accessibleSource = resolveSharedSourcePath(sourcePath, hostProjectDir, localProjectDir);
  if (!accessibleSource || !fs.existsSync(accessibleSource)) {
    return '';
  }
  ensureDir(targetDir);
  const targetPath = path.join(targetDir, path.basename(accessibleSource));
  fs.copyFileSync(accessibleSource, targetPath);
  return targetPath;
}

function attachReviewBundle(delivery, {
  reviewRootDir,
  reviewGuidePath,
  promptDiagnosisPath,
  finalDeliveryPath,
  runSummaryPath
}) {
  return {
    ...delivery,
    reviewBundle: {
      rootDir: reviewRootDir,
      reviewGuidePath,
      promptDiagnosisPath,
      debugRunSummaryPath: runSummaryPath,
      suggestedReviewOrder: [
        promptDiagnosisPath,
        finalDeliveryPath,
        delivery?.caption?.fullTextPath || '',
        delivery?.image?.localFilePath || ''
      ].filter(Boolean)
    }
  };
}

function buildReviewGuideText(delivery) {
  const blockers = Array.isArray(delivery?.deliveryReadiness?.blockers) && delivery.deliveryReadiness.blockers.length > 0
    ? delivery.deliveryReadiness.blockers.join(', ')
    : 'none';

  const zh = {
    title: '\u6700\u7ec8\u9a8c\u6536\u6307\u5f15',
    reviewRoot: '\u9a8c\u6536\u6839\u76ee\u5f55',
    publishable: '\u662f\u5426\u53ef\u53d1\u5e03',
    readiness: '\u51c6\u5907\u5ea6',
    releaseStage: '\u53d1\u5e03\u9636\u6bb5',
    blockers: '\u963b\u585e\u9879',
    openOrder: '\u6309\u4ee5\u4e0b\u987a\u5e8f\u6253\u5f00\uff1a',
    debugOnly: '\u4ee5\u4e0b\u8def\u5f84\u4ec5\u7528\u4e8e\u8c03\u8bd5\uff1a'
  };

  const debugPaths = [
    delivery?.reviewBundle?.debugRunSummaryPath || '',
    delivery?.source?.postPackagePath || '',
    delivery?.source?.generatedImagePath || '',
    delivery?.source?.publishResultPath || ''
  ].filter(Boolean);

  return [
    'IG Roleplay V2 Final Review Guide',
    `IG Roleplay V2 ${zh.title}`,
    '',
    `Review root: ${delivery?.reviewBundle?.rootDir || ''}`,
    `${zh.reviewRoot}: ${delivery?.reviewBundle?.rootDir || ''}`,
    `Publishable: ${Boolean(delivery?.deliveryReadiness?.publishable)}`,
    `${zh.publishable}: ${Boolean(delivery?.deliveryReadiness?.publishable)}`,
    `Readiness: ${delivery?.deliveryReadiness?.readiness || 'unknown'}`,
    `${zh.readiness}: ${delivery?.deliveryReadiness?.readiness || 'unknown'}`,
    `Release stage: ${delivery?.deliveryReadiness?.releaseStage || 'unknown'}`,
    `${zh.releaseStage}: ${delivery?.deliveryReadiness?.releaseStage || 'unknown'}`,
    `Blockers: ${blockers}`,
    `${zh.blockers}: ${blockers}`,
    '',
    'Open in this order:',
    zh.openOrder,
    ...((delivery?.reviewBundle?.suggestedReviewOrder || []).map((item, index) => `${index + 1}. ${item}`)),
    '',
    'Use for debugging only:',
    zh.debugOnly,
    ...(debugPaths.length > 0 ? debugPaths.map(item => `- ${item}`) : ['- none'])
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJson(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const localProjectDir = path.resolve(__dirname, '..');
  const hostProjectDir = normalizeHostPath(args['host-project-dir'] || '');
  const currentDir = runtimeCurrentDir(runtimeDir);
  const finalCurrentDir = runtimeFinalCurrentDir(runtimeDir);
  const finalHistoryRoot = runtimeFinalHistoryDir(runtimeDir);

  const scenePlan = readJson(path.join(currentDir, 'scene_plan.json'), null);
  const selectedCaption = readJson(path.join(currentDir, 'selected_caption.json'), null);
  const generatedImage = readJson(path.join(currentDir, 'generated_image.json'), null);
  const postPackage = readJson(path.join(currentDir, 'post_package.json'), null);
  const publishResult = readJson(path.join(currentDir, 'publish_result.json'), {});
  const momentPackage = readJson(path.join(currentDir, 'moment_package.json'), {});
  const imageRequest = readJson(path.join(currentDir, 'image_request.json'), {});
  const validation = readJson(path.join(currentDir, 'zero_memory_pipeline_validation.json'), {});

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

  const imageCurrentPath = copyImageIfPresent(generatedImage.localFilePath, finalCurrentDir, hostProjectDir, localProjectDir);
  const imageHistoryPath = copyImageIfPresent(generatedImage.localFilePath, historyDir, hostProjectDir, localProjectDir);
  const runSummaryPath = path.join(currentDir, 'run_summary.json');
  const currentPath = path.join(finalCurrentDir, 'final_delivery.json');
  const historyPath = path.join(historyDir, 'final_delivery.json');
  const reviewGuideCurrentPath = path.join(finalCurrentDir, 'review_guide.txt');
  const reviewGuideHistoryPath = path.join(historyDir, 'review_guide.txt');
  const diagnosisCurrentPath = path.join(finalCurrentDir, 'image_diagnosis.md');
  const diagnosisHistoryPath = path.join(historyDir, 'image_diagnosis.md');

  const sourcePaths = {
    scenePlanPath: toHostProjectPath(path.join(currentDir, 'scene_plan.json'), hostProjectDir, localProjectDir),
    selectedMomentPath: toHostProjectPath(path.join(currentDir, 'selected_moment.json'), hostProjectDir, localProjectDir),
    momentPackagePath: toHostProjectPath(path.join(currentDir, 'moment_package.json'), hostProjectDir, localProjectDir),
    imageRequestPath: toHostProjectPath(path.join(currentDir, 'image_request.json'), hostProjectDir, localProjectDir),
    validationPath: toHostProjectPath(path.join(currentDir, 'zero_memory_pipeline_validation.json'), hostProjectDir, localProjectDir),
    postPackagePath: toHostProjectPath(path.join(currentDir, 'post_package.json'), hostProjectDir, localProjectDir),
    generatedImagePath: toHostProjectPath(path.join(currentDir, 'generated_image.json'), hostProjectDir, localProjectDir),
    publishResultPath: toHostProjectPath(path.join(currentDir, 'publish_result.json'), hostProjectDir, localProjectDir),
    runSummaryPath: toHostProjectPath(runSummaryPath, hostProjectDir, localProjectDir)
  };

  const currentDeliveryBase = buildFinalDelivery({
    config,
    deliveryId,
    scenePlan,
    selectedCaption,
    generatedImage,
    momentPackage,
    imageRequest,
    validation,
    postPackage,
    publishResult,
    captionTextPath: toHostProjectPath(captionCurrentPath, hostProjectDir, localProjectDir),
    imagePath: toHostProjectPath(imageCurrentPath, hostProjectDir, localProjectDir),
    sourcePaths
  });
  const historyDeliveryBase = buildFinalDelivery({
    config,
    deliveryId,
    scenePlan,
    selectedCaption,
    generatedImage,
    momentPackage,
    imageRequest,
    validation,
    postPackage,
    publishResult,
    captionTextPath: toHostProjectPath(captionHistoryPath, hostProjectDir, localProjectDir),
    imagePath: toHostProjectPath(imageHistoryPath, hostProjectDir, localProjectDir),
    sourcePaths
  });

  const currentDelivery = attachReviewBundle(currentDeliveryBase, {
    reviewRootDir: toHostProjectPath(finalCurrentDir, hostProjectDir, localProjectDir),
    reviewGuidePath: toHostProjectPath(reviewGuideCurrentPath, hostProjectDir, localProjectDir),
    promptDiagnosisPath: toHostProjectPath(diagnosisCurrentPath, hostProjectDir, localProjectDir),
    finalDeliveryPath: toHostProjectPath(currentPath, hostProjectDir, localProjectDir),
    runSummaryPath: toHostProjectPath(runSummaryPath, hostProjectDir, localProjectDir)
  });
  const historyDelivery = attachReviewBundle(historyDeliveryBase, {
    reviewRootDir: toHostProjectPath(historyDir, hostProjectDir, localProjectDir),
    reviewGuidePath: toHostProjectPath(reviewGuideHistoryPath, hostProjectDir, localProjectDir),
    promptDiagnosisPath: toHostProjectPath(diagnosisHistoryPath, hostProjectDir, localProjectDir),
    finalDeliveryPath: toHostProjectPath(historyPath, hostProjectDir, localProjectDir),
    runSummaryPath: toHostProjectPath(runSummaryPath, hostProjectDir, localProjectDir)
  });
  currentDelivery.diagnostics.promptToImage.reportPath = toHostProjectPath(diagnosisCurrentPath, hostProjectDir, localProjectDir);
  historyDelivery.diagnostics.promptToImage.reportPath = toHostProjectPath(diagnosisHistoryPath, hostProjectDir, localProjectDir);

  writeText(diagnosisCurrentPath, buildImageDiagnosisReportText(currentDelivery), { bom: true });
  writeText(diagnosisHistoryPath, buildImageDiagnosisReportText(historyDelivery), { bom: true });
  writeText(reviewGuideCurrentPath, buildReviewGuideText(currentDelivery), { bom: true });
  writeText(reviewGuideHistoryPath, buildReviewGuideText(historyDelivery), { bom: true });
  writeJson(currentPath, currentDelivery);
  writeJson(historyPath, historyDelivery);

  console.log(`final delivery created: ${currentPath}`);
  console.log(`final delivery archived: ${historyPath}`);
  console.log(`final delivery review guide: ${reviewGuideCurrentPath}`);
  console.log(`final delivery publishable: ${currentDelivery.deliveryReadiness.publishable}`);
}

main();
