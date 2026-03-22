function compactText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values, limit = 12) {
  return Array.from(new Set((values || [])
    .map(item => compactText(item))
    .filter(Boolean)))
    .slice(0, limit);
}

function asStringArray(values, limit = 8) {
  return uniqueStrings(values, limit);
}

function slugify(value, fallback = 'item') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
}

function clampScore(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function parseLocalDateParts(dateString, timezone = 'Asia/Shanghai') {
  const source = dateString ? new Date(dateString) : new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  const parts = formatter.formatToParts(source).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour || 0),
    minute: Number(parts.minute || 0),
    weekday: parts.weekday || ''
  };
}

function daypartForHour(hour) {
  if (hour < 7) return 'early_morning';
  if (hour < 11) return 'late_morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  if (hour < 20) return 'early_evening';
  return 'night';
}

function weekdayMode(dateString) {
  const day = new Date(dateString).getDay();
  return day === 0 || day === 6 ? 'weekend' : 'school_day';
}

function weatherBucket(summary) {
  const text = compactText(summary).toLowerCase();
  if (/storm|thunder/.test(text)) return 'storm';
  if (/rain|drizzle|shower/.test(text)) return 'rain';
  if (/fog|mist/.test(text)) return 'mist';
  if (/cloud|overcast/.test(text)) return 'cloudy';
  return 'clear';
}

module.exports = {
  asStringArray,
  clampScore,
  compactText,
  daypartForHour,
  parseLocalDateParts,
  slugify,
  uniqueStrings,
  weatherBucket,
  weekdayMode
};
