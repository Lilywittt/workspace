const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collectSignals,
  parseHtmlListItems
} = require('../src/agent/signal_collection');

function makeResponse(payload, mode = 'json') {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => (mode === 'text' ? payload : JSON.stringify(payload))
  };
}

test('parseHtmlListItems extracts titled list entries from mixed event markup', () => {
  const html = `
    <ul>
      <li>
        <a href="/events/01.html" title="Sporting events, performances &amp; exhibitions in March">
          <p class="detail">A citywide round-up of spring events.</p>
        </a>
      </li>
      <li>
        <a href="/en/event/03.html" class="post_item">
          <span class="date">Mar 22 - Mar 31, 2026</span>
          <span class="txt">Akihabara spring stamp rally</span>
        </a>
      </li>
      <li>
        <a href="/plain/02.html" title="Visa policy update">
          <p class="detail">Administrative notice.</p>
        </a>
      </li>
    </ul>
  `;

  const entries = parseHtmlListItems(html, {
    url: 'https://www.gotokyo.org/en/calendar/index.html',
    hrefIncludes: ['/en/event/', '/events/'],
    includeTextPatterns: ['event', 'exhibition', 'festival', 'stamp rally']
  });

  assert.equal(entries.length, 2);
  assert.equal(entries[0].title, 'Sporting events, performances & exhibitions in March');
  assert.match(entries[0].url, /\/events\/01\.html$/);
  assert.equal(entries[1].title, 'Akihabara spring stamp rally');
});

test('collectSignals merges Tokyo city signals and gives anime-related feeds their own richer channel', async () => {
  const collectionConfig = {
    config: {
      limits: {
        animeFandom: 6,
        news: 6,
        trends: 4,
        localEvents: 4,
        popCulture: 4,
        externalSignals: 6
      },
      sources: [
        {
          id: 'weather_open_meteo',
          kind: 'open_meteo_weather',
          enabled: true,
          sourceLabel: 'Open-Meteo',
          airQualityCurrent: ['pm10', 'pm2_5', 'us_aqi', 'uv_index']
        },
        {
          id: 'city_brief_gdelt',
          kind: 'gdelt_news',
          enabled: true,
          sourceLabel: 'GDELT',
          query: 'Tokyo',
          maxRecords: 4,
          trendKeywords: 3
        },
        {
          id: 'tokyo_calendar_gotokyo',
          kind: 'html_link_list',
          enabled: true,
          sourceLabel: 'GO TOKYO',
          category: 'localEvents',
          url: 'https://www.gotokyo.org/en/calendar/index.html',
          limit: 4,
          hrefIncludes: ['/en/event/']
        },
        {
          id: 'tokyo_anime_station_feed',
          kind: 'rss_feed',
          enabled: true,
          sourceLabel: 'Anime Tokyo Station',
          category: 'animeFandom',
          url: 'https://animetokyo.jp/en/events/event/feed/',
          limit: 4,
          priorityWeight: 3
        },
        {
          id: 'anilist_trending_anime',
          kind: 'anilist_graphql',
          enabled: true,
          sourceLabel: 'AniList',
          category: 'animeFandom',
          limit: 4,
          seasonOnly: true,
          priorityWeight: 2
        }
      ]
    }
  };

  const pipelineConfig = {
    location: {
      name: 'Tokyo',
      latitude: 35.6764,
      longitude: 139.65
    },
    timezone: 'Asia/Tokyo',
    language: 'zh'
  };

  const fetchImpl = async (url) => {
    if (url.startsWith('https://api.open-meteo.com/v1/forecast')) {
      return makeResponse({
        current: {
          temperature_2m: 16.2,
          relative_humidity_2m: 78,
          apparent_temperature: 15.5,
          precipitation: 0.4,
          weather_code: 61,
          wind_speed_10m: 12.4,
          cloud_cover: 86
        }
      });
    }
    if (url.startsWith('https://air-quality-api.open-meteo.com/v1/air-quality')) {
      return makeResponse({
        current: {
          pm10: 42,
          pm2_5: 24,
          us_aqi: 68,
          uv_index: 2.4
        }
      });
    }
    if (url.startsWith('https://api.gdeltproject.org/api/v2/doc/doc')) {
      return makeResponse({
        articles: [
          {
            title: 'Night museum opening brings a new wave of visitors to Tokyo',
            url: 'https://example.com/news-1',
            sourcecountry: 'Japan',
            seendate: '20260324T141500Z'
          },
          {
            title: 'Akihabara spring goods fair returns this weekend',
            url: 'https://example.com/news-2',
            sourcecountry: 'Japan',
            seendate: '20260324T141700Z'
          }
        ]
      });
    }
    if (url === 'https://www.gotokyo.org/en/calendar/index.html') {
      return makeResponse(`
        <ul class="slick_slide_list">
          <li>
            <a href="/en/event/ota/20260324-one.html" class="post_item">
              <span class="date">Mar 24, 2026 - Mar 31, 2026</span>
              <span class="txt">Akihabara spring collector fair</span>
            </a>
          </li>
          <li>
            <a href="/en/event/shibuya/20260325-two.html" class="post_item">
              <span class="date">Mar 25, 2026 - Apr 02, 2026</span>
              <span class="txt">Late-night animation soundtrack showcase</span>
            </a>
          </li>
        </ul>
      `, 'text');
    }
    if (url === 'https://animetokyo.jp/en/events/event/feed/') {
      return makeResponse(`
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Rurouni Kenshin Anime Archive Exhibition</title>
              <link>https://animetokyo.jp/en/archives/events/events61/</link>
              <description>This exhibition features original drawings and production materials from the anime series.</description>
              <pubDate>Thu, 19 Feb 2026 10:12:39 +0000</pubDate>
            </item>
            <item>
              <title>Lets make a somatrope workshop</title>
              <link>https://animetokyo.jp/en/archives/events/workshop65/</link>
              <description>A hands-on workshop tied to animation techniques.</description>
              <pubDate>Thu, 19 Mar 2026 06:54:30 +0000</pubDate>
            </item>
          </channel>
        </rss>
      `, 'text');
    }
    if (url === 'https://graphql.anilist.co') {
      return makeResponse({
        data: {
          Page: {
            media: [
              {
                id: 166613,
                title: {
                  native: '地狱乐 第二期',
                  english: 'Hells Paradise Season 2',
                  romaji: 'Jigokuraku 2nd Season'
                },
                season: 'WINTER',
                seasonYear: 2026
              },
              {
                id: 21,
                title: {
                  native: 'ONE PIECE',
                  english: 'ONE PIECE',
                  romaji: 'ONE PIECE'
                },
                season: 'FALL',
                seasonYear: 1999
              }
            ]
          }
        }
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const { signals } = await collectSignals({
    collectionConfig,
    pipelineConfig,
    fetchImpl,
    now: new Date('2026-03-24T10:00:00.000Z')
  });

  assert.equal(signals.weather.summary, '小雨');
  assert.equal(signals.localEvents.length, 2);
  assert.equal(signals.animeFandom.length, 3);
  assert.equal(signals.popCulture.length, 0);
  assert.ok(signals.trends.length > 0);
  assert.ok(signals.externalSignals.some(item => item.signalId === 'aqi_2026-03-24'));
  assert.ok(signals.animeFandom.some(item => item.priorityWeight >= 2));
  assert.ok(signals.collectionCoverage.activeCategories.includes('localEvents'));
  assert.ok(signals.collectionCoverage.activeCategories.includes('animeFandom'));
  assert.equal(signals.collectionCoverage.healthySources.length, 5);
});

test('collectSignals applies source postprocess profiles before merging connector output', async () => {
  const collectionConfig = {
    config: {
      limits: {
        animeFandom: 4
      },
      sources: [
        {
          id: 'tokyo_anime_station_feed',
          kind: 'html_link_list',
          enabled: true,
          sourceLabel: 'Anime Tokyo Station',
          category: 'animeFandom',
          url: 'https://animetokyo.jp/en/events/event/',
          limit: 4,
          hrefIncludes: ['/en/archives/events/'],
          postprocessProfiles: [
            'normalize_text_fields',
            'enclosed_series_numbers',
            'unmatched_label_brackets'
          ]
        }
      ]
    }
  };

  const pipelineConfig = {
    location: {
      name: 'Tokyo',
      latitude: 35.6764,
      longitude: 139.65
    },
    timezone: 'Asia/Tokyo',
    language: 'zh'
  };

  const fetchImpl = async (url) => {
    if (url === 'https://animetokyo.jp/en/events/event/') {
      return makeResponse(`
        <ul class="c-event-list__items">
          <li>
            <a href="/en/archives/events/events63/" class="post_item">
              <span class="txt">Animation Appreciation Party⑯] "Astro Boy (1980)" Episode 1 "The Birth of Astro Boy" (Japanese only)</span>
              <span class="date">Upcoming 2026.04.19 Special</span>
            </a>
          </li>
          <li>
            <a href="/en/archives/events/workshop65/" class="post_item">
              <span class="txt">Workshop] Let's make a somatrope!</span>
              <span class="date">Upcoming 2026.03.28 WS</span>
            </a>
          </li>
        </ul>
      `, 'text');
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const { signals } = await collectSignals({
    collectionConfig,
    pipelineConfig,
    fetchImpl,
    now: new Date('2026-03-24T10:00:00.000Z')
  });

  assert.equal(signals.animeFandom[0].title, 'Animation Appreciation Party 16: "Astro Boy (1980)" Episode 1 "The Birth of Astro Boy" (Japanese only)');
  assert.match(signals.animeFandom[0].text, /^Animation Appreciation Party 16:/);
  assert.equal(signals.animeFandom[1].title, 'Workshop: Let\'s make a somatrope!');
});
