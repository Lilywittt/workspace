const { readJsonOptional } = require('../common/runtime');
const { asStringArray, compactText } = require('./utils');

function normalizeReferenceEntry(raw = {}, fallbackKind = 'identity') {
  return {
    id: compactText(raw.id || ''),
    kind: compactText(raw.kind || fallbackKind),
    status: compactText(raw.status || 'ready'),
    source: compactText(raw.source || ''),
    assetPath: compactText(raw.assetPath || raw.path || ''),
    notes: compactText(raw.notes || ''),
    style: compactText(raw.style || ''),
    legacyImageId: compactText(raw.legacyImageId || '')
  };
}

function loadReferenceLibrary(filePath) {
  const source = readJsonOptional(filePath, {});
  const identityAnchors = (source.identityAnchors || [])
    .map(item => normalizeReferenceEntry(item, 'identity'))
    .filter(item => item.id);
  const styleAnchors = (source.styleAnchors || [])
    .map(item => normalizeReferenceEntry(item, 'style'))
    .filter(item => item.id);

  return {
    version: compactText(source.version || '3.0.0-alpha.1'),
    sourceFile: filePath,
    identityAnchors,
    styleAnchors,
    allIds: asStringArray([
      ...identityAnchors.map(item => item.id),
      ...styleAnchors.map(item => item.id)
    ], 64)
  };
}

function buildReferenceLookup(referenceLibrary) {
  const lookup = new Map();
  for (const entry of [
    ...(referenceLibrary?.identityAnchors || []),
    ...(referenceLibrary?.styleAnchors || [])
  ]) {
    lookup.set(entry.id, entry);
  }
  return lookup;
}

module.exports = {
  buildReferenceLookup,
  loadReferenceLibrary
};
