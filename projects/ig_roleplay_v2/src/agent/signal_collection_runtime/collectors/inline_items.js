const {
  buildHealthRecord,
  compactText,
  dedupeEntries,
  slugify,
  uniqueStrings
} = require('../shared');

function normalizeInlineEntry(source, entry = {}, index = 0) {
  const text = compactText(entry.text || entry.title || entry.summary || '');
  if (!text) return null;

  return {
    signalId: compactText(entry.signalId || `${slugify(source.id)}_${String(index + 1).padStart(2, '0')}`),
    title: compactText(entry.title || ''),
    text,
    freshness: compactText(entry.freshness || 'recent'),
    directiveness: compactText(entry.directiveness || 'low'),
    sourceType: compactText(entry.sourceType || 'signals'),
    priorityWeight: Math.max(1, Math.min(4, Number(entry.priorityWeight || source.priorityWeight || 1) || 1)),
    tags: uniqueStrings(entry.tags || [], 6)
  };
}

async function collect(source) {
  const categoryName = compactText(source.category || 'externalSignals');
  const items = dedupeEntries(
    (source.items || [])
      .map((entry, index) => normalizeInlineEntry(source, entry, index))
      .filter(Boolean),
    source.limit
  );

  return {
    [categoryName]: items,
    sourceHealth: [buildHealthRecord({
      sourceId: source.id,
      kind: source.kind,
      sourceLabel: source.sourceLabel,
      status: items.length > 0 ? 'ok' : 'degraded',
      itemCount: items.length,
      fetchedAt: new Date().toISOString(),
      latencyMs: 0,
      categories: [categoryName],
      note: items.length > 0
        ? 'Inline signals were loaded successfully.'
        : 'Inline source is enabled but empty.'
    })]
  };
}

module.exports = {
  collect,
  kind: 'inline_items',
  normalizeInlineEntry
};
