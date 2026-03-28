const anilistGraphql = require('./collectors/anilist_graphql');
const gdeltNews = require('./collectors/gdelt_news');
const htmlLinkList = require('./collectors/html_link_list');
const inlineItems = require('./collectors/inline_items');
const openMeteoWeather = require('./collectors/open_meteo_weather');
const rssFeed = require('./collectors/rss_feed');

const DEFAULT_COLLECTORS = [
  anilistGraphql,
  gdeltNews,
  htmlLinkList,
  inlineItems,
  openMeteoWeather,
  rssFeed
];

function createCollectorRegistry(extraCollectors = []) {
  const table = new Map();

  for (const collector of [...DEFAULT_COLLECTORS, ...extraCollectors]) {
    if (!collector?.kind || typeof collector.collect !== 'function') {
      continue;
    }
    table.set(String(collector.kind), collector.collect);
  }

  const collectorTable = Object.freeze(Object.fromEntries(table.entries()));

  return {
    collectorForSource(source = {}) {
      return collectorTable[source.kind];
    },
    collectorTable,
    kinds: Object.freeze(Object.keys(collectorTable))
  };
}

const defaultRegistry = createCollectorRegistry();

module.exports = {
  DEFAULT_COLLECTORS,
  collectorForSource: defaultRegistry.collectorForSource,
  collectorTable: defaultRegistry.collectorTable,
  collectorKinds: defaultRegistry.kinds,
  createCollectorRegistry
};
