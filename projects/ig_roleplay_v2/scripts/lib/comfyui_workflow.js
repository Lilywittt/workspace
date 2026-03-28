const { readJsonRequired, resolveRelative } = require('./runtime');

function compactText(text = '') {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function asStringArray(value, limit = 32) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => compactText(item))
    .filter(Boolean)
    .slice(0, limit);
}

function uniqueStrings(items = [], limit = 32) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const normalized = compactText(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseSizeText(value = '') {
  const match = String(value || '').trim().match(/^(\d+)\s*[x\*]\s*(\d+)$/i);
  if (!match) {
    return null;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2])
  };
}

function normalizeNodeSpec(raw = {}, fallbackId = '') {
  return {
    id: compactText(raw.id || fallbackId),
    input: compactText(raw.input || ''),
    widthInput: compactText(raw.widthInput || ''),
    heightInput: compactText(raw.heightInput || ''),
    batchInput: compactText(raw.batchInput || ''),
    seedInput: compactText(raw.seedInput || ''),
    stepsInput: compactText(raw.stepsInput || ''),
    cfgInput: compactText(raw.cfgInput || ''),
    samplerInput: compactText(raw.samplerInput || ''),
    schedulerInput: compactText(raw.schedulerInput || ''),
    denoiseInput: compactText(raw.denoiseInput || ''),
    preferredNodeIds: asStringArray(raw.preferredNodeIds || [], 12)
  };
}

function normalizeProfile(raw = {}, profilePath = '') {
  const templatePath = resolveRelative(profilePath, raw.templatePath || '../workflows/comfyui/anime_engineering_api.workflow.json');
  const template = readJsonRequired(templatePath, 'comfyui workflow template');
  const rawSizes = raw.sizeByAspectRatio || {};
  const normalizedSizes = {};

  for (const [aspectRatio, value] of Object.entries(rawSizes)) {
    if (value && typeof value === 'object' && Number(value.width) > 0 && Number(value.height) > 0) {
      normalizedSizes[aspectRatio] = {
        width: Number(value.width),
        height: Number(value.height)
      };
      continue;
    }

    const parsed = parseSizeText(value);
    if (parsed) {
      normalizedSizes[aspectRatio] = parsed;
    }
  }

  return {
    version: compactText(raw.version || '3.0.0-alpha.1'),
    profileId: compactText(raw.profileId || 'comfyui_anime_engineering'),
    sourceFile: profilePath,
    templatePath,
    template,
    nodes: {
      checkpoint: normalizeNodeSpec(raw.nodes?.checkpoint || {}, '3'),
      positivePrompt: normalizeNodeSpec(raw.nodes?.positivePrompt || {}, '6'),
      negativePrompt: normalizeNodeSpec(raw.nodes?.negativePrompt || {}, '7'),
      latentImage: normalizeNodeSpec(raw.nodes?.latentImage || {}, '10'),
      sampler: normalizeNodeSpec(raw.nodes?.sampler || {}, '13'),
      saveImage: normalizeNodeSpec(raw.nodes?.saveImage || {}, '9'),
      output: normalizeNodeSpec(raw.nodes?.output || {}, '9')
    },
    defaults: {
      checkpointName: compactText(raw.defaults?.checkpointName || 'illustrious-xl-v1.0.safetensors'),
      seedStrategy: compactText(raw.defaults?.seedStrategy || 'scene_prompt_hash'),
      steps: Number(raw.defaults?.steps || 28),
      cfg: Number(raw.defaults?.cfg || 6.5),
      samplerName: compactText(raw.defaults?.samplerName || 'dpmpp_2m'),
      scheduler: compactText(raw.defaults?.scheduler || 'karras'),
      denoise: Number(raw.defaults?.denoise || 1),
      batchSize: Number(raw.defaults?.batchSize || 1),
      filenamePrefix: compactText(raw.defaults?.filenamePrefix || 'ig_roleplay_v2_comfy_anime')
    },
    sizeByAspectRatio: normalizedSizes,
    promptTuning: {
      positiveAppend: asStringArray(raw.promptTuning?.positiveAppend || [], 12),
      negativeAppend: asStringArray(raw.promptTuning?.negativeAppend || [], 12)
    }
  };
}

function loadWorkflowProfile(profilePath) {
  const raw = readJsonRequired(profilePath, 'comfyui workflow profile');
  return normalizeProfile(raw, profilePath);
}

function stableHash(text = '') {
  let hash = 2166136261;
  const source = String(text || '');
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sanitizeFileComponent(text = '', fallback = 'run') {
  const normalized = compactText(text)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function appendPromptSection(baseText = '', label = '', items = []) {
  const normalizedItems = asStringArray(items, 24);
  if (normalizedItems.length === 0) {
    return compactText(baseText);
  }

  return [compactText(baseText), `${label}: ${normalizedItems.join(', ')}`]
    .filter(Boolean)
    .join('\n');
}

function resolveAspectSize(aspectRatio = '4:5', workflowProfile = {}, fallbackSize = null) {
  const fromProfile = workflowProfile.sizeByAspectRatio?.[aspectRatio];
  if (fromProfile?.width && fromProfile?.height) {
    return fromProfile;
  }
  if (fallbackSize?.width && fallbackSize?.height) {
    return fallbackSize;
  }
  return { width: 1024, height: 1280 };
}

function setNodeInput(workflow = {}, nodeId = '', inputName = '', value) {
  if (!workflow[nodeId]) {
    throw new Error(`Workflow template is missing node ${nodeId}.`);
  }
  if (!workflow[nodeId].inputs) {
    workflow[nodeId].inputs = {};
  }
  workflow[nodeId].inputs[inputName] = value;
}

function deriveSeed(imageRequest = {}, workflowProfile = {}) {
  const seedSource = [
    imageRequest.scenePlanRunId || '',
    imageRequest.generationMode || '',
    imageRequest.promptPackage?.positivePrompt || '',
    imageRequest.promptPackage?.negativePrompt || ''
  ].join(' | ');
  const hashed = stableHash(seedSource);
  if (hashed > 0) {
    return hashed;
  }
  return stableHash(workflowProfile.defaults?.checkpointName || 'ig_roleplay_v2') || 1;
}

function collectPromptSourceText(imageRequest = {}) {
  return compactText([
    imageRequest?.promptPackage?.positivePrompt || '',
    imageRequest?.promptPackage?.negativePrompt || '',
    imageRequest?.promptPackage?.promptBlocks?.subject || '',
    imageRequest?.promptPackage?.promptBlocks?.outfit || '',
    imageRequest?.promptPackage?.promptBlocks?.moment || '',
    imageRequest?.promptPackage?.promptBlocks?.context || '',
    imageRequest?.promptPackage?.promptBlocks?.composition || '',
    imageRequest?.reviewSignals?.captureSummaryEn || '',
    imageRequest?.reviewSignals?.renderStyleSummaryEn || '',
    ...(imageRequest?.promptPackage?.shotNotes || [])
  ].join(' '));
}

function buildDiffusionPositiveTokens(imageRequest = {}, workflowProfile = {}) {
  const source = collectPromptSourceText(imageRequest);
  const tokens = ['1girl', 'anime'];

  if (/middle-school|early-teen|young/i.test(source)) {
    tokens.push('early teen girl');
  }
  if (/windbreaker|jacket/i.test(source)) {
    tokens.push(/light gray|grey/i.test(source) ? 'light gray windbreaker jacket' : 'windbreaker jacket');
  }
  if (/cream|knit sweater|ribbed knit/i.test(source)) {
    tokens.push('cream knit sweater');
  }
  if (/red hairclip/i.test(source)) {
    tokens.push('small red hairclip');
  }
  if (/zipper pull|zip it up|zipper/i.test(source)) {
    tokens.push('hand pulling jacket zipper');
  }
  if (/billowing outward|filled by the wind|billowing in the wind|wind-filled/i.test(source)) {
    tokens.push('jacket billowing in the wind');
  }
  if (/residential sidewalk|walking route|sidewalk/i.test(source)) {
    tokens.push('windy sidewalk');
  }
  if (/overcast|soft overcast light|cloud/i.test(source)) {
    tokens.push('overcast light');
  }
  if (/crop|close distance|chest-level|upper-body/i.test(source)) {
    tokens.push('close upper body crop');
  }
  if (/side view|rear three-quarter|three-quarter|far side turned away/i.test(source)) {
    tokens.push('side view');
  }

  return uniqueStrings([
    ...tokens,
    ...asStringArray(workflowProfile.promptTuning?.positiveAppend || [], 12)
  ], 24);
}

function buildDiffusionNegativeTokens(imageRequest = {}, workflowProfile = {}) {
  const source = collectPromptSourceText(imageRequest);
  const tokens = [
    'photorealistic',
    'abstract mosaic',
    'text',
    'watermark',
    'blurry',
    'deformed',
    'extra arms',
    'extra hands',
    'multiple girls',
    'mature woman'
  ];

  if (/backpack strap|shoulder strap|crossbody strap/i.test(source)) {
    tokens.push('backpack strap');
  }
  if (/adult|older-looking|mature adult/i.test(source)) {
    tokens.push('adult face proportions');
  }

  return uniqueStrings([
    ...tokens,
    ...asStringArray(workflowProfile.promptTuning?.negativeAppend || [], 12)
  ], 24);
}

function buildPositivePromptForWorkflow(imageRequest = {}, workflowProfile = {}) {
  const diffusionTokens = buildDiffusionPositiveTokens(imageRequest, workflowProfile);
  if (diffusionTokens.length >= 6 && imageRequest?.promptPackage?.promptBlocks) {
    return diffusionTokens.join(', ');
  }

  return appendPromptSection(
    imageRequest?.promptPackage?.positivePrompt || '',
    'WorkflowBias',
    workflowProfile.promptTuning?.positiveAppend || []
  );
}

function buildNegativePromptForWorkflow(imageRequest = {}, workflowProfile = {}) {
  const diffusionTokens = buildDiffusionNegativeTokens(imageRequest, workflowProfile);
  if (diffusionTokens.length >= 6 && imageRequest?.promptPackage?.promptBlocks) {
    return diffusionTokens.join(', ');
  }

  return appendPromptSection(
    imageRequest?.promptPackage?.negativePrompt || '',
    'WorkflowAvoid',
    workflowProfile.promptTuning?.negativeAppend || []
  );
}

function buildWorkflowRequest({
  imageRequest = {},
  workflowProfile,
  requestedModel = '',
  provider = '',
  requestStamp = ''
}) {
  if (!workflowProfile) {
    throw new Error('Workflow profile is required.');
  }

  const fallbackSize = parseSizeText(imageRequest?.renderPlan?.size || '');
  const aspectRatio = compactText(imageRequest?.renderPlan?.aspectRatio || '4:5') || '4:5';
  const size = resolveAspectSize(aspectRatio, workflowProfile, fallbackSize);
  const checkpointName = compactText(requestedModel || workflowProfile.defaults?.checkpointName || '');
  const seed = deriveSeed(imageRequest, workflowProfile);
  const workflow = deepClone(workflowProfile.template);
  const positivePrompt = buildPositivePromptForWorkflow(imageRequest, workflowProfile);
  const negativePrompt = buildNegativePromptForWorkflow(imageRequest, workflowProfile);
  const filenamePrefix = sanitizeFileComponent(
    [
      workflowProfile.defaults?.filenamePrefix || 'ig_roleplay_v2_comfy_anime',
      imageRequest.scenePlanRunId || provider || 'run',
      requestStamp
    ].filter(Boolean).join('_'),
    'ig_roleplay_v2_comfy_anime'
  );

  setNodeInput(workflow, workflowProfile.nodes.checkpoint.id, workflowProfile.nodes.checkpoint.input, checkpointName);
  setNodeInput(workflow, workflowProfile.nodes.positivePrompt.id, workflowProfile.nodes.positivePrompt.input, positivePrompt);
  setNodeInput(workflow, workflowProfile.nodes.negativePrompt.id, workflowProfile.nodes.negativePrompt.input, negativePrompt);
  setNodeInput(workflow, workflowProfile.nodes.latentImage.id, workflowProfile.nodes.latentImage.widthInput, size.width);
  setNodeInput(workflow, workflowProfile.nodes.latentImage.id, workflowProfile.nodes.latentImage.heightInput, size.height);
  setNodeInput(workflow, workflowProfile.nodes.latentImage.id, workflowProfile.nodes.latentImage.batchInput, workflowProfile.defaults.batchSize);
  setNodeInput(workflow, workflowProfile.nodes.sampler.id, workflowProfile.nodes.sampler.seedInput, seed);
  setNodeInput(workflow, workflowProfile.nodes.sampler.id, workflowProfile.nodes.sampler.stepsInput, workflowProfile.defaults.steps);
  setNodeInput(workflow, workflowProfile.nodes.sampler.id, workflowProfile.nodes.sampler.cfgInput, workflowProfile.defaults.cfg);
  setNodeInput(workflow, workflowProfile.nodes.sampler.id, workflowProfile.nodes.sampler.samplerInput, workflowProfile.defaults.samplerName);
  setNodeInput(workflow, workflowProfile.nodes.sampler.id, workflowProfile.nodes.sampler.schedulerInput, workflowProfile.defaults.scheduler);
  setNodeInput(workflow, workflowProfile.nodes.sampler.id, workflowProfile.nodes.sampler.denoiseInput, workflowProfile.defaults.denoise);
  setNodeInput(workflow, workflowProfile.nodes.saveImage.id, workflowProfile.nodes.saveImage.input, filenamePrefix);

  return {
    profileId: workflowProfile.profileId,
    provider,
    checkpointName,
    seed,
    aspectRatio,
    size,
    positivePrompt,
    negativePrompt,
    filenamePrefix,
    outputNodeIds: workflowProfile.nodes.output.preferredNodeIds,
    submitPayload: {
      prompt: workflow
    },
    workflow
  };
}

function extractHistoryEntry(historyPayload = {}, promptId = '') {
  if (!historyPayload || typeof historyPayload !== 'object') {
    return null;
  }

  if (promptId && historyPayload[promptId]) {
    return historyPayload[promptId];
  }

  if (historyPayload.outputs) {
    return historyPayload;
  }

  const values = Object.values(historyPayload);
  return values.find(item => item && typeof item === 'object' && item.outputs) || null;
}

function extractHistoryImageItems(historyPayload = {}, promptId = '', preferredNodeIds = []) {
  const entry = extractHistoryEntry(historyPayload, promptId);
  if (!entry?.outputs) {
    return [];
  }

  const outputs = entry.outputs;
  const orderedNodeIds = [
    ...preferredNodeIds,
    ...Object.keys(outputs).filter(nodeId => !preferredNodeIds.includes(nodeId))
  ];
  const seen = new Set();
  const items = [];

  for (const nodeId of orderedNodeIds) {
    const nodeOutput = outputs[nodeId];
    for (const image of nodeOutput?.images || []) {
      const key = `${image.filename || ''}|${image.subfolder || ''}|${image.type || 'output'}`;
      if (!image?.filename || seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push({
        nodeId,
        filename: image.filename,
        subfolder: image.subfolder || '',
        type: image.type || 'output'
      });
    }
  }

  return items;
}

module.exports = {
  buildWorkflowRequest,
  buildDiffusionNegativeTokens,
  buildDiffusionPositiveTokens,
  compactText,
  extractHistoryEntry,
  extractHistoryImageItems,
  loadWorkflowProfile,
  normalizeProfile,
  parseSizeText,
  resolveAspectSize,
  stableHash
};
