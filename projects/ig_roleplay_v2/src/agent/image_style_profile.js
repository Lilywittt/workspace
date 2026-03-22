const { readJsonRequired } = require('../common/runtime');
const { asStringArray, compactText, uniqueStrings } = require('./utils');

const STYLE_DIMENSION_VALUES = {
  lineCrispness: ['soft_clean', 'clean_crisp', 'sharp_crisp'],
  contrastDepth: ['soft_low', 'controlled_clear', 'strong_clear'],
  colorRichness: ['restrained', 'balanced_rich', 'vivid_rich'],
  colorSeparation: ['soft_blend', 'balanced_local', 'clear_local'],
  edgeReadability: ['soft_edges', 'clear_edges', 'crisp_edges'],
  depthSeparation: ['gentle_depth', 'layered_depth', 'strong_separation']
};

const DEFAULT_STYLE_DIMENSIONS = {
  lineCrispness: 'clean_crisp',
  contrastDepth: 'controlled_clear',
  colorRichness: 'balanced_rich',
  colorSeparation: 'clear_local',
  edgeReadability: 'clear_edges',
  depthSeparation: 'layered_depth'
};

const STYLE_DIMENSION_PROMPTS = {
  lineCrispness: {
    soft_clean: {
      positive: 'soft clean anime linework',
      negative: 'harsh scratchy linework'
    },
    clean_crisp: {
      positive: 'clean crisp anime linework',
      negative: 'blurry linework'
    },
    sharp_crisp: {
      positive: 'sharper anime linework with confident edge control',
      negative: 'soft unfocused linework'
    }
  },
  contrastDepth: {
    soft_low: {
      positive: 'soft low-contrast rendering',
      negative: 'crushed harsh contrast'
    },
    controlled_clear: {
      positive: 'controlled clear contrast',
      negative: 'washed out contrast'
    },
    strong_clear: {
      positive: 'stronger clear contrast without losing anime softness',
      negative: 'flat low-contrast rendering'
    }
  },
  colorRichness: {
    restrained: {
      positive: 'restrained color richness',
      negative: 'oversaturated loud palette'
    },
    balanced_rich: {
      positive: 'balanced color richness',
      negative: 'muddy clothing colors'
    },
    vivid_rich: {
      positive: 'richer vivid anime color treatment without neon overload',
      negative: 'dull desaturated color treatment'
    }
  },
  colorSeparation: {
    soft_blend: {
      positive: 'soft color transitions',
      negative: 'muddy local color separation'
    },
    balanced_local: {
      positive: 'balanced local color separation',
      negative: 'colors blending into each other'
    },
    clear_local: {
      positive: 'clear local color separation',
      negative: 'color regions collapsing into flat mud'
    }
  },
  edgeReadability: {
    soft_edges: {
      positive: 'soft but readable clothing and object edges',
      negative: 'overly hard cutout edges'
    },
    clear_edges: {
      positive: 'clear clothing seam and object edge readability',
      negative: 'flat fabric rendering'
    },
    crisp_edges: {
      positive: 'crisper edge readability on clothing, props, and silhouette',
      negative: 'smeared clothing and prop edges'
    }
  },
  depthSeparation: {
    gentle_depth: {
      positive: 'gentle foreground-background separation',
      negative: 'background isolation so strong it breaks everyday realism'
    },
    layered_depth: {
      positive: 'layered subject-background separation',
      negative: 'flat depth with no foreground-background hierarchy'
    },
    strong_separation: {
      positive: 'stronger subject-background separation while keeping a natural anime slice-of-life feel',
      negative: 'subject and background collapsing into one flat plane'
    }
  }
};

function styleDimensionKeys() {
  return Object.keys(STYLE_DIMENSION_VALUES);
}

function normalizeStyleDimension(value, allowedValues = [], fallback = '') {
  const normalized = compactText(value);
  if (allowedValues.includes(normalized)) {
    return normalized;
  }
  return compactText(fallback);
}

function normalizeStyleDimensions(rawDimensions = {}) {
  return Object.fromEntries(styleDimensionKeys().map(key => ([
    key,
    normalizeStyleDimension(
      rawDimensions?.[key],
      STYLE_DIMENSION_VALUES[key],
      DEFAULT_STYLE_DIMENSIONS[key]
    )
  ])));
}

function buildDerivedStylePrompts(styleDimensions) {
  const positive = [];
  const negative = [];

  for (const key of styleDimensionKeys()) {
    const choice = styleDimensions[key];
    const promptSet = STYLE_DIMENSION_PROMPTS[key]?.[choice] || {};
    if (promptSet.positive) {
      positive.push(promptSet.positive);
    }
    if (promptSet.negative) {
      negative.push(promptSet.negative);
    }
  }

  return {
    positive,
    negative
  };
}

function buildStyleSummaryEn(styleDimensions) {
  return compactText([
    styleDimensions.lineCrispness ? `line ${styleDimensions.lineCrispness}` : '',
    styleDimensions.contrastDepth ? `contrast ${styleDimensions.contrastDepth}` : '',
    styleDimensions.colorRichness ? `color richness ${styleDimensions.colorRichness}` : '',
    styleDimensions.colorSeparation ? `color separation ${styleDimensions.colorSeparation}` : '',
    styleDimensions.edgeReadability ? `edge readability ${styleDimensions.edgeReadability}` : '',
    styleDimensions.depthSeparation ? `depth separation ${styleDimensions.depthSeparation}` : ''
  ].filter(Boolean).join(', '));
}

function normalizeImageStyleProfile(raw = {}) {
  const styleDimensions = normalizeStyleDimensions(raw.styleDimensions || {});
  const derivedPrompts = buildDerivedStylePrompts(styleDimensions);

  return {
    version: compactText(raw.version || '3.0.0-alpha.1'),
    profileId: compactText(raw.profileId || 'default_neutral_anime_render'),
    styleIntentZh: compactText(
      raw.styleIntentZh
        || '只调整最终生图的画工与渲染表现，不改变人物设定、叙事事件、道具关系、场景事实或构图语义。'
    ),
    styleDimensions,
    styleSummaryEn: buildStyleSummaryEn(styleDimensions),
    styleDimensionPositiveEn: uniqueStrings(derivedPrompts.positive, 12),
    styleDimensionNegativeEn: uniqueStrings(derivedPrompts.negative, 12),
    stylePositiveEn: uniqueStrings(raw.stylePositiveEn || [], 12),
    styleNegativeEn: uniqueStrings(raw.styleNegativeEn || [], 12),
    guardrailsEn: uniqueStrings(raw.guardrailsEn || [], 8)
  };
}

function loadImageStyleProfile(filePath) {
  return normalizeImageStyleProfile(readJsonRequired(filePath, 'image style profile'));
}

module.exports = {
  DEFAULT_STYLE_DIMENSIONS,
  STYLE_DIMENSION_PROMPTS,
  STYLE_DIMENSION_VALUES,
  loadImageStyleProfile,
  normalizeImageStyleProfile,
  normalizeStyleDimension,
  normalizeStyleDimensions
};
