const fs = require('fs');
const path = require('path');

const dataDir = process.env.IG_PIPELINE_DATA_DIR || path.resolve(__dirname, '..', '..', '..', 'data', 'ig_roleplay');
const configPath = process.env.IG_PIPELINE_CONFIG || path.join(dataDir, 'pipeline.config.json');
const signalsPath = path.join(dataDir, 'signals.json');

function readJson(filePath, fallback = {}) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const cleaned = raw.replace(/^\uFEFF/, '');
    return JSON.parse(cleaned);
  } catch (err) {
    return fallback;
  }
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function weatherSummary(code) {
  const map = {
    0: '晴朗',
    1: '多云',
    2: '多云',
    3: '阴天',
    45: '有雾',
    48: '有雾',
    51: '小毛毛雨',
    53: '毛毛雨',
    55: '较强毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    80: '阵雨',
    81: '强阵雨',
    82: '暴雨',
    95: '雷暴',
    96: '雷暴伴小冰雹',
    99: '雷暴伴大冰雹'
  };
  return map[code] || '天气变化';
}

function extractTrendsFromTitles(titles, maxKeywords, language = 'zh') {
  if (!titles.length) return [];

  // If Chinese, keep full short titles as topics
  const cjkRegex = /[\u4e00-\u9fff]/;
  const topics = [];

  for (const title of titles) {
    if (!title) continue;
    if (cjkRegex.test(title)) {
      topics.push(title.trim());
    } else {
      // simple word frequency for non-CJK
      const words = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .filter(w => w.length >= 3);
      topics.push(words.slice(0, 3).join(' '));
    }
  }

  const uniq = [];
  const seen = new Set();
  for (const t of topics) {
    const key = t.slice(0, 40);
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push(t);
    }
    if (uniq.length >= maxKeywords) break;
  }
  return uniq;
}

async function main() {
  const config = readJson(configPath, {});
  const now = new Date();

  const location = config.location || {};
  const language = config.language || 'zh';

  let latitude = location.latitude;
  let longitude = location.longitude;
  let timezone = config.timezone || location.timezone || 'auto';

  let geoInfo = null;
  if ((!latitude || !longitude) && location.name) {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.name)}&count=1&language=${encodeURIComponent(language)}&format=json`;
    try {
      const geo = await fetchJson(geoUrl);
      if (geo && geo.results && geo.results.length > 0) {
        geoInfo = geo.results[0];
        latitude = geoInfo.latitude;
        longitude = geoInfo.longitude;
        timezone = geoInfo.timezone || timezone;
      }
    } catch (err) {
      // swallow and continue with provided coords
    }
  }

  let weather = null;
  if (config.signals?.weather?.enabled && latitude && longitude) {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,precipitation&timezone=${encodeURIComponent(timezone)}`;
    try {
      const weatherJson = await fetchJson(weatherUrl);
      const current = weatherJson.current || {};
      weather = {
        temperature_c: current.temperature_2m,
        weather_code: current.weather_code,
        wind_speed_kmh: current.wind_speed_10m,
        precipitation_mm: current.precipitation,
        summary: weatherSummary(current.weather_code)
      };
    } catch (err) {
      weather = { error: `weather_fetch_failed: ${err.message}` };
    }
  }

  let news = [];
  if (config.signals?.news?.enabled && config.signals?.news?.query) {
    const q = config.signals.news.query;
    const maxrecords = config.signals.news.maxrecords || 12;
    const timespan = config.signals.news.timespan || '1d';
    const sort = config.signals.news.sort || 'datedesc';
    const newsUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&format=json&maxrecords=${maxrecords}&timespan=${encodeURIComponent(timespan)}&sort=${encodeURIComponent(sort)}`;
    try {
      const newsJson = await fetchJson(newsUrl);
      const articles = Array.isArray(newsJson.articles) ? newsJson.articles : [];
      news = articles.map(a => ({
        title: a.title,
        url: a.url,
        source: a.sourceCountry || a.source || null,
        seendate: a.seendate || null
      })).filter(a => a.title);
    } catch (err) {
      news = [{ title: `news_fetch_failed: ${err.message}`, url: null, source: null, seendate: null }];
    }
  }

  let trends = [];
  if (config.signals?.trends?.enabled) {
    const maxKeywords = config.signals.trends.maxKeywords || 8;
    const titles = news.map(n => n.title).filter(Boolean);
    trends = extractTrendsFromTitles(titles, maxKeywords, language);
  }

  const signals = {
    date: now.toISOString().slice(0, 10),
    location: {
      name: location.name || (geoInfo && geoInfo.name) || 'unknown',
      latitude: latitude || null,
      longitude: longitude || null,
      timezone
    },
    weather,
    news,
    trends,
    notes: [
      'signals由 update_signals.js 自动生成'
    ]
  };

  writeJson(signalsPath, signals);
  console.log(`signals updated: ${signalsPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
