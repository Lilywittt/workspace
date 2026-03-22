const fs = require('fs');
const path = require('path');

const catalogPath = path.resolve(__dirname, '..', '..', 'config', 'provider_catalog.json');

function readCatalog() {
  const raw = fs.readFileSync(catalogPath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function getProviderCatalog() {
  return readCatalog();
}

function getProviderSpec(provider, requestedModel = '') {
  const catalog = readCatalog();
  const normalized = String(provider || '').trim().toLowerCase();
  const base = catalog[normalized];
  if (!base) {
    return null;
  }

  return {
    ...base,
    provider: normalized,
    model: String(requestedModel || '').trim() || base.defaultModel
  };
}

function requiredEnvFor(provider) {
  const spec = getProviderSpec(provider);
  return spec?.requiredEnv || [];
}

function defaultModelFor(provider) {
  const spec = getProviderSpec(provider);
  return spec?.defaultModel || null;
}

function defaultEndpointFor(provider) {
  const spec = getProviderSpec(provider);
  return spec?.endpoint || null;
}

function deriveSize(provider, aspectRatio) {
  const spec = getProviderSpec(provider);
  if (!spec?.sizeByAspectRatio) return null;
  return spec.sizeByAspectRatio[aspectRatio] || null;
}

module.exports = {
  catalogPath,
  defaultEndpointFor,
  defaultModelFor,
  deriveSize,
  getProviderCatalog,
  getProviderSpec,
  requiredEnvFor
};
