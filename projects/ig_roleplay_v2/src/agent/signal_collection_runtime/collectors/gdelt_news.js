const {
  buildHealthRecord,
  compactText,
  containsAnyKeyword,
  dedupeEntries,
  extractTrendsFromTitles,
  fetchJson,
  normalizeHeadline,
  slugify
} = require('../shared');

async function collect(source, runtimeContext, fetchImpl) {
  const startedAt = Date.now();
  const query = compactText(source.query || runtimeContext.location.name || 'city life');
  const maxRecords = Number(source.maxRecords || source.limit || runtimeContext.limits.news);
  const timespan = compactText(source.timespan || '3d');
  const sort = compactText(source.sort || 'datedesc');
  const titleAnyKeywords = (source.titleAnyKeywords || []).map(item => String(item).toLowerCase());
  const preferSourceCountries = (source.preferSourceCountries || []).map(item => String(item).toLowerCase());
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=${maxRecords}&timespan=${encodeURIComponent(timespan)}&sort=${encodeURIComponent(sort)}`;

  const json = await fetchJson(fetchImpl, url, {
    timeoutMs: source.timeoutMs
  });

  const articles = (Array.isArray(json?.articles) ? json.articles : [])
    .filter(article => {
      if (titleAnyKeywords.length === 0) return true;
      return containsAnyKeyword([
        article?.title,
        article?.url,
        article?.sourcecountry,
        article?.domain
      ].join(' '), titleAnyKeywords);
    })
    .sort((left, right) => {
      const leftPreferred = containsAnyKeyword(left?.sourcecountry || '', preferSourceCountries) ? 1 : 0;
      const rightPreferred = containsAnyKeyword(right?.sourcecountry || '', preferSourceCountries) ? 1 : 0;
      return rightPreferred - leftPreferred;
    });

  const news = dedupeEntries(articles.map((article, index) => ({
    title: normalizeHeadline(article.title),
    url: compactText(article.url || ''),
    source: compactText(article.sourcecountry || article.source || article.domain || ''),
    seendate: compactText(article.seendate || ''),
    priorityWeight: source.priorityWeight,
    signalId: `news_${slugify(article.title || `article_${index + 1}`)}`
  })).filter(item => item.title), maxRecords);

  const trends = extractTrendsFromTitles(
    news.map(item => item.title),
    Number(source.trendKeywords || runtimeContext.limits.trends)
  );

  return {
    news,
    trends,
    sourceHealth: [buildHealthRecord({
      sourceId: source.id,
      kind: source.kind,
      sourceLabel: source.sourceLabel,
      status: news.length > 0 ? 'ok' : 'degraded',
      itemCount: news.length + trends.length,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      categories: ['news', 'trending_topics'],
      note: news.length > 0
        ? 'City-facing headlines refreshed successfully.'
        : 'The source responded, but no fresh headlines were returned.'
    })]
  };
}

module.exports = {
  collect,
  kind: 'gdelt_news'
};
