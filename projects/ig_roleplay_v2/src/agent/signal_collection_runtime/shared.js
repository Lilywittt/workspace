const { compactText, slugify, uniqueStrings } = require('../utils');

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_LIMITS = {
  animeFandom: 8,
  news: 10,
  trends: 8,
  localEvents: 6,
  popCulture: 6,
  socialChatter: 6,
  externalSignals: 12
};

function stripTags(html) {
  return compactText(String(html || '').replace(/<[^>]+>/g, ' '));
}

function decodeHtml(value) {
  return compactText(String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#0*38;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x27;/gi, '\'')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, '\''));
}

function buildDateLabel(now = new Date()) {
  return new Date(now).toISOString().slice(0, 10);
}

function weatherSummary(code) {
  const map = {
    0: '\u6674\u6717',
    1: '\u591a\u4e91',
    2: '\u591a\u4e91',
    3: '\u9634\u5929',
    45: '\u6709\u96fe',
    48: '\u6709\u96fe',
    51: '\u5c0f\u6bdb\u6bdb\u96e8',
    53: '\u6bdb\u6bdb\u96e8',
    55: '\u8f83\u5f3a\u6bdb\u6bdb\u96e8',
    61: '\u5c0f\u96e8',
    63: '\u4e2d\u96e8',
    65: '\u5927\u96e8',
    71: '\u5c0f\u96ea',
    73: '\u4e2d\u96ea',
    75: '\u5927\u96ea',
    80: '\u9635\u96e8',
    81: '\u5f3a\u9635\u96e8',
    82: '\u66b4\u96e8',
    95: '\u96f7\u66b4',
    96: '\u96f7\u66b4\u4f34\u5c0f\u51b0\u96f9',
    99: '\u96f7\u66b4\u4f34\u5927\u51b0\u96f9'
  };
  return map[code] || '\u5929\u6c14\u53d8\u5316';
}

function aqiBand(usAqi) {
  const value = Number(usAqi);
  if (!Number.isFinite(value)) return '';
  if (value <= 50) return 'good';
  if (value <= 100) return 'moderate';
  if (value <= 150) return 'unhealthy_for_sensitive_groups';
  if (value <= 200) return 'unhealthy';
  return 'very_unhealthy';
}

function normalizeSource(raw = {}, index = 0) {
  return {
    ...raw,
    id: compactText(raw.id || `${compactText(raw.kind || 'source')}_${index + 1}`),
    kind: compactText(raw.kind || ''),
    enabled: raw.enabled !== false,
    category: compactText(raw.category || ''),
    sourceLabel: compactText(raw.sourceLabel || raw.id || raw.kind || `source_${index + 1}`),
    limit: Number(raw.limit || raw.maxItems || 6),
    priorityWeight: Math.max(1, Math.min(4, Number(raw.priorityWeight || 1) || 1)),
    timeoutMs: Number(raw.timeoutMs || DEFAULT_TIMEOUT_MS)
  };
}

function normalizeHeadline(text) {
  return compactText(String(text || '')
    .replace(/\s*[-|\uFF5C]\s*[^-|\uFF5C]+$/u, '')
    .replace(/\s*_[^_]+$/u, ''));
}

function extractDatedPath(rawUrl = '') {
  const match = String(rawUrl || '').match(/\/(20\d{2})(\d{2})(\d{2})(?:[^/]*)?(?:\/|\.html|$)/);
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function isFreshEnough(dateString = '', now = new Date(), maxAgeDays = 75) {
  if (!dateString) return true;
  const eventDate = Date.parse(`${dateString}T00:00:00Z`);
  if (!Number.isFinite(eventDate)) return true;
  const diffDays = (new Date(now).getTime() - eventDate) / (24 * 60 * 60 * 1000);
  return diffDays <= maxAgeDays;
}

function extractTrendsFromTitles(titles = [], maxKeywords = 8) {
  const topics = [];
  const cjkRegex = /[\u4e00-\u9fff]/;

  for (const title of titles) {
    const cleaned = normalizeHeadline(title);
    if (!cleaned) continue;

    if (cjkRegex.test(cleaned)) {
      topics.push(cleaned.slice(0, 28));
      continue;
    }

    const words = cleaned
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter(word => word.length >= 3)
      .slice(0, 4)
      .join(' ');

    if (words) topics.push(words);
  }

  return uniqueStrings(topics, maxKeywords);
}

function absoluteUrl(input, href) {
  try {
    return new URL(href, input).toString();
  } catch (err) {
    return compactText(href || '');
  }
}

function summarizeTextBits(...parts) {
  return compactText(parts.filter(Boolean).join(' '));
}

function containsAnyKeyword(text = '', keywords = []) {
  const haystack = compactText(text).toLowerCase();
  return (keywords || []).some(keyword => haystack.includes(String(keyword).toLowerCase()));
}

function entryFingerprint(entry = {}) {
  return slugify([
    entry.signalId,
    entry.title,
    entry.text,
    entry.url
  ].map(value => compactText(value)).filter(Boolean).join(' '), 'entry');
}

function dedupeEntries(entries = [], limit = 6) {
  const seen = new Set();
  const output = [];

  for (const entry of entries) {
    const key = entryFingerprint(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(entry);
    if (output.length >= limit) break;
  }

  return output;
}

function buildHealthRecord(record = {}) {
  return {
    sourceId: compactText(record.sourceId || ''),
    kind: compactText(record.kind || ''),
    sourceLabel: compactText(record.sourceLabel || ''),
    status: compactText(record.status || 'ok'),
    itemCount: Number(record.itemCount || 0),
    fetchedAt: compactText(record.fetchedAt || new Date().toISOString()),
    latencyMs: Number(record.latencyMs || 0),
    categories: uniqueStrings(record.categories || [], 6),
    note: compactText(record.note || '')
  };
}

function addHealthRecord(records, record = {}) {
  records.push(buildHealthRecord(record));
}

async function fetchWithTimeout(fetchImpl, url, {
  method = 'GET',
  headers = {},
  body = undefined,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(fetchImpl, url, options = {}) {
  const response = await fetchWithTimeout(fetchImpl, url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchText(fetchImpl, url, options = {}) {
  const response = await fetchWithTimeout(fetchImpl, url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

function parseHtmlListItems(html = '', source = {}) {
  const seenUrls = new Set();
  const blocks = [
    ...[...String(html || '').matchAll(/<li\b[\s\S]*?<\/li>/gi)].map(match => match[0]),
    ...[...String(html || '').matchAll(/<a\b[^>]*class="[^"]*\bpost_item\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi)].map(match => match[0])
  ];
  const includePatterns = (source.includeTextPatterns || []).map(item => String(item).toLowerCase());
  const hrefIncludes = (source.hrefIncludes || []).map(item => String(item));
  const output = [];

  for (const block of blocks) {
    const href = (block.match(/<a\b[^>]*href="([^"]+)"/i) || [])[1] || '';
    if (hrefIncludes.length > 0 && !hrefIncludes.some(pattern => href.includes(pattern))) {
      continue;
    }
    const absolute = absoluteUrl(source.url, href);
    if (seenUrls.has(absolute)) {
      continue;
    }
    const title = decodeHtml(
      (block.match(/<a\b[^>]*title="([^"]+)"/i) || [])[1]
        || (block.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i) || [])[1]
        || (block.match(/<span\b[^>]*class="[^"]*\btxt\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i) || [])[1]
        || (block.match(/<span>([\s\S]*?)<\/span>/i) || [])[1]
        || stripTags(block)
    );
    const detail = stripTags(decodeHtml(
      (block.match(/<p\b[^>]*class="[^"]*detail[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || [])[1]
        || (block.match(/<span\b[^>]*class="[^"]*\bdate\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i) || [])[1]
        || (block.match(/<div\b[^>]*class="[^"]*c-event-list__info[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1]
    ));

    if (!title) continue;
    if (includePatterns.length > 0) {
      const haystack = `${title} ${detail}`.toLowerCase();
      if (!includePatterns.some(pattern => haystack.includes(pattern))) {
        continue;
      }
    }

    output.push({
      title,
      detail,
      url: absolute
    });
    seenUrls.add(absolute);
  }

  return output;
}

function parseRssItems(xml = '') {
  const source = String(xml || '');
  const itemMatches = [...source.matchAll(/<item\b[\s\S]*?<\/item>/gi)];
  return itemMatches.map(match => {
    const item = match[0];
    return {
      title: decodeHtml((item.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]),
      link: decodeHtml((item.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]),
      description: stripTags(decodeHtml((item.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]))
        .replace(/The post .*? first appeared on .*?\.?/i, '')
        .trim(),
      pubDate: decodeHtml((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1])
    };
  });
}

module.exports = {
  DEFAULT_LIMITS,
  DEFAULT_TIMEOUT_MS,
  absoluteUrl,
  addHealthRecord,
  aqiBand,
  buildDateLabel,
  buildHealthRecord,
  compactText,
  containsAnyKeyword,
  decodeHtml,
  dedupeEntries,
  extractDatedPath,
  extractTrendsFromTitles,
  fetchJson,
  fetchText,
  isFreshEnough,
  normalizeHeadline,
  normalizeSource,
  parseHtmlListItems,
  parseRssItems,
  slugify,
  stripTags,
  summarizeTextBits,
  uniqueStrings,
  weatherSummary
};
