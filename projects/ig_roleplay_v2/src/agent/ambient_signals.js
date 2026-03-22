const { compactText } = require('./utils');

function createRng(seedText = '') {
  let seed = 2166136261;
  const text = String(seedText || '');
  for (let index = 0; index < text.length; index += 1) {
    seed ^= text.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng(items, rng) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function cleanSignalText(value) {
  return compactText(value)
    .replace(/news fetch failed/ig, '')
    .replace(/HTTP\s+\d+/ig, '')
    .trim();
}

function seasonalCue(dayContext) {
  const season = dayContext?.date?.season || 'unknown';
  const monthDay = String(dayContext?.date?.isoDate || '').slice(5);
  const city = dayContext?.location?.city || 'the city';
  return {
    signalId: `seasonal_${season}_${monthDay || 'today'}`,
    category: 'seasonal_culture',
    text: `${city} is currently in a ${season} seasonal transition.`,
    sourceType: 'calendar',
    freshness: 'current',
    directiveness: 'low'
  };
}

function buildAmbientSignalPool({ dayContext, signals = {}, override = {}, policy = {} }) {
  const items = [];
  const ambientOverride = override.ambient || {};
  const categories = new Set(policy.categories || []);

  items.push({
    signalId: `weather_${dayContext?.date?.isoDate || 'today'}`,
    category: 'weather',
    text: `${dayContext?.weather?.summary || 'Current weather'} around ${dayContext?.location?.city || 'the city'}.`,
    sourceType: 'signals',
    freshness: 'current',
    directiveness: 'low'
  });

  const trendItems = [
    ...(ambientOverride.trendingTopics || []),
    ...((signals.trends || []).filter(Boolean))
  ]
    .map(cleanSignalText)
    .filter(Boolean)
    .slice(0, 6)
    .map((text, index) => ({
      signalId: `trend_${index + 1}`,
      category: 'trending_topics',
      text,
      sourceType: index < (ambientOverride.trendingTopics || []).length ? 'scenario' : 'signals',
      freshness: 'recent',
      directiveness: 'low'
    }));

  const cityTriviaItems = [
    ...(ambientOverride.cityTrivia || []),
    ...((signals.news || []).map(item => item?.title || ''))
  ]
    .map(cleanSignalText)
    .filter(text => text && !/failed/i.test(text))
    .slice(0, 6)
    .map((text, index) => ({
      signalId: `city_${index + 1}`,
      category: 'city_trivia',
      text,
      sourceType: index < (ambientOverride.cityTrivia || []).length ? 'scenario' : 'signals',
      freshness: 'recent',
      directiveness: 'low'
    }));

  const animeItems = (ambientOverride.animeFandom || [])
    .map(cleanSignalText)
    .filter(Boolean)
    .slice(0, 4)
    .map((text, index) => ({
      signalId: `anime_${index + 1}`,
      category: 'anime_fandom',
      text,
      sourceType: 'scenario',
      freshness: 'recent',
      directiveness: 'low'
    }));

  items.push(seasonalCue(dayContext));
  items.push(...trendItems, ...cityTriviaItems, ...animeItems);

  const filteredItems = items.filter(item => categories.size === 0 || categories.has(item.category));

  return {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    mode: 'weak_background_only',
    categories: Array.from(new Set(filteredItems.map(item => item.category))),
    items: filteredItems
  };
}

function buildAmbientStimulusPacket({ ambientSignalPool, policy = {}, seedKey = '' }) {
  const maxItems = Number(policy.maxItems || 8);
  const maxItemsPerCategory = Number(policy.maxItemsPerCategory || 2);
  const rng = createRng(seedKey || ambientSignalPool?.createdAt || '');
  const byCategory = new Map();

  for (const item of (ambientSignalPool?.items || [])) {
    const category = item.category || 'misc';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(item);
  }

  const selected = [];
  for (const [category, items] of byCategory.entries()) {
    const shuffled = shuffleWithRng(items, rng).slice(0, maxItemsPerCategory);
    selected.push(...shuffled.map(item => ({
      ...item,
      category,
      weakInfluenceOnly: true,
      cannotDirectlyChooseContent: true
    })));
  }

  const packetItems = shuffleWithRng(selected, rng).slice(0, maxItems);

  return {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    mode: 'category_balanced_shuffled_packet',
    packetRules: {
      shuffleRequired: Boolean(policy.shuffleRequired),
      directMappingForbidden: Boolean(policy.directMappingForbidden),
      mustFlowThroughResonance: Boolean(policy.mustFlowThroughResonance)
    },
    categoriesRepresented: Array.from(new Set(packetItems.map(item => item.category))),
    items: packetItems
  };
}

module.exports = {
  buildAmbientSignalPool,
  buildAmbientStimulusPacket
};
