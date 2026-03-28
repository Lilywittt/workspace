const {
  buildHealthRecord,
  compactText,
  dedupeEntries,
  fetchText,
  parseRssItems,
  slugify,
  summarizeTextBits
} = require('../shared');

async function collect(source, runtimeContext, fetchImpl) {
  const startedAt = Date.now();
  const xml = await fetchText(fetchImpl, source.url, {
    timeoutMs: source.timeoutMs
  });
  const categoryName = compactText(source.category || 'externalSignals');
  const items = dedupeEntries(parseRssItems(xml).map((entry, index) => ({
    signalId: `${slugify(source.id)}_${String(index + 1).padStart(2, '0')}`,
    title: entry.title,
    text: summarizeTextBits(entry.title, entry.description),
    url: entry.link,
    publishedAt: entry.pubDate,
    freshness: 'recent',
    directiveness: 'low',
    sourceType: 'signals',
    priorityWeight: source.priorityWeight
  })).filter(entry => entry.text), source.limit);

  return {
    [categoryName]: items,
    sourceHealth: [buildHealthRecord({
      sourceId: source.id,
      kind: source.kind,
      sourceLabel: source.sourceLabel,
      status: items.length > 0 ? 'ok' : 'degraded',
      itemCount: items.length,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      categories: [categoryName],
      note: items.length > 0
        ? 'RSS feed signals refreshed successfully.'
        : 'The RSS feed returned no parseable items.'
    })]
  };
}

module.exports = {
  collect,
  kind: 'rss_feed'
};
