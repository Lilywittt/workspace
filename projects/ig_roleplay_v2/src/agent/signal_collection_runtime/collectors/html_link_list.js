const {
  buildHealthRecord,
  compactText,
  dedupeEntries,
  extractDatedPath,
  fetchText,
  isFreshEnough,
  parseHtmlListItems,
  slugify,
  summarizeTextBits,
  uniqueStrings
} = require('../shared');

async function collect(source, runtimeContext, fetchImpl) {
  const startedAt = Date.now();
  const html = await fetchText(fetchImpl, source.url, {
    timeoutMs: source.timeoutMs
  });
  const entries = parseHtmlListItems(html, source);
  const categoryName = compactText(source.category || 'localEvents');
  const freshnessWindowDays = Number(source.freshnessWindowDays || 75);
  const mapped = dedupeEntries(entries.map((entry, index) => ({
    signalId: `${slugify(source.id)}_${String(index + 1).padStart(2, '0')}`,
    title: entry.title,
    text: summarizeTextBits(entry.title, entry.detail),
    url: entry.url,
    publishedAt: extractDatedPath(entry.url),
    freshness: 'recent',
    directiveness: 'low',
    sourceType: 'signals',
    priorityWeight: source.priorityWeight,
    tags: uniqueStrings([
      slugify(source.sourceLabel, 'source'),
      categoryName
    ], 4)
  })).filter(entry => isFreshEnough(entry.publishedAt, runtimeContext.now, freshnessWindowDays)), source.limit);

  return {
    [categoryName]: mapped,
    sourceHealth: [buildHealthRecord({
      sourceId: source.id,
      kind: source.kind,
      sourceLabel: source.sourceLabel,
      status: mapped.length > 0 ? 'ok' : 'degraded',
      itemCount: mapped.length,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      categories: [categoryName],
      note: mapped.length > 0
        ? 'List-page signals refreshed successfully.'
        : 'The page loaded, but no matching list items were extracted.'
    })]
  };
}

module.exports = {
  collect,
  kind: 'html_link_list'
};
