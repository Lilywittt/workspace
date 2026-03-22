const { asStringArray, compactText } = require('./utils');

const DEFAULT_CHARACTER_PRESENCE_TARGETS = [
  'trace_only',
  'supporting_presence',
  'clear_character_presence',
  'expression_led'
];

const DEFAULT_CHARACTER_PRESENCE_GUIDANCE_EN = {
  trace_only: 'the same moment may stay trace-led if the event remains legible and truthful',
  supporting_presence: 'the protagonist should be readable through partial face, posture, clothing, or body action without forcing portrait dominance',
  clear_character_presence: 'the protagonist should be clearly readable in the frame through face, posture, or fuller-body action while the lived event stays primary',
  expression_led: 'the protagonist\'s facial expression and immediate emotional state should be clearly readable from the same lived moment'
};

function normalizeCharacterPresenceTarget(
  value,
  allowedTargets = DEFAULT_CHARACTER_PRESENCE_TARGETS,
  fallback = 'supporting_presence'
) {
  const normalized = compactText(value);
  if (allowedTargets.includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function normalizeCharacterPresencePolicy(rawPolicy = {}) {
  const configuredAllowedTargets = asStringArray(rawPolicy.allowedTargets || [], 8)
    .filter(target => DEFAULT_CHARACTER_PRESENCE_TARGETS.includes(target));
  const allowedTargets = configuredAllowedTargets.length > 0
    ? configuredAllowedTargets
    : [...DEFAULT_CHARACTER_PRESENCE_TARGETS];
  const defaultTarget = normalizeCharacterPresenceTarget(
    rawPolicy.defaultTarget,
    allowedTargets,
    'supporting_presence'
  );
  const configuredGuidance = rawPolicy?.targetGuidanceEn && typeof rawPolicy.targetGuidanceEn === 'object'
    ? rawPolicy.targetGuidanceEn
    : {};

  const targetGuidanceEn = Object.fromEntries(allowedTargets.map(target => ([
    target,
    compactText(configuredGuidance[target] || DEFAULT_CHARACTER_PRESENCE_GUIDANCE_EN[target])
  ])));

  return {
    allowedTargets,
    defaultTarget,
    targetGuidanceEn
  };
}

function laneDefaultCharacterPresenceTarget(postingBehavior = {}, lane = 'life_record') {
  const policy = normalizeCharacterPresencePolicy(postingBehavior.characterPresencePolicy || {});
  const laneRule = postingBehavior?.laneRules?.[lane] || {};
  const laneFallback = lane === 'selfie'
    ? 'expression_led'
    : policy.defaultTarget;

  return normalizeCharacterPresenceTarget(
    laneRule.characterPresenceTarget,
    policy.allowedTargets,
    laneFallback
  );
}

function characterPresenceGuidanceEn(postingBehavior = {}, target = 'supporting_presence') {
  const policy = normalizeCharacterPresencePolicy(postingBehavior.characterPresencePolicy || {});
  const normalizedTarget = normalizeCharacterPresenceTarget(
    target,
    policy.allowedTargets,
    policy.defaultTarget
  );
  return compactText(
    policy.targetGuidanceEn[normalizedTarget]
      || DEFAULT_CHARACTER_PRESENCE_GUIDANCE_EN[normalizedTarget]
  );
}

function buildContentIntent({ characterProfile = {}, characterRuntime = {}, scenario = {} }) {
  const postingBehavior = characterProfile.postingBehavior || {};
  const policy = normalizeCharacterPresencePolicy(postingBehavior.characterPresencePolicy || {});
  const lane = compactText(
    characterRuntime?.postingTendency?.preferredLane
      || postingBehavior.defaultPreferredLane
      || 'life_record'
  );
  const laneDefaultTarget = laneDefaultCharacterPresenceTarget(postingBehavior, lane);
  const rawScenarioOverrideTarget = compactText(
    scenario?.contentIntent?.characterPresenceTarget
      || scenario?.characterPresenceTarget
      || ''
  );
  const scenarioOverrideTarget = rawScenarioOverrideTarget
    ? normalizeCharacterPresenceTarget(
      rawScenarioOverrideTarget,
      policy.allowedTargets,
      laneDefaultTarget
    )
    : '';
  const characterPresenceTarget = scenarioOverrideTarget || laneDefaultTarget || policy.defaultTarget;

  return {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    lane,
    characterPresenceTarget,
    guidanceEn: characterPresenceGuidanceEn(postingBehavior, characterPresenceTarget),
    sourceMode: scenarioOverrideTarget ? 'scenario_override' : 'persona_lane_default',
    personaLaneDefaultTarget: laneDefaultTarget,
    scenarioOverrideTarget,
    allowedTargets: policy.allowedTargets,
    notesEn: asStringArray(scenario?.contentIntent?.notesEn || [], 4)
  };
}

module.exports = {
  DEFAULT_CHARACTER_PRESENCE_GUIDANCE_EN,
  DEFAULT_CHARACTER_PRESENCE_TARGETS,
  buildContentIntent,
  characterPresenceGuidanceEn,
  laneDefaultCharacterPresenceTarget,
  normalizeCharacterPresencePolicy,
  normalizeCharacterPresenceTarget
};
