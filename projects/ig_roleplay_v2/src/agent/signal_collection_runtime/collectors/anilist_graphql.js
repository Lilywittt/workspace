const {
  buildHealthRecord,
  compactText,
  dedupeEntries,
  fetchJson,
  uniqueStrings
} = require('../shared');

async function collect(source, runtimeContext, fetchImpl) {
  const startedAt = Date.now();
  const limit = Number(source.limit || runtimeContext.limits.popCulture);
  const body = JSON.stringify({
    query: 'query ($page:Int,$perPage:Int,$sort:[MediaSort]) { Page(page:$page, perPage:$perPage) { media(type: ANIME, status_not: FINISHED, sort:$sort) { id title { romaji english native } season seasonYear popularity averageScore } } }',
    variables: {
      page: 1,
      perPage: Math.max(limit + 4, 8),
      sort: ['TRENDING_DESC']
    }
  });

  const json = await fetchJson(fetchImpl, 'https://graphql.anilist.co', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body,
    timeoutMs: source.timeoutMs
  });

  const currentYear = runtimeContext.now.getUTCFullYear();
  const rawEntries = Array.isArray(json?.data?.Page?.media) ? json.data.Page.media : [];
  const filtered = rawEntries.filter(item => {
    if (!source.seasonOnly) return true;
    return Number(item.seasonYear || 0) >= currentYear;
  });

  const mapped = dedupeEntries(filtered.map((item, index) => {
    const title = compactText(
      item?.title?.english
        || item?.title?.romaji
        || item?.title?.native
        || ''
    );

    return {
      signalId: `anilist_${item.id || index + 1}`,
      title,
      text: `${title} is currently surfacing near the top of anime trend lists.`,
      freshness: 'recent',
      directiveness: 'low',
      sourceType: 'signals',
      priorityWeight: source.priorityWeight,
      tags: uniqueStrings([
        compactText(item.season || '').toLowerCase(),
        compactText(String(item.seasonYear || '')),
        'anime'
      ], 4)
    };
  }).filter(item => item.title), limit);

  const categoryName = compactText(source.category || 'popCulture');
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
        ? 'Pop-culture trend signals refreshed successfully.'
        : 'AniList responded, but no current-season items passed filtering.'
    })]
  };
}

module.exports = {
  collect,
  kind: 'anilist_graphql'
};
