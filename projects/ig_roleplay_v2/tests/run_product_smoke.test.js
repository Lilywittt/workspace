const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');

const projectDir = path.resolve(__dirname, '..');
const tempRootBase = path.join(projectDir, '.tmp');
const powershellExe = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function buildDockerMockScript() {
  return `
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectDir = process.env.RUN_PRODUCT_MOCK_PROJECT_DIR;
const containerProjectDir = '/home/node/.openclaw/workspace/projects/ig_roleplay_v2';
const runtimeHelpers = require(path.join(projectDir, 'scripts', 'lib', 'runtime'));

function toHostPath(value) {
  if (typeof value !== 'string') {
    return value;
  }
  if (!value.startsWith(containerProjectDir)) {
    return value;
  }
  const relative = value.slice(containerProjectDir.length).replace(/^\\/+/, '');
  return path.join(projectDir, ...relative.split('/'));
}

function parseArg(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return '';
  }
  return args[index + 1];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveRuntimeDirFromConfig(configPath) {
  const config = readJson(configPath);
  return runtimeHelpers.resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
}

function writeRuntimeArtifact(runtimeDir, runId, fileName, value) {
  runtimeHelpers.writeRuntimeArtifact(runtimeDir, fileName, 'zeromemory', value, { runId });
}

function seedSignals(configPath) {
  const config = readJson(configPath);
  const signalsPath = runtimeHelpers.resolveRelative(configPath, config.paths.outputSignalsPath);
  const reportPath = runtimeHelpers.resolveRelative(configPath, config.paths.outputReportPath);
  runtimeHelpers.ensureDir(path.dirname(signalsPath));
  runtimeHelpers.ensureDir(path.dirname(reportPath));
  fs.writeFileSync(signalsPath, JSON.stringify({
    collectedAt: new Date().toISOString(),
    collectionCoverage: {
      activeCategories: ['weather'],
      categoryCounts: { weather: 1 }
    }
  }, null, 2), 'utf8');
  fs.writeFileSync(reportPath, JSON.stringify({
    collectedAt: new Date().toISOString(),
    coverage: {
      activeCategories: ['weather']
    }
  }, null, 2), 'utf8');
}

function seedZeroMemoryRun(configPath) {
  const runtimeDir = resolveRuntimeDirFromConfig(configPath);
  const runId = 'zeromemory-smoke-2026-03-28T00-00-00';
  const stamp = new Date().toISOString();

  const artifact = (value = {}) => ({
    version: '3.0.0-alpha.1',
    createdAt: stamp,
    runId,
    ...value
  });

  writeRuntimeArtifact(runtimeDir, runId, 'scene_plan.json', artifact({
    lane: 'life_record',
    narrative: {
      premise: '放学后站在便利店门口，被自动门卷出来的冷风拍了一下。'
    }
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'selected_moment.json', artifact({
    placeRef: 'convenience_store_entrance',
    routineRef: 'after_class',
    selectionMode: 'grounded_review',
    eventSummaryZh: '放学后经过便利店，自动门刚开，门口的冷风比外面还明显。',
    selectionReasonZh: '这个瞬间足够具体，也真的会让人想顺手发一条。 ',
    characterPresenceTarget: 'supporting_presence'
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'selected_caption.json', artifact({
    selectedAt: stamp,
    selectedCandidateId: 'caption_02',
    candidatePlanSlot: 'caption_02',
    candidatePostingAct: 'timing_note',
    selectionReason: '这条最像她会直接发出来的句子。',
    caption: '放学后想买点热的，结果在便利店门口先被冷风偷袭。',
    hashtags: ['#放学后', '#便利店门口']
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'moment_package.json', artifact({
    livedEvent: {
      summaryZh: '她在便利店门口停了一下，被自动门带出来的冷风撞到。'
    },
    postIntent: {
      whyShareableZh: '因为这就是一个会让人下意识想吐槽一句的小瞬间。'
    },
    outfit: {
      sourceMode: 'persona_policy_default',
      manualOverrideApplied: false,
      outfitSummaryEn: 'grey cardigan over school shirt with pleated skirt',
      promptCuesEn: ['grey cardigan', 'school shirt collar', 'pleated skirt'],
      weatherResponseEn: 'a light knit layer keeps the outfit believable for a cool rainy day',
      sceneFitEn: 'fits an after-school stop at a neighborhood convenience store'
    }
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'image_request.json', artifact({
    generationMode: 'anime_close_crop_trace_lived_moment',
    status: 'generation_request_ready',
    renderPlan: {
      aspectRatio: '4:5',
      candidateCount: 1
    },
    publishHints: {
      altText: '放学后的便利店门口，女孩刚被自动门带出的冷风扑了一下。'
    },
    reviewSignals: {
      characterPresenceTarget: 'supporting_presence',
      captureSummaryEn: 'close observational framing at the convenience-store entrance',
      renderStyleSummaryEn: 'clean crisp anime linework',
      unresolvedIdentityReference: false
    },
    referencePlan: {
      unresolvedReferenceIds: [],
      placeholderReferenceIds: []
    },
    references: [],
    promptPackage: {
      positivePrompt: 'Convenience-store entrance after class, rainy air, a girl pausing as cold air spills from the opening door.',
      negativePrompt: 'poster framing, extra photographer, empty street with no moment cue',
      promptBlocks: {
        context: 'convenience-store entrance, rainy light, damp air, routine after_class'
      }
    }
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'zero_memory_pipeline_validation.json', artifact({
    stageSources: {
      outfitPlanning: {
        mode: 'llm',
        promptName: 'outfit-resolver-agent',
        error: ''
      }
    }
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'content_intent.json', artifact({
    lane: 'life_record',
    characterPresenceTarget: 'supporting_presence',
    sourceMode: 'ambient_grounded'
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'capture_intent.json', artifact({
    lane: 'life_record',
    sourceMode: 'selected_moment',
    summaryEn: 'observational camera relation, medium-close distance'
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'outfit_intent.json', artifact({
    sourceMode: 'persona_policy_default',
    manualOverrideProvided: false
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'outfit_plan.json', artifact({
    sourceMode: 'persona_policy_default',
    outfitSummaryEn: 'grey cardigan over school shirt with pleated skirt',
    weatherResponseEn: 'light knit layer fits a rainy cool day',
    sceneFitEn: 'appropriate for after-school convenience-store stop'
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'image_intent.json', artifact({
    imageMode: 'trace_led_life_record',
    characterPresenceTarget: 'supporting_presence',
    captureSummaryEn: 'close observational framing at the convenience-store entrance'
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'image_style_profile.json', artifact({
    profileId: 'daily_clean_crisp'
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'day_context.json', artifact({
    date: { isoDate: '2026-03-28' },
    time: { routineWindow: 'after_class' },
    weather: { summary: 'cool rainy afternoon' },
    location: { currentContext: 'convenience-store entrance' }
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'ambient_signal_pool.json', artifact({
    items: [{ id: 'weather-rain' }]
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'ambient_stimulus_packet.json', artifact({
    items: [{ id: 'door-wind' }],
    categoriesRepresented: ['weather']
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'character_runtime_snapshot.json', artifact({
    currentState: {
      mood: 'slightly chilled but amused'
    },
    postingTendency: {
      preferredLane: 'life_record',
      whyPostToday: 'The cold-air surprise felt immediate and shareable.'
    }
  }));
  writeRuntimeArtifact(runtimeDir, runId, 'external_event_packet.json', artifact({
    activeEventIds: [],
    worldStateNotes: []
  }));
}

function runNodeScript(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: projectDir,
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }
  process.exit(result.status == null ? 1 : result.status);
}

const shellCommand = String(process.argv[process.argv.length - 1] || '')
  .replace(/^export LANG=C\\.UTF-8 LC_ALL=C\\.UTF-8;\\s*/, '')
  .trim();

if (!shellCommand.startsWith('node ')) {
  process.exit(0);
}

const parts = shellCommand.split(/\\s+/).map(toHostPath);
const scriptPath = parts[1];
const args = parts.slice(2);
const scriptName = path.basename(scriptPath);

if (scriptName === 'refresh_signals.js') {
  const configPath = parseArg(args, '--config');
  if (configPath) {
    seedSignals(configPath);
  }
  process.exit(0);
}

if (scriptName === 'run_zero_memory_agent.js') {
  const configPath = parseArg(args, '--config');
  seedZeroMemoryRun(configPath);
  process.exit(0);
}

runNodeScript(scriptPath, args);
`;
}

function buildPowershellMockScript() {
  return `
const fs = require('fs');
const path = require('path');

const projectDir = process.env.RUN_PRODUCT_MOCK_PROJECT_DIR;
const runtimeHelpers = require(path.join(projectDir, 'scripts', 'lib', 'runtime'));

function parseArg(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return '';
  }
  return args[index + 1];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveRuntimeDir(configPath) {
  const config = readJson(configPath);
  return runtimeHelpers.resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
}

const args = process.argv.slice(2);
const configPath = parseArg(args, '-ConfigPath') || path.join(projectDir, 'config', 'runtime.config.json');
const provider = parseArg(args, '-Provider') || 'aliyun-z-image';
const model = parseArg(args, '-Model') || 'mock-model';
const runtimeDir = resolveRuntimeDir(configPath);
const currentDir = runtimeHelpers.runtimeCurrentDir(runtimeDir);
const scenePlan = readJson(path.join(currentDir, 'scene_plan.json'));
const imageRequest = readJson(path.join(currentDir, 'image_request.json'));
const runDir = path.join(runtimeHelpers.runtimeRunsDir(runtimeDir), scenePlan.runId);
const generatedAssetDir = path.join(runDir, 'generated_assets');
runtimeHelpers.ensureDir(runDir);
runtimeHelpers.ensureDir(generatedAssetDir);
const fileName = 'mock-generated-image.png';
const historyFile = path.join(generatedAssetDir, fileName);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=', 'base64');
fs.writeFileSync(historyFile, png);

const artifact = {
  version: '2.0.0-alpha.1',
  createdAt: new Date().toISOString(),
  scenePlanRunId: scenePlan.runId,
  sourceRequestCreatedAt: imageRequest.createdAt || new Date().toISOString(),
  provider,
  model,
  imageUrl: 'https://example.com/mock-generated-image.png',
  assetId: null,
  remoteJobId: null,
  providerRequestId: 'mock-request-id',
  requestSummary: {
    generationMode: imageRequest.generationMode,
    altText: imageRequest.publishHints && imageRequest.publishHints.altText || '',
    referenceHandling: imageRequest.referencePlan || {},
    promptPackage: imageRequest.promptPackage || {}
  },
  providerRequest: {
    provider,
    endpoint: 'https://mock.example.invalid/image',
    submissionMode: 'mock_local',
    requiredEnv: ['MOCK_IMAGE_PROVIDER'],
    model,
    assetFilenameHint: fileName,
    requestBody: {}
  },
  notes: ['Smoke test mock image artifact generated locally.'],
  status: 'image_ready',
  outputFormat: 'png',
  localFilePath: historyFile,
  latestFilePath: '',
  failureReason: ''
};

runtimeHelpers.writeRuntimeArtifact(runtimeDir, 'generated_image.json', 'generatedimage', artifact, {
  runId: scenePlan.runId
});
`;
}

test('run_product.ps1 simulate keeps a single clean runtime flow and reaches final delivery', { timeout: 120000 }, () => {
  fs.mkdirSync(tempRootBase, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(tempRootBase, 'run-product-smoke-'));
  const binDir = path.join(tempRoot, 'bin');
  fs.mkdirSync(binDir, { recursive: true });

  const runtimeConfigPath = path.join(tempRoot, 'runtime.config.json');
  const agentConfigPath = path.join(tempRoot, 'agent_runtime.config.json');
  const signalConfigPath = path.join(tempRoot, 'signal_collection.config.json');
  const runtimeDir = path.join(tempRoot, 'runtime');
  const finalCurrentDir = path.join(runtimeDir, 'final', 'current');
  const intermediateCurrentDir = path.join(runtimeDir, 'intermediate', 'current');

  const runtimeConfig = readJson(path.join(projectDir, 'config', 'runtime.config.json'));
  runtimeConfig.paths = {
    ...(runtimeConfig.paths || {}),
    runtimeDir: './runtime'
  };
  writeJson(runtimeConfigPath, runtimeConfig);

  const agentConfig = readJson(path.join(projectDir, 'config', 'runtime', 'agent_runtime.config.json'));
  agentConfig.paths = {
    ...(agentConfig.paths || {}),
    runtimeDir: './runtime',
    signalCollectionConfigPath: './signal_collection.config.json'
  };
  writeJson(agentConfigPath, agentConfig);

  const signalConfig = readJson(path.join(projectDir, 'config', 'runtime', 'signal_collection.config.json'));
  signalConfig.paths = {
    ...(signalConfig.paths || {}),
    outputSignalsPath: './signals.json',
    outputReportPath: './signal_collection_report.json'
  };
  writeJson(signalConfigPath, signalConfig);

  const dockerMockJs = path.join(tempRoot, 'docker-mock.js');
  const powershellMockJs = path.join(tempRoot, 'powershell-mock.js');
  writeText(dockerMockJs, buildDockerMockScript());
  writeText(powershellMockJs, buildPowershellMockScript());
  writeText(path.join(binDir, 'docker.cmd'), `@echo off\r\n"${process.execPath}" "${dockerMockJs}" %*\r\n`);
  writeText(path.join(binDir, 'powershell.cmd'), `@echo off\r\n"${process.execPath}" "${powershellMockJs}" %*\r\n`);

  const env = {
    ...process.env,
    PATH: `${binDir};${process.env.PATH}`,
    RUN_PRODUCT_MOCK_PROJECT_DIR: projectDir
  };

  try {
    const result = spawnSync(
      powershellExe,
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(projectDir, 'run_product.ps1'),
        '-Mode',
        'simulate',
        '-RuntimeConfigPath',
        runtimeConfigPath,
        '-AgentConfigPath',
        agentConfigPath
      ],
      {
        cwd: projectDir,
        env,
        encoding: 'utf8',
        timeout: 120000
      }
    );

    assert.equal(
      result.status,
      0,
      `run_product.ps1 failed\nSTDOUT:\n${result.stdout || ''}\nSTDERR:\n${result.stderr || ''}`
    );

    const finalDeliveryPath = path.join(finalCurrentDir, 'final_delivery.json');
    const diagnosisPath = path.join(finalCurrentDir, 'image_diagnosis.md');
    const captionPath = path.join(finalCurrentDir, 'caption.txt');
    const reviewGuidePath = path.join(finalCurrentDir, 'review_guide.txt');
    const publishResultPath = path.join(intermediateCurrentDir, 'publish_result.json');
    const runSummaryPath = path.join(intermediateCurrentDir, 'run_summary.json');

    assert.equal(fs.existsSync(finalDeliveryPath), true, 'final_delivery.json should exist');
    assert.equal(fs.existsSync(diagnosisPath), true, 'image_diagnosis.md should exist');
    assert.equal(fs.existsSync(captionPath), true, 'caption.txt should exist');
    assert.equal(fs.existsSync(reviewGuidePath), true, 'review_guide.txt should exist');
    assert.equal(fs.existsSync(publishResultPath), true, 'publish_result.json should exist');
    assert.equal(fs.existsSync(runSummaryPath), true, 'run_summary.json should exist');

    const finalDelivery = readJson(finalDeliveryPath);
    const publishResult = readJson(publishResultPath);
    const runSummary = readJson(runSummaryPath);
    const reviewGuideText = fs.readFileSync(reviewGuidePath, 'utf8');

    assert.equal(finalDelivery.deliveryReadiness.publishable, true);
    assert.equal(finalDelivery.lane, 'life_record');
    assert.ok(String(finalDelivery.image.localFilePath || '').includes(path.join('final', 'current')));
    assert.ok(String(finalDelivery.diagnostics?.promptToImage?.reportPath || '').includes('image_diagnosis.md'));
    assert.equal(publishResult.status, 'dry_run_ready');
    assert.equal(runSummary.release.publishStatus, 'dry_run_ready');
    assert.match(reviewGuideText, /image_diagnosis\.md/);

    const legacyRootNames = ['current', 'generated', 'history', 'runs', 'deliverables', 'evaluations'];
    for (const dirName of legacyRootNames) {
      const legacyPath = path.join(runtimeDir, dirName);
      assert.equal(fs.existsSync(legacyPath), false, `legacy runtime root should not exist: ${legacyPath}`);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
