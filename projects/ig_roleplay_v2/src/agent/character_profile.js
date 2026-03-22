const path = require('path');
const { readJsonRequired } = require('../common/runtime');
const { asStringArray, compactText, uniqueStrings } = require('./utils');
const {
  laneDefaultCharacterPresenceTarget,
  normalizeCharacterPresencePolicy
} = require('./content_intent');
const {
  normalizeCapturePolicy
} = require('./capture_intent');
const {
  normalizeClothingPolicy
} = require('./clothing_policy');

const EDITABLE_FILES = {
  coreIdentity: 'core.identity.json',
  voiceStyle: 'voice.style.json',
  visualIdentity: 'visual.identity.json',
  postingBehavior: 'posting.behavior.json',
  clothingPolicy: 'clothing.policy.json'
};

function editableFilePaths(characterEditableDir) {
  return Object.fromEntries(Object.entries(EDITABLE_FILES).map(([key, fileName]) => (
    [key, path.join(characterEditableDir, fileName)]
  )));
}

function loadEditableCharacterInputs(characterEditableDir) {
  const paths = editableFilePaths(characterEditableDir);
  return {
    paths,
    coreIdentity: readJsonRequired(paths.coreIdentity, 'editable core identity'),
    voiceStyle: readJsonRequired(paths.voiceStyle, 'editable voice style'),
    visualIdentity: readJsonRequired(paths.visualIdentity, 'editable visual identity'),
    postingBehavior: readJsonRequired(paths.postingBehavior, 'editable posting behavior'),
    clothingPolicy: readJsonRequired(paths.clothingPolicy, 'editable clothing policy')
  };
}

function compileCharacterProfile(inputs, options = {}) {
  const coreIdentity = inputs.coreIdentity || {};
  const voiceStyle = inputs.voiceStyle || {};
  const visualIdentity = inputs.visualIdentity || {};
  const postingBehavior = inputs.postingBehavior || {};
  const clothingPolicy = normalizeClothingPolicy(inputs.clothingPolicy || {});
  const laneRules = postingBehavior.laneRules || {};
  const characterPresencePolicy = normalizeCharacterPresencePolicy(
    postingBehavior.characterPresencePolicy || {}
  );
  const capturePolicy = normalizeCapturePolicy(
    postingBehavior.capturePolicy || {}
  );

  return {
    version: options.version || '3.0.0-alpha.1',
    createdAt: options.createdAt || new Date().toISOString(),
    characterId: coreIdentity.characterId || 'unknown_character',
    displayName: coreIdentity.displayName || 'Unknown Character',
    platformPersona: coreIdentity.platformPersona || 'social_character',
    identity: {
      apparentAge: Number(coreIdentity.apparentAge || 0),
      identitySummaryZh: compactText(coreIdentity.identitySummaryZh),
      immutableTraits: asStringArray(coreIdentity.immutableTraits || [], 8),
      temperament: asStringArray(coreIdentity.temperament || [], 10),
      hardBoundaries: asStringArray(coreIdentity.hardBoundaries || [], 10)
    },
    voice: {
      defaultLanguage: coreIdentity.defaultLanguage || voiceStyle.defaultLanguage || 'zh-CN',
      voiceSummaryZh: compactText(voiceStyle.voiceSummaryZh),
      toneAnchors: asStringArray(voiceStyle.toneAnchors || [], 8),
      sentenceRhythm: compactText(voiceStyle.sentenceRhythm),
      narrativeHabits: asStringArray(voiceStyle.narrativeHabits || [], 8),
      avoidPatterns: asStringArray(voiceStyle.avoidPatterns || [], 8)
    },
    visual: {
      mustStayStable: asStringArray(visualIdentity.mustStayStable || [], 8),
      allowedVariation: asStringArray(visualIdentity.allowedVariation || [], 8),
      requiredIdentityAnchors: asStringArray(visualIdentity.requiredIdentityAnchors || [], 8),
      identityPromptBaseEn: asStringArray(visualIdentity.identityPromptBaseEn || [], 8),
      lifeRecordIdentityAnchorsEn: asStringArray(visualIdentity.lifeRecordIdentityAnchorsEn || [], 8),
      clearPresenceIdentityAnchorsEn: asStringArray(visualIdentity.clearPresenceIdentityAnchorsEn || [], 8),
      styleAnchors: (visualIdentity.styleAnchors || []).map(anchor => ({
        id: compactText(anchor.id),
        style: compactText(anchor.style)
      })).filter(anchor => anchor.id),
      traceCuePreferences: asStringArray(visualIdentity.traceCuePreferences || [], 6),
      framingPrinciplesEn: asStringArray(visualIdentity.framingPrinciplesEn || [], 6),
      interactionGuardrailsEn: asStringArray(visualIdentity.interactionGuardrailsEn || [], 6),
      faceVisibilityRules: visualIdentity.faceVisibilityRules || {}
    },
    postingBehavior: {
      defaultPreferredLane: compactText(postingBehavior.defaultPreferredLane || 'life_record'),
      shareDistance: compactText(postingBehavior.shareDistance || 'private_but_legible'),
      disclosureStyle: compactText(postingBehavior.disclosureStyle || 'implied_not_explained'),
      shareTriggers: asStringArray(postingBehavior.shareTriggers || [], 8),
      keepPrivateBoundaries: asStringArray(postingBehavior.keepPrivateBoundaries || [], 8),
      laneRules,
      characterPresencePolicy: {
        ...characterPresencePolicy,
        laneDefaults: {
          selfie: laneDefaultCharacterPresenceTarget({
            laneRules,
            characterPresencePolicy
          }, 'selfie'),
          life_record: laneDefaultCharacterPresenceTarget({
            laneRules,
            characterPresencePolicy
          }, 'life_record')
        }
      },
      capturePolicy
    },
    clothing: clothingPolicy,
    identityAnchors: {
      immutableTraits: asStringArray(coreIdentity.immutableTraits || [], 8),
      visualAnchors: uniqueStrings([
        ...(visualIdentity.mustStayStable || []),
        ...(visualIdentity.requiredIdentityAnchors || [])
      ], 10),
      visiblePromptAnchorsEn: uniqueStrings([
        ...(visualIdentity.identityPromptBaseEn || []),
        ...(visualIdentity.lifeRecordIdentityAnchorsEn || []),
        ...(visualIdentity.clearPresenceIdentityAnchorsEn || []),
        ...(clothingPolicy.bodyReadAnchorsEn || []),
        ...(clothingPolicy.presenceReadAnchorsEn || [])
      ], 16),
      voiceAnchors: uniqueStrings([
        ...(voiceStyle.toneAnchors || []),
        voiceStyle.sentenceRhythm,
        ...((voiceStyle.narrativeHabits || []).slice(0, 3))
      ], 10)
    },
    sourceFiles: inputs.paths || {}
  };
}

module.exports = {
  compileCharacterProfile,
  editableFilePaths,
  loadEditableCharacterInputs
};
