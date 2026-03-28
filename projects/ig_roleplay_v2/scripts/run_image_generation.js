const fs = require('fs');
const path = require('path');
const {
  buildRunStamp,
  parseArgs
} = require('./lib/runtime');
const {
  applyArtifactFailure,
  applyArtifactSuccess,
  buildGeneratedAssetPath,
  buildGeneratedImageArtifactBase,
  buildFallbackRequestBody,
  buildProviderRequestBody,
  composePrompt,
  defaultRuntimeConfigPath,
  extractHostedImageItem,
  hasFakeIpAddress,
  loadImageGenerationContext,
  noteMetadataOnlyReferences,
  resolveEndpointAddresses,
  sizeForProvider,
  writeGeneratedArtifact,
  catalogPath
} = require('./lib/image_generation');
const {
  buildWorkflowRequest,
  loadWorkflowProfile
} = require('./lib/comfyui_workflow');
const {
  downloadOutputFile,
  submitWorkflow,
  waitForHistoryOutputs
} = require('./lib/comfyui_client');
const { resolveRelative } = require('./lib/runtime');

function workspaceRootFromProjectDir(projectDir) {
  return path.resolve(projectDir, '..', '..', '..');
}

function importDotEnvIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const name = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1');
    if (!name || Object.prototype.hasOwnProperty.call(process.env, name)) {
      continue;
    }
    process.env[name] = value;
  }
}

function resolveWorkflowProfilePath(providerSpec = {}) {
  if (!providerSpec.workflowProfilePath) {
    throw new Error(`Provider ${providerSpec?.provider || 'unknown'} is missing workflowProfilePath.`);
  }
  return resolveRelative(catalogPath, providerSpec.workflowProfilePath);
}

function getHttpStatus(error) {
  const value = Number(error?.httpStatus || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function buildHostedHeaders(providerSpec = {}, requiredEnvName = '') {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (requiredEnvName) {
    headers.Authorization = `Bearer ${process.env[requiredEnvName]}`;
  }
  if (providerSpec.apiStyle === 'dashscope-multimodal' && providerSpec.dashScopeAsync) {
    headers['X-DashScope-Async'] = providerSpec.dashScopeAsync;
  }
  return headers;
}

async function invokeProviderImageRequest({ endpoint, headers, body }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (err) {
    json = { raw: text };
  }

  if (!response.ok) {
    const message = json.error || json.message || json.reason || json.raw || `HTTP ${response.status}`;
    const error = new Error(String(message));
    error.httpStatus = response.status;
    error.body = json;
    throw error;
  }

  return json;
}

function shouldRetryProviderRequest(statusCode, attempt, maxAttempts) {
  if (attempt >= maxAttempts) {
    return false;
  }
  if (statusCode == null) {
    return true;
  }
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

async function invokeProviderImageRequestWithRetry({
  endpoint,
  headers,
  body,
  providerName,
  requestLabel = 'primary',
  maxAttempts = 3,
  baseDelayMs = 2000
}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await invokeProviderImageRequest({ endpoint, headers, body });
      return {
        response,
        attemptCount: attempt
      };
    } catch (error) {
      const status = getHttpStatus(error);
      if (!shouldRetryProviderRequest(status, attempt, maxAttempts)) {
        throw error;
      }
      const statusLabel = status == null ? 'no_http_response' : `http_${status}`;
      console.log(`[v2] ${providerName} ${requestLabel} attempt ${attempt}/${maxAttempts} hit ${statusLabel}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, baseDelayMs * attempt));
    }
  }

  throw new Error(`Retry loop ended unexpectedly for ${requestLabel} request.`);
}

async function downloadRemoteFile(url, destinationPath) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Failed to download generated image. HTTP ${response.status}`);
    error.httpStatus = response.status;
    throw error;
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(destinationPath, Buffer.from(arrayBuffer));
}

async function runHostedImageGeneration(context, {
  outputFormat = 'png',
  quality = 'medium'
}) {
  const { imageRequest, providerSpec, runtimeDir, runId, scenePlan } = context;
  const size = sizeForProvider(providerSpec, imageRequest?.renderPlan?.aspectRatio || '4:5');
  const prompt = composePrompt(imageRequest);
  const primaryBody = buildProviderRequestBody({
    providerSpec,
    prompt,
    size,
    quality,
    outputFormat
  });
  const fallbackBody = buildFallbackRequestBody({
    providerSpec,
    prompt,
    size
  });
  const artifact = buildGeneratedImageArtifactBase({
    scenePlan,
    imageRequest,
    providerSpec,
    requestBody: primaryBody,
    outputFormat,
    submissionMode: 'host_executed_sync'
  });

  const requiredEnvName = providerSpec?.requiredEnv?.[0] || '';
  if (requiredEnvName && !process.env[requiredEnvName]) {
    applyArtifactFailure(artifact, {
      status: 'provider_credentials_missing',
      failureReason: `${requiredEnvName}_missing`,
      notes: [
        `Host ${requiredEnvName} is missing, so image generation could not start.`,
        ...noteMetadataOnlyReferences(imageRequest)
      ]
    });
    writeGeneratedArtifact(runtimeDir, runId, artifact);
    return artifact;
  }

  const addresses = await resolveEndpointAddresses(providerSpec.endpoint);
  if (hasFakeIpAddress(addresses)) {
    applyArtifactFailure(artifact, {
      status: 'provider_network_error',
      failureReason: 'fake_ip_dns_interference',
      notes: [
        `${providerSpec.provider} resolved to a fake IP address (${addresses.join(', ')}). This usually means VPN or tunnel fake-ip DNS is intercepting the provider domain before HTTPS can be established.`,
        ...noteMetadataOnlyReferences(imageRequest)
      ]
    });
    writeGeneratedArtifact(runtimeDir, runId, artifact);
    return artifact;
  }

  try {
    let responseInfo;
    let usedFallbackBody = false;
    try {
        responseInfo = await invokeProviderImageRequestWithRetry({
          endpoint: providerSpec.endpoint,
          headers: buildHostedHeaders(providerSpec, requiredEnvName),
          body: primaryBody,
          providerName: providerSpec.provider,
          requestLabel: 'primary'
        });
    } catch (error) {
      const status = getHttpStatus(error);
      if (status === 400 && fallbackBody) {
        usedFallbackBody = true;
        artifact.providerRequest.requestBody = fallbackBody;
        responseInfo = await invokeProviderImageRequestWithRetry({
          endpoint: providerSpec.endpoint,
          headers: buildHostedHeaders(providerSpec, requiredEnvName),
          body: fallbackBody,
          providerName: providerSpec.provider,
          requestLabel: 'fallback'
        });
      } else if (status === 401) {
        applyArtifactFailure(artifact, {
          status: 'provider_auth_failed',
          failureReason: `${requiredEnvName}_invalid`,
          notes: [`${providerSpec.provider} rejected the configured key for image generation.`]
        });
        writeGeneratedArtifact(runtimeDir, runId, artifact);
        return artifact;
      } else if (status == null) {
        applyArtifactFailure(artifact, {
          status: 'provider_network_error',
          failureReason: 'transport_error_no_http_response',
          notes: [`${providerSpec.provider} request failed before an HTTP response was received. This usually points to TLS, proxy, VPN, or tunnel interference.`]
        });
        writeGeneratedArtifact(runtimeDir, runId, artifact);
        return artifact;
      } else {
        applyArtifactFailure(artifact, {
          status: 'provider_request_failed',
          failureReason: `http_${status}`,
          notes: [`${providerSpec.provider} image request failed with HTTP ${status}.`]
        });
        writeGeneratedArtifact(runtimeDir, runId, artifact);
        return artifact;
      }
    }

    const response = responseInfo.response;
    const item = extractHostedImageItem(providerSpec, response);
    if (!item) {
      applyArtifactFailure(artifact, {
        status: 'provider_request_failed',
        failureReason: 'empty_image_data',
        notes: [`${providerSpec.provider} image API returned no image data.`]
      });
      writeGeneratedArtifact(runtimeDir, runId, artifact);
      return artifact;
    }

    const remoteUrl = String(item.url || item.image || '');
    const historyFile = buildGeneratedAssetPath({
      runtimeDir,
      runId,
      provider: providerSpec.provider,
      outputFormat,
      sourceFilename: item.filename || remoteUrl
    });

    if (item.b64_json) {
      fs.writeFileSync(historyFile, Buffer.from(String(item.b64_json), 'base64'));
    } else if (remoteUrl) {
      await downloadRemoteFile(remoteUrl, historyFile);
    } else {
      applyArtifactFailure(artifact, {
        status: 'provider_request_failed',
        failureReason: 'missing_image_payload',
        notes: [`${providerSpec.provider} image API returned neither b64_json nor url.`]
      });
      writeGeneratedArtifact(runtimeDir, runId, artifact);
      return artifact;
    }

    const notes = [
      `Host executor generated a real image file from the current image_request.json using ${providerSpec.provider}.`,
      ...noteMetadataOnlyReferences(imageRequest)
    ];
    if (usedFallbackBody) {
      notes.push('The provider rejected the primary request body, so a fallback body was used.');
    }
    if (responseInfo.attemptCount > 1) {
      notes.push(`The provider request succeeded after ${responseInfo.attemptCount} attempts.`);
    }

    applyArtifactSuccess(artifact, {
      responseBody: response,
      imageItem: item,
      localFilePath: historyFile,
      status: remoteUrl ? 'image_ready' : 'image_generated_local_only',
      notes
    });
    writeGeneratedArtifact(runtimeDir, runId, artifact);
    return artifact;
  } catch (error) {
    applyArtifactFailure(artifact, {
      status: getHttpStatus(error) ? 'provider_request_failed' : 'provider_network_error',
      failureReason: getHttpStatus(error) ? `http_${getHttpStatus(error)}` : 'provider_network_error',
      notes: [`Host could not reach the ${providerSpec.provider} image endpoint. ${error.message}`.trim()]
    });
    writeGeneratedArtifact(runtimeDir, runId, artifact);
    return artifact;
  }
}

async function runComfyuiImageGeneration(context, {
  outputFormat = 'png'
}) {
  const { imageRequest, providerSpec, runtimeDir, runId, scenePlan } = context;
  const workflowProfilePath = resolveWorkflowProfilePath(providerSpec);
  const workflowProfile = loadWorkflowProfile(workflowProfilePath);
  const workflowBundle = buildWorkflowRequest({
    imageRequest,
    workflowProfile,
    requestedModel: providerSpec.model,
    provider: providerSpec.provider,
    requestStamp: buildRunStamp()
  });
  const artifact = buildGeneratedImageArtifactBase({
    scenePlan,
    imageRequest,
    providerSpec,
    requestBody: workflowBundle.submitPayload,
    outputFormat,
    submissionMode: 'host_executed_workflow'
  });

  try {
    const submission = await submitWorkflow({
      providerSpec,
      submitPayload: workflowBundle.submitPayload
    });
    const promptId = String(submission.prompt_id || submission.id || '');
    if (!promptId) {
      const notes = ['ComfyUI did not return a prompt_id for the submitted workflow.'];
      if (submission.error) {
        notes.push(`ComfyUI validation error: ${submission.error}`);
      }
      if (submission.node_errors) {
        notes.push(`Node errors: ${JSON.stringify(submission.node_errors)}`);
      }
      applyArtifactFailure(artifact, {
        status: 'provider_request_failed',
        failureReason: 'missing_prompt_id',
        notes
      });
      writeGeneratedArtifact(runtimeDir, runId, artifact);
      return artifact;
    }

    const waited = await waitForHistoryOutputs({
      providerSpec,
      promptId,
      outputNodeIds: workflowBundle.outputNodeIds
    });
    const item = waited.items[0];
    const historyFile = buildGeneratedAssetPath({
      runtimeDir,
      runId,
      provider: providerSpec.provider,
      outputFormat,
      sourceFilename: item.filename
    });
    await downloadOutputFile({
      providerSpec,
      item,
      destinationPath: historyFile
    });

    artifact.createdAt = new Date().toISOString();
    artifact.providerRequestId = promptId;
    artifact.remoteJobId = promptId;
    artifact.providerRequest.assetFilenameHint = path.basename(historyFile);
    artifact.status = 'image_generated_local_only';
    artifact.localFilePath = historyFile;
    artifact.latestFilePath = '';
    artifact.failureReason = '';
    artifact.notes = [
      `ComfyUI workflow completed locally using profile ${workflowProfile.profileId}.`,
      `Checkpoint: ${workflowBundle.checkpointName}.`,
      'The pipeline now has a real local image file, but no public URL has been attached yet.'
    ];
    writeGeneratedArtifact(runtimeDir, runId, artifact);
    return artifact;
  } catch (error) {
    applyArtifactFailure(artifact, {
      status: error?.code === 'COMFY_TIMEOUT'
        ? 'provider_request_failed'
        : (getHttpStatus(error) ? 'provider_request_failed' : 'provider_network_error'),
      failureReason: error?.code === 'COMFY_TIMEOUT'
        ? 'comfyui_timeout'
        : (getHttpStatus(error) ? `http_${getHttpStatus(error)}` : 'provider_network_error'),
      notes: [`ComfyUI workflow execution failed: ${error.message}`]
    });
    writeGeneratedArtifact(runtimeDir, runId, artifact);
    return artifact;
  }
}

async function runImageGeneration(args = parseArgs(process.argv)) {
  const projectDir = args['project-dir']
    ? path.resolve(args['project-dir'])
    : path.resolve(__dirname, '..');
  const configPath = args.config
    ? path.resolve(args.config)
    : defaultRuntimeConfigPath(projectDir);
  const providerName = args.provider || 'aliyun-z-image';
  const outputFormat = String(args['output-format'] || 'png').replace(/^\./, '').toLowerCase() || 'png';
  const quality = String(args.quality || 'medium');

  importDotEnvIfPresent(path.join(workspaceRootFromProjectDir(projectDir), '.env'));

  const context = loadImageGenerationContext({
    projectDir,
    configPath,
    providerName,
    requestedModel: args.model || ''
  });

  if (context.providerSpec.apiStyle === 'comfyui-workflow') {
    return runComfyuiImageGeneration(context, { outputFormat });
  }

  return runHostedImageGeneration(context, { outputFormat, quality });
}

async function runImageGenerationCli(argv = process.argv) {
  const args = parseArgs(argv);
  const artifact = await runImageGeneration(args);
  console.log(`generated image status: ${artifact.status}`);
  if (artifact.localFilePath) {
    console.log(`generated image file: ${artifact.localFilePath}`);
  }
  return artifact;
}

if (require.main === module) {
  runImageGenerationCli().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runImageGeneration,
  runImageGenerationCli
};
