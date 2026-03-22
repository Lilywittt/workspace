const { asStringArray, compactText } = require('./utils');

const CAPTURE_DIMENSION_VALUES = {
  cameraRelation: ['observational', 'self_held', 'mirror_mediated', 'companion_like', 'ambiguous'],
  faceReadability: ['not_required', 'glimpse', 'readable', 'expression_led'],
  bodyCoverage: ['hand_only', 'partial', 'half', 'three_quarter', 'full'],
  distance: ['macro', 'close', 'medium', 'wide'],
  environmentWeight: ['low', 'balanced', 'high']
};

const DEFAULT_CAPTURE_GUIDANCE_EN = {
  cameraRelation: {
    observational: 'the frame should feel witnessed from the outside, not automatically self-held',
    self_held: 'a self-held perspective is allowed when it still belongs to the same lived moment',
    mirror_mediated: 'mirror or reflected capture is allowed when the space naturally supports it',
    companion_like: 'the frame may feel as if observed from nearby without inventing a new interaction partner',
    ambiguous: 'keep the camera relation open enough that the frame does not need to declare who is holding it'
  },
  faceReadability: {
    not_required: 'the face does not need to be readable if the same moment stays legible through action, posture, or trace',
    glimpse: 'a brief or partial face glimpse is enough; do not force portrait dominance',
    readable: 'the face should be readable, but the lived event may still stay primary',
    expression_led: 'the protagonist expression should be clearly readable from the same lived moment'
  },
  bodyCoverage: {
    hand_only: 'a hand-dominant crop is allowed only when the event truly lives there',
    partial: 'partial body coverage is enough when it keeps the moment concrete',
    half: 'half-body coverage is allowed when it helps the action read cleanly',
    three_quarter: 'three-quarter body coverage is allowed when the same lived beat naturally supports it',
    full: 'full-body coverage is allowed when the same lived beat naturally supports it'
  },
  distance: {
    macro: 'macro or very close detail is allowed when it remains anchored to the same event',
    close: 'close framing is allowed when it helps the lived beat read more clearly',
    medium: 'medium distance is a stable everyday framing for ordinary daily-life moments',
    wide: 'wide framing is allowed when the environment carries part of the same lived beat'
  },
  environmentWeight: {
    low: 'the environment may stay secondary if the moment remains truthful',
    balanced: 'balance the protagonist and environment so they support the same lived beat together',
    high: 'the environment may carry significant weight if it stays ordinary and does not drown the protagonist'
  }
};

const DEFAULT_LANE_DEFAULTS = {
  selfie: {
    cameraRelation: 'self_held',
    faceReadability: 'expression_led',
    bodyCoverage: 'partial',
    distance: 'close',
    environmentWeight: 'balanced'
  },
  life_record: {
    cameraRelation: 'observational',
    faceReadability: 'glimpse',
    bodyCoverage: 'partial',
    distance: 'medium',
    environmentWeight: 'balanced'
  }
};

const DEFAULT_LANE_ALLOWANCES = {
  selfie: {
    cameraRelation: ['self_held', 'mirror_mediated', 'ambiguous'],
    faceReadability: ['readable', 'expression_led'],
    bodyCoverage: ['partial', 'half', 'three_quarter'],
    distance: ['close', 'medium'],
    environmentWeight: ['low', 'balanced']
  },
  life_record: {
    cameraRelation: ['observational', 'companion_like', 'ambiguous', 'self_held', 'mirror_mediated'],
    faceReadability: ['not_required', 'glimpse', 'readable'],
    bodyCoverage: ['hand_only', 'partial', 'half', 'three_quarter', 'full'],
    distance: ['macro', 'close', 'medium', 'wide'],
    environmentWeight: ['low', 'balanced', 'high']
  }
};

function dimensionKeys() {
  return Object.keys(CAPTURE_DIMENSION_VALUES);
}

function normalizeAllowedValues(rawValues = {}, fallback = CAPTURE_DIMENSION_VALUES) {
  return Object.fromEntries(dimensionKeys().map(key => {
    const configured = asStringArray(rawValues[key] || [], fallback[key].length)
      .filter(value => fallback[key].includes(value));
    return [key, configured.length > 0 ? configured : [...fallback[key]]];
  }));
}

function normalizeDimensionValue(value, allowedValues = [], fallback = '') {
  const normalized = compactText(value);
  if (allowedValues.includes(normalized)) {
    return normalized;
  }
  return compactText(fallback);
}

function normalizeCaptureTarget(rawTarget = {}, allowedValues = CAPTURE_DIMENSION_VALUES, fallbackTarget = {}) {
  return Object.fromEntries(dimensionKeys().map(key => ([
    key,
    normalizeDimensionValue(rawTarget?.[key], allowedValues[key], fallbackTarget[key] || '')
  ])));
}

function normalizeCaptureOverride(rawOverride = {}, allowedValues = CAPTURE_DIMENSION_VALUES) {
  const override = {};
  for (const key of dimensionKeys()) {
    const normalized = normalizeDimensionValue(rawOverride?.[key], allowedValues[key], '');
    if (normalized) {
      override[key] = normalized;
    }
  }
  return override;
}

function normalizeLaneAllowances(rawAllowances = {}, allowedValues = CAPTURE_DIMENSION_VALUES, fallbackAllowances = DEFAULT_LANE_ALLOWANCES.life_record) {
  return Object.fromEntries(dimensionKeys().map(key => {
    const configured = asStringArray(rawAllowances?.[key] || [], allowedValues[key].length)
      .filter(value => allowedValues[key].includes(value));
    const fallback = (fallbackAllowances[key] || []).filter(value => allowedValues[key].includes(value));
    return [key, configured.length > 0 ? configured : fallback];
  }));
}

function normalizeCapturePolicy(rawPolicy = {}) {
  const allowedValues = normalizeAllowedValues(rawPolicy.allowedValues || {}, CAPTURE_DIMENSION_VALUES);
  const configuredGuidance = rawPolicy?.guidanceEn && typeof rawPolicy.guidanceEn === 'object'
    ? rawPolicy.guidanceEn
    : {};

  const guidanceEn = Object.fromEntries(dimensionKeys().map(key => {
    const configuredDimension = configuredGuidance[key] && typeof configuredGuidance[key] === 'object'
      ? configuredGuidance[key]
      : {};
    return [key, Object.fromEntries(allowedValues[key].map(value => ([
      value,
      compactText(configuredDimension[value] || DEFAULT_CAPTURE_GUIDANCE_EN[key][value] || '')
    ])))];
  }));

  return {
    allowedValues,
    guidanceEn,
    laneDefaults: {
      selfie: normalizeCaptureTarget(
        rawPolicy?.laneDefaults?.selfie || {},
        allowedValues,
        DEFAULT_LANE_DEFAULTS.selfie
      ),
      life_record: normalizeCaptureTarget(
        rawPolicy?.laneDefaults?.life_record || {},
        allowedValues,
        DEFAULT_LANE_DEFAULTS.life_record
      )
    },
    laneAllowances: {
      selfie: normalizeLaneAllowances(
        rawPolicy?.laneAllowances?.selfie || {},
        allowedValues,
        DEFAULT_LANE_ALLOWANCES.selfie
      ),
      life_record: normalizeLaneAllowances(
        rawPolicy?.laneAllowances?.life_record || {},
        allowedValues,
        DEFAULT_LANE_ALLOWANCES.life_record
      )
    }
  };
}

function laneKeyFrom(lane = '') {
  return compactText(lane) === 'selfie' ? 'selfie' : 'life_record';
}

function laneDefaultCaptureTarget(postingBehavior = {}, lane = 'life_record') {
  const policy = normalizeCapturePolicy(postingBehavior.capturePolicy || {});
  return { ...policy.laneDefaults[laneKeyFrom(lane)] };
}

function laneCaptureAllowances(postingBehavior = {}, lane = 'life_record') {
  const policy = normalizeCapturePolicy(postingBehavior.capturePolicy || {});
  return Object.fromEntries(dimensionKeys().map(key => ([
    key,
    [...(policy.laneAllowances[laneKeyFrom(lane)][key] || [])]
  ])));
}

function mergeCaptureTarget(baseTarget = {}, override = {}) {
  return Object.fromEntries(dimensionKeys().map(key => ([
    key,
    compactText(override[key] || baseTarget[key] || '')
  ])));
}

function mergeAllowancesWithOverride(allowances = {}, override = {}) {
  return Object.fromEntries(dimensionKeys().map(key => {
    const values = [...(allowances[key] || [])];
    const overrideValue = compactText(override[key] || '');
    if (overrideValue && !values.includes(overrideValue)) {
      values.push(overrideValue);
    }
    return [key, values];
  }));
}

function buildCaptureGuidanceLines(policy, target) {
  return dimensionKeys().map(key => compactText(policy?.guidanceEn?.[key]?.[target?.[key]] || ''))
    .filter(Boolean);
}

function buildCaptureSummaryEn(target = {}) {
  return compactText([
    target.cameraRelation ? `${target.cameraRelation} camera relation` : '',
    target.distance ? `${target.distance} distance` : '',
    target.bodyCoverage ? `${target.bodyCoverage} body coverage` : '',
    target.faceReadability ? `${target.faceReadability} face readability` : '',
    target.environmentWeight ? `${target.environmentWeight} environment weight` : ''
  ].filter(Boolean).join(', '));
}

function buildCaptureIntent({ characterProfile = {}, characterRuntime = {}, contentIntent = {}, scenario = {} }) {
  const postingBehavior = characterProfile.postingBehavior || {};
  const lane = compactText(
    contentIntent?.lane
      || characterRuntime?.postingTendency?.preferredLane
      || postingBehavior.defaultPreferredLane
      || 'life_record'
  );
  const policy = normalizeCapturePolicy(postingBehavior.capturePolicy || {});
  const laneKey = laneKeyFrom(lane);
  const personaLaneDefault = { ...policy.laneDefaults[laneKey] };
  const rawOverride = (
    scenario?.contentIntent?.captureIntent && typeof scenario.contentIntent.captureIntent === 'object'
      ? scenario.contentIntent.captureIntent
      : (scenario?.captureIntent && typeof scenario.captureIntent === 'object'
        ? scenario.captureIntent
        : {})
  );
  const scenarioOverride = normalizeCaptureOverride(rawOverride, policy.allowedValues);
  const resolvedTarget = mergeCaptureTarget(personaLaneDefault, scenarioOverride);
  const allowances = mergeAllowancesWithOverride(policy.laneAllowances[laneKey], scenarioOverride);
  const hasOverride = Object.keys(scenarioOverride).length > 0;

  return {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    lane,
    sourceMode: hasOverride ? 'scenario_override' : 'persona_lane_default',
    personaLaneDefault,
    scenarioOverride,
    allowances,
    resolvedTarget,
    summaryEn: buildCaptureSummaryEn(resolvedTarget),
    guidanceEn: buildCaptureGuidanceLines(policy, resolvedTarget),
    notesEn: asStringArray(scenario?.contentIntent?.captureNotesEn || [], 4)
  };
}

module.exports = {
  CAPTURE_DIMENSION_VALUES,
  DEFAULT_CAPTURE_GUIDANCE_EN,
  DEFAULT_LANE_ALLOWANCES,
  DEFAULT_LANE_DEFAULTS,
  buildCaptureIntent,
  buildCaptureSummaryEn,
  laneCaptureAllowances,
  laneDefaultCaptureTarget,
  normalizeCaptureOverride,
  normalizeCapturePolicy,
  normalizeCaptureTarget,
  normalizeDimensionValue
};
