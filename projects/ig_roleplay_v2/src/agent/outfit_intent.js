const { asStringArray, compactText } = require('./utils');

function normalizeManualOutfitIntent(raw = {}) {
  return {
    directionEn: compactText(raw.directionEn || raw.vibeEn || ''),
    mustIncludeEn: asStringArray(raw.mustIncludeEn || raw.requireEn || [], 6),
    preferEn: asStringArray(raw.preferEn || raw.preferredCuesEn || [], 6),
    avoidEn: asStringArray(raw.avoidEn || [], 6),
    notesZh: asStringArray(raw.notesZh || [], 4)
  };
}

function resolveManualOutfitIntent(scenario = {}) {
  const nested = scenario?.contentIntent?.outfitIntent;
  if (nested && typeof nested === 'object') {
    return normalizeManualOutfitIntent(nested);
  }

  const direct = scenario?.outfitIntent;
  if (direct && typeof direct === 'object') {
    return normalizeManualOutfitIntent(direct);
  }

  return normalizeManualOutfitIntent({});
}

function buildOutfitIntent({
  characterProfile = {},
  dayContext = {},
  selectedMoment = {},
  contentIntent = {},
  scenario = {}
}) {
  const manual = resolveManualOutfitIntent(scenario);
  const hasManualOverride = Boolean(
    manual.directionEn
      || manual.mustIncludeEn.length > 0
      || manual.preferEn.length > 0
      || manual.avoidEn.length > 0
      || manual.notesZh.length > 0
  );
  const lane = compactText(
    contentIntent?.lane
      || selectedMoment?.lane
      || 'life_record'
  );
  const laneTendency = characterProfile?.clothing?.laneTendencies?.[lane] || {};

  return {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    lane,
    sourceMode: hasManualOverride ? 'scenario_override' : 'persona_policy_default',
    manualOverrideProvided: hasManualOverride,
    everydayMoodEn: compactText(characterProfile?.clothing?.everydayMoodEn || ''),
    laneVibeEn: compactText(laneTendency.vibeEn || ''),
    weather: compactText(dayContext?.weather?.summary || ''),
    routineWindow: compactText(dayContext?.time?.routineWindow || ''),
    currentContext: compactText(dayContext?.location?.currentContext || ''),
    selectedMomentSummaryZh: compactText(selectedMoment?.eventSummaryZh || ''),
    directionEn: manual.directionEn,
    mustIncludeEn: manual.mustIncludeEn,
    preferEn: manual.preferEn,
    avoidEn: manual.avoidEn,
    notesZh: manual.notesZh
  };
}

module.exports = {
  buildOutfitIntent,
  normalizeManualOutfitIntent,
  resolveManualOutfitIntent
};
