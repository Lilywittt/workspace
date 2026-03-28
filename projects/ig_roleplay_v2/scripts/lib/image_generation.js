const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');
const {
  buildRunStamp,
  ensureDir,
  readJsonRequired,
  resolveRelative,
  runtimeCurrentDir,
  runtimeRunsDir,
  writeRuntimeArtifact
} = require('./runtime');
const {
  catalogPath,
  getProviderSpec
} = require('./provider_catalog');

function defaultRuntimeConfigPath(projectDir) {
  return path.join(projectDir, 'config', 'runtime.config.json');
}

function resolveRuntimeDir(configPath) {
  const config = readJsonRequired(configPath, 'runtime config');
  return resolveRelative(configPath, config.paths?.runtimeDir || '../runtime');
}

function buildArtifactRunId(scenePlan = {}) {
  return String(scenePlan?.runId || '').trim() || `generatedimage-${buildRunStamp()}`;
}

function compactText(text = '') {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function composePrompt(imageRequest = {}) {
  const positive = compactText(imageRequest?.promptPackage?.positivePrompt || '');
  const negative = compactText(imageRequest?.promptPackage?.negativePrompt || '');
  if (!negative) {
    return positive;
  }
  return `${positive}\n\nAvoid: ${negative}`;
}

function sizeForProvider(providerSpec = {}, aspectRatio = '4:5') {
  const mapping = providerSpec?.sizeByAspectRatio?.[aspectRatio];
  if (mapping) {
    return String(mapping);
  }
  if (providerSpec.apiStyle === 'dashscope-multimodal') {
    return '1024*1280';
  }
  return '1024x1536';
}

function buildProviderRequestBody({
  providerSpec = {},
  prompt = '',
  size = '1024x1536',
  quality = 'medium',
  outputFormat = 'png'
}) {
  if (providerSpec.provider === 'aliyun-qwen-image') {
    return {
      model: providerSpec.model,
      input: {
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }]
          }
        ]
      },
      parameters: {
        n: 1
      }
    };
  }

  if (providerSpec.provider === 'aliyun-z-image') {
    return {
      model: providerSpec.model,
      input: {
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }]
          }
        ]
      },
      parameters: {
        size,
        prompt_extend: false,
        watermark: false
      }
    };
  }

  const body = {
    model: providerSpec.model,
    prompt,
    size
  };
  if (providerSpec.provider === 'openai-images') {
    body.output_format = outputFormat;
    body.quality = quality;
  }
  return body;
}

function buildFallbackRequestBody({
  providerSpec = {},
  prompt = '',
  size = '1024x1536'
}) {
  if (providerSpec.apiStyle === 'dashscope-multimodal') {
    return null;
  }

  return {
    model: providerSpec.model,
    prompt,
    size
  };
}

function buildRequestSummary({ imageRequest = {}, providerSpec = {} }) {
  return {
    generationMode: imageRequest.generationMode,
    endpoint: providerSpec.endpoint,
    aspectRatio: imageRequest?.renderPlan?.aspectRatio || '4:5',
    candidateCount: imageRequest?.renderPlan?.candidateCount || 1,
    altText: imageRequest?.publishHints?.altText || '',
    characterPresenceTarget: imageRequest?.reviewSignals?.characterPresenceTarget || '',
    reviewSignals: imageRequest?.reviewSignals || {},
    referenceIds: (imageRequest.references || []).map(item => item.id),
    referenceHandling: {
      requestedReferenceCount: (imageRequest.references || []).length,
      unresolvedReferenceIds: imageRequest?.referencePlan?.unresolvedReferenceIds || [],
      placeholderReferenceIds: imageRequest?.referencePlan?.placeholderReferenceIds || [],
      providerCapability: providerSpec?.referenceHandling?.providerCapability || 'text_prompt_only',
      hostTransport: providerSpec?.referenceHandling?.hostTransport || 'metadata_only',
      deliveryMode: providerSpec?.referenceHandling?.deliveryMode || 'metadata_only'
    },
    promptPackage: imageRequest?.promptPackage || {}
  };
}

function buildGeneratedImageArtifactBase({
  scenePlan = {},
  imageRequest = {},
  providerSpec = {},
  requestBody = {},
  outputFormat = 'png',
  submissionMode = 'host_executed_sync'
}) {
  return {
    version: '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: scenePlan.runId,
    sourceRequestCreatedAt: imageRequest.createdAt || null,
    provider: providerSpec.provider,
    model: providerSpec.model,
    imageUrl: '',
    assetId: null,
    remoteJobId: null,
    providerRequestId: null,
    requestSummary: buildRequestSummary({ imageRequest, providerSpec }),
    providerRequest: {
      provider: providerSpec.provider,
      endpoint: providerSpec.endpoint,
      submissionMode,
      requiredEnv: providerSpec.requiredEnv || [],
      model: providerSpec.model,
      assetFilenameHint: null,
      requestBody,
      responseContract: providerSpec.responseContract || {}
    },
    notes: [],
    status: 'generation_scaffold_ready',
    outputFormat,
    localFilePath: '',
    latestFilePath: '',
    failureReason: ''
  };
}

function resolveGeneratedAssetDir(runtimeDir, runId) {
  const runDir = path.join(runtimeRunsDir(runtimeDir), runId);
  const assetDir = path.join(runDir, 'generated_assets');
  ensureDir(runDir);
  ensureDir(assetDir);
  return assetDir;
}

function writeGeneratedArtifact(runtimeDir, runId, artifact) {
  return writeRuntimeArtifact(runtimeDir, 'generated_image.json', 'generatedimage', artifact, { runId });
}

function buildGeneratedAssetPath({
  runtimeDir,
  runId,
  provider = 'image-provider',
  outputFormat = 'png',
  sourceFilename = ''
}) {
  const assetDir = resolveGeneratedAssetDir(runtimeDir, runId);
  const sourceExtension = path.extname(sourceFilename || '').replace(/^\./, '');
  const extension = compactText(sourceExtension || outputFormat || 'png').toLowerCase() || 'png';
  return path.join(assetDir, `${buildRunStamp()}-${provider}.${extension}`);
}

async function resolveEndpointAddresses(endpoint = '') {
  try {
    const hostName = new URL(endpoint).hostname;
    if (!hostName) {
      return [];
    }
    const results = await dns.lookup(hostName, { all: true });
    return results.map(item => item.address).filter(Boolean);
  } catch (err) {
    return [];
  }
}

function hasFakeIpAddress(addresses = []) {
  return addresses.some(address => /^198\.18\./.test(String(address || '')));
}

function buildHeaders(providerSpec = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };

  const envName = providerSpec?.requiredEnv?.[0] || '';
  const headerName = providerSpec?.auth?.headerName
    || (envName ? 'Authorization' : '');
  const valuePrefix = providerSpec?.auth?.valuePrefix
    || (envName ? 'Bearer ' : '');
  if (!envName || !headerName) {
    return headers;
  }

  const secret = process.env[envName];
  if (!secret) {
    return headers;
  }

  headers[headerName] = `${valuePrefix}${secret}`;
  if (providerSpec.apiStyle === 'dashscope-multimodal' && providerSpec.dashScopeAsync) {
    headers['X-DashScope-Async'] = providerSpec.dashScopeAsync;
  }
  return headers;
}

function extractHostedImageItem(providerSpec = {}, responseBody = {}) {
  if (providerSpec.apiStyle === 'dashscope-multimodal') {
    const content = responseBody?.output?.choices?.[0]?.message?.content || [];
    return content.find(item => item?.image || item?.url || item?.b64_json) || null;
  }

  return responseBody?.data?.[0] || null;
}

function noteMetadataOnlyReferences(imageRequest = {}) {
  if ((imageRequest.references || []).length === 0) {
    return [];
  }
  return ['Reference IDs remained metadata-only during execution; manual identity review is still required.'];
}

function buildProviderRequestFailure({ providerSpec = {}, imageRequest = {}, failureReason = '', status = 'provider_request_failed', notes = [] }) {
  return {
    status,
    failureReason,
    notes: [
      ...notes,
      ...noteMetadataOnlyReferences(imageRequest)
    ]
  };
}

function applyArtifactFailure(artifact, { status, failureReason, notes }) {
  artifact.status = status;
  artifact.failureReason = failureReason;
  artifact.notes = notes || [];
  return artifact;
}

function applyArtifactSuccess(artifact, {
  responseBody = {},
  imageItem = {},
  localFilePath = '',
  status = 'image_ready',
  notes = []
}) {
  artifact.createdAt = new Date().toISOString();
  artifact.imageUrl = String(imageItem?.url || imageItem?.image || '');
  artifact.providerRequestId = String(responseBody?.request_id || responseBody?.id || artifact.providerRequestId || '');
  artifact.remoteJobId = String(responseBody?.request_id || responseBody?.id || artifact.remoteJobId || '');
  artifact.providerRequest.assetFilenameHint = localFilePath ? path.basename(localFilePath) : artifact.providerRequest.assetFilenameHint;
  artifact.status = status;
  artifact.localFilePath = localFilePath;
  artifact.latestFilePath = '';
  artifact.failureReason = '';
  artifact.notes = notes;
  return artifact;
}

function loadImageGenerationContext({
  projectDir,
  configPath,
  providerName,
  requestedModel = ''
}) {
  const resolvedProjectDir = path.resolve(projectDir);
  const resolvedConfigPath = configPath
    ? path.resolve(configPath)
    : defaultRuntimeConfigPath(resolvedProjectDir);
  const runtimeDir = resolveRuntimeDir(resolvedConfigPath);
  const currentDir = runtimeCurrentDir(runtimeDir);
  const imageRequest = readJsonRequired(path.join(currentDir, 'image_request.json'), 'image request');
  const scenePlan = readJsonRequired(path.join(currentDir, 'scene_plan.json'), 'scene plan');
  const providerSpec = getProviderSpec(providerName, requestedModel);

  if (!providerSpec) {
    throw new Error(`Unknown image provider: ${providerName}`);
  }

  return {
    projectDir: resolvedProjectDir,
    configPath: resolvedConfigPath,
    runtimeDir,
    currentDir,
    imageRequest,
    scenePlan,
    providerSpec,
    runId: buildArtifactRunId(scenePlan)
  };
}

module.exports = {
  applyArtifactFailure,
  applyArtifactSuccess,
  buildArtifactRunId,
  buildFallbackRequestBody,
  buildGeneratedAssetPath,
  buildGeneratedImageArtifactBase,
  buildHeaders,
  buildProviderRequestBody,
  buildProviderRequestFailure,
  catalogPath,
  compactText,
  composePrompt,
  defaultRuntimeConfigPath,
  extractHostedImageItem,
  hasFakeIpAddress,
  loadImageGenerationContext,
  noteMetadataOnlyReferences,
  resolveEndpointAddresses,
  resolveGeneratedAssetDir,
  resolveRuntimeDir,
  sizeForProvider,
  writeGeneratedArtifact
};
