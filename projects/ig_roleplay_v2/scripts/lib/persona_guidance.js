function uniqueStrings(values, limit = 12) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)))
    .slice(0, limit);
}

function getCreativeGuidance(identityProfile) {
  const guidance = identityProfile?.creativeGuidance || {};
  return {
    personaSummaryZh: String(guidance.personaSummaryZh || '').trim(),
    voiceSummaryZh: String(guidance.voiceSummaryZh || '').trim(),
    sceneBiasZh: uniqueStrings(guidance.sceneBiasZh || [], 10),
    avoidPatternsZh: uniqueStrings(guidance.avoidPatternsZh || [], 10)
  };
}

function buildCreativePersonaInput(identityProfile) {
  const coreIdentity = identityProfile?.coreIdentity || {};
  const voiceRules = identityProfile?.voiceRules || {};
  return {
    displayName: String(identityProfile?.displayName || '').trim(),
    platformPersona: String(identityProfile?.platformPersona || '').trim(),
    coreIdentity,
    voiceRules: {
      sentenceEndings: uniqueStrings(voiceRules.sentenceEndings || [], 8),
      preferredRhythm: String(voiceRules.preferredRhythm || '').trim(),
      requiredNarrativeElements: uniqueStrings(voiceRules.requiredNarrativeElements || [], 8),
      forbiddenTopics: uniqueStrings(voiceRules.forbiddenTopics || [], 8)
    },
    creativeGuidance: getCreativeGuidance(identityProfile)
  };
}

function buildPersonaWritingNotes(identityProfile) {
  const guidance = getCreativeGuidance(identityProfile);
  return uniqueStrings([
    guidance.voiceSummaryZh,
    ...guidance.sceneBiasZh
  ], 10);
}

function buildPersonaAvoidNotes(identityProfile) {
  const guidance = getCreativeGuidance(identityProfile);
  return uniqueStrings(guidance.avoidPatternsZh, 16);
}

module.exports = {
  buildCreativePersonaInput,
  buildPersonaAvoidNotes,
  buildPersonaWritingNotes,
  getCreativeGuidance,
  uniqueStrings
};
