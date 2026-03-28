const fs = require('fs');
const { extractHistoryEntry, extractHistoryImageItems } = require('./comfyui_workflow');
const { buildHeaders, compactText } = require('./image_generation');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildEndpointUrl(baseUrl, routeTemplate, promptId = '') {
  const replaced = String(routeTemplate || '')
    .replace('{prompt_id}', encodeURIComponent(promptId))
    .replace(/^\/+/, '');
  return new URL(replaced, `${String(baseUrl || '').replace(/\/+$/, '')}/`).toString();
}

async function submitWorkflow({ providerSpec, submitPayload }) {
  const url = buildEndpointUrl(providerSpec.endpoint, providerSpec.workflowTransport.submitPath);
  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(providerSpec),
    body: JSON.stringify(submitPayload)
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (err) {
    json = { raw: text };
  }

  if (!response.ok) {
    const message = json.error || json.reason || json.raw || `HTTP ${response.status}`;
    const error = new Error(String(message));
    error.httpStatus = response.status;
    error.body = json;
    throw error;
  }

  return json;
}

async function fetchHistory({ providerSpec, promptId }) {
  const url = buildEndpointUrl(providerSpec.endpoint, providerSpec.workflowTransport.historyPath, promptId);
  const response = await fetch(url, {
    headers: buildHeaders(providerSpec)
  });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.httpStatus = response.status;
    throw error;
  }
  return response.json();
}

function describeHistoryState(entry = {}) {
  const status = compactText(entry?.status?.status_str || '');
  const completed = entry?.status?.completed;
  const messages = Array.isArray(entry?.status?.messages)
    ? entry.status.messages
        .map(item => {
          if (Array.isArray(item)) {
            return compactText(item.join(' '));
          }
          return compactText(JSON.stringify(item));
        })
        .filter(Boolean)
    : [];

  return {
    status,
    completed,
    messages
  };
}

async function waitForHistoryOutputs({ providerSpec, promptId, outputNodeIds }) {
  const timeoutMs = Number(providerSpec?.workflowTransport?.timeoutMs || 300000);
  const pollIntervalMs = Number(providerSpec?.workflowTransport?.pollIntervalMs || 2000);
  const startedAt = Date.now();
  let lastHistory = null;

  while ((Date.now() - startedAt) < timeoutMs) {
    lastHistory = await fetchHistory({ providerSpec, promptId });
    const items = extractHistoryImageItems(lastHistory, promptId, outputNodeIds);
    if (items.length > 0) {
      return {
        history: lastHistory,
        items,
        entry: extractHistoryEntry(lastHistory, promptId)
      };
    }
    await sleep(pollIntervalMs);
  }

  const entry = extractHistoryEntry(lastHistory, promptId);
  const state = describeHistoryState(entry);
  const details = [
    `ComfyUI history did not produce outputs within ${timeoutMs}ms.`,
    state.status ? `status=${state.status}` : '',
    typeof state.completed === 'boolean' ? `completed=${state.completed}` : '',
    state.messages.length > 0 ? `messages=${state.messages.join(' | ')}` : ''
  ].filter(Boolean).join(' ');
  const timeoutError = new Error(details);
  timeoutError.code = 'COMFY_TIMEOUT';
  timeoutError.historyEntry = entry;
  throw timeoutError;
}

async function downloadOutputFile({ providerSpec, item, destinationPath }) {
  const url = new URL(buildEndpointUrl(providerSpec.endpoint, providerSpec.workflowTransport.viewPath));
  url.searchParams.set('filename', item.filename);
  url.searchParams.set('subfolder', item.subfolder || '');
  url.searchParams.set('type', item.type || 'output');

  const response = await fetch(url, {
    headers: buildHeaders(providerSpec)
  });
  if (!response.ok) {
    const error = new Error(`Failed to download ComfyUI output. HTTP ${response.status}`);
    error.httpStatus = response.status;
    throw error;
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(destinationPath, Buffer.from(arrayBuffer));
}

module.exports = {
  buildEndpointUrl,
  describeHistoryState,
  downloadOutputFile,
  fetchHistory,
  submitWorkflow,
  waitForHistoryOutputs
};
