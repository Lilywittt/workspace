const { compactText } = require('./shared');

const ENTRY_COLLECTIONS = [
  'animeFandom',
  'news',
  'localEvents',
  'popCulture',
  'socialChatter',
  'externalSignals'
];

const DEFAULT_PROFILES = ['normalize_text_fields'];
const ENCLOSED_NUMBER_MAP = Object.freeze({
  '\u2460': '1',
  '\u2461': '2',
  '\u2462': '3',
  '\u2463': '4',
  '\u2464': '5',
  '\u2465': '6',
  '\u2466': '7',
  '\u2467': '8',
  '\u2468': '9',
  '\u2469': '10',
  '\u246a': '11',
  '\u246b': '12',
  '\u246c': '13',
  '\u246d': '14',
  '\u246e': '15',
  '\u246f': '16',
  '\u2470': '17',
  '\u2471': '18',
  '\u2472': '19',
  '\u2473': '20'
});

function normalizeTextValue(value = '') {
  return compactText(String(value || '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, '\'')
    .replace(/[\u2012-\u2015]/g, '-'));
}

function normalizeStringArray(values = []) {
  return values
    .map(item => normalizeTextValue(item))
    .filter(Boolean);
}

function cleanRecordStrings(record = {}) {
  const next = {};

  for (const [key, value] of Object.entries(record || {})) {
    if (typeof value === 'string') {
      next[key] = normalizeTextValue(value);
      continue;
    }
    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      next[key] = normalizeStringArray(value);
      continue;
    }
    next[key] = value;
  }

  return next;
}

function mapEntryCollections(output = {}, mapEntry) {
  const next = { ...output };

  for (const category of ENTRY_COLLECTIONS) {
    if (!Array.isArray(output[category])) continue;
    next[category] = output[category].map(entry => mapEntry(entry, category));
  }

  return next;
}

function mapEntryTextFields(output = {}, transformText) {
  return mapEntryCollections(output, entry => {
    const next = { ...entry };
    for (const key of ['title', 'text']) {
      if (typeof next[key] === 'string') {
        next[key] = transformText(next[key], entry, key);
      }
    }
    return next;
  });
}

function normalizeOutputStrings(output = {}) {
  const next = mapEntryCollections(output, entry => cleanRecordStrings(entry));

  if (output.resolvedLocation) {
    next.resolvedLocation = cleanRecordStrings(output.resolvedLocation);
  }
  if (output.weather) {
    next.weather = cleanRecordStrings(output.weather);
  }
  if (output.airQuality) {
    next.airQuality = cleanRecordStrings(output.airQuality);
  }
  if (Array.isArray(output.sourceHealth)) {
    next.sourceHealth = output.sourceHealth.map(record => cleanRecordStrings(record));
  }
  if (Array.isArray(output.trends)) {
    next.trends = normalizeStringArray(output.trends);
  }
  if (Array.isArray(output.notes)) {
    next.notes = normalizeStringArray(output.notes);
  }

  return next;
}

function replaceEnclosedSeriesNumbers(text = '') {
  return normalizeTextValue(text)
    .replace(/[\u2460-\u2473]/g, match => ENCLOSED_NUMBER_MAP[match] || match)
    .replace(/([A-Za-z])(\d{1,2})(?=[\]\s":])/g, '$1 $2');
}

function replaceUnmatchedLabelBracket(text = '') {
  return normalizeTextValue(text)
    .replace(/^([^[][\s\S]{0,80}?)\]\s+(?=["'(A-Za-z0-9])/u, (_, prefix) => `${compactText(prefix)}: `);
}

const DEFAULT_PROCESSORS = Object.freeze({
  normalize_text_fields: ({ output }) => normalizeOutputStrings(output),
  enclosed_series_numbers: ({ output }) => mapEntryTextFields(output, replaceEnclosedSeriesNumbers),
  unmatched_label_brackets: ({ output }) => mapEntryTextFields(output, replaceUnmatchedLabelBracket)
});

function normalizeExtraProcessors(extraProcessors = {}) {
  if (Array.isArray(extraProcessors)) {
    return Object.fromEntries(extraProcessors
      .filter(item => item && typeof item.id === 'string' && typeof item.run === 'function')
      .map(item => [item.id, item.run]));
  }

  return extraProcessors || {};
}

function createSourcePostprocessRegistry(extraProcessors = {}) {
  const table = {
    ...DEFAULT_PROCESSORS,
    ...normalizeExtraProcessors(extraProcessors)
  };

  return {
    applySourcePostprocess({
      source = {},
      output = {},
      runtimeContext = {}
    }) {
      const profileIds = Array.isArray(source.postprocessProfiles) && source.postprocessProfiles.length > 0
        ? source.postprocessProfiles
        : DEFAULT_PROFILES;

      return profileIds.reduce((currentOutput, profileId) => {
        const processor = table[profileId];
        if (typeof processor !== 'function') {
          return currentOutput;
        }
        return processor({
          source,
          output: currentOutput,
          runtimeContext
        }) || currentOutput;
      }, output);
    },
    processors: Object.freeze({ ...table }),
    profileIds: Object.freeze(Object.keys(table))
  };
}

const defaultRegistry = createSourcePostprocessRegistry();

module.exports = {
  DEFAULT_POSTPROCESS_PROFILES: DEFAULT_PROFILES,
  applySourcePostprocess: defaultRegistry.applySourcePostprocess,
  createSourcePostprocessRegistry
};
