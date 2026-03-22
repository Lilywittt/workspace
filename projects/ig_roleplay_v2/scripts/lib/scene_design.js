function uniqueStrings(values) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)));
}

function compactSceneText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*(?:\.|\u3002)+$/g, '')
    .trim();
}

function stripSceneLabel(text) {
  return compactSceneText(text).replace(/^(Cause|Action|Feeling|Scene|Details)\s*:\s*/i, '');
}

function isInstructionalSceneText(text) {
  const normalized = stripSceneLabel(text).toLowerCase();
  if (!normalized) return true;

  const blockedPrefixes = [
    'prefer ',
    'use ',
    'do not ',
    'avoid ',
    'let ',
    'keep ',
    'treat ',
    'include ',
    'optional ',
    'presence mode',
    'preferred trace cues',
    'a wider scene is allowed',
    'the face may stay off screen',
    'follow the scene plan first',
    'bind the image to',
    'preserve the character',
    'carry at least one sensory cue',
    'compose a ',
    'utilize ',
    'shift from ',
    'introduce ',
    'center ',
    'make these scene cues',
    'make the ',
    'if '
  ];
  if (blockedPrefixes.some(prefix => normalized.startsWith(prefix))) {
    return true;
  }

  const blockedSnippets = [
    'photoreal',
    'instagram',
    'stock backdrop',
    'trace cues:',
    'japanese anime / bishoujo',
    'no empty scenery',
    'no ad poster',
    'no tourism poster',
    'character presence readable',
    'readable character traces'
  ];
  return blockedSnippets.some(snippet => normalized.includes(snippet));
}

function collectConcreteSceneCues({
  lane,
  locationName,
  narrativePremise,
  microPlot,
  sensoryFocus,
  sceneNotes,
  continuityImageAdvice,
  captionFocus
}, limit = 6) {
  const candidates = [
    ...(sceneNotes || []),
    ...(microPlot || []),
    ...(continuityImageAdvice || []),
    ...(captionFocus || []),
    narrativePremise,
    sensoryFocus
  ];

  const cues = [];
  for (const candidate of candidates) {
    const normalized = stripSceneLabel(candidate);
    if (!normalized) continue;
    if (isInstructionalSceneText(normalized)) continue;
    cues.push(normalized);
  }

  const uniqueCues = uniqueStrings(cues);
  const location = compactSceneText(locationName);
  if (lane === 'life_record' && location && !uniqueCues.some(cue => cue.toLowerCase().includes(location.toLowerCase()))) {
    uniqueCues.push(`everyday life in ${location}`);
  }

  return uniqueCues.slice(0, limit);
}

function buildBaseSceneNotes(lane, locationName) {
  const location = compactSceneText(locationName) || 'the city';

  if (lane === 'selfie') {
    return [
      'Prefer close or half-body selfie framing, not polished studio photography.',
      'Keep the expression subtle rather than theatrical.',
      `Let the weather and nearby environment of ${location} appear through light, fabric state, or hair movement.`
    ];
  }

  return [
    'Prefer environment-led framing shaped by today\'s concrete action, found object, or discovery, not a stock backdrop.',
    'Keep character presence readable through traces, posture, or interaction with the scene.',
    `Let ${location} arrive through believable local texture only when it naturally supports today\'s scene.`
  ];
}

function sanitizeCreativeGuidanceNotes(values) {
  const stockBackdropPattern = /\bstreet corner\b|\bcafe interior\b|\btabletop\b|\bdrink\b|\bwindow view\b/i;
  return uniqueStrings(values).filter(value => {
    const normalized = compactSceneText(value);
    if (!normalized) return false;
    if (stockBackdropPattern.test(normalized) && /^(frame|prefer|use|capture|compose|focus on)\b/i.test(normalized)) {
      return false;
    }
    return true;
  });
}

module.exports = {
  buildBaseSceneNotes,
  collectConcreteSceneCues,
  compactSceneText,
  sanitizeCreativeGuidanceNotes,
  stripSceneLabel,
  uniqueStrings
};
