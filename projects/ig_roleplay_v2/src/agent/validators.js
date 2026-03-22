const {
  asStringArray,
  clampScore,
  compactText,
  uniqueStrings
} = require('./utils');
const {
  characterPresenceGuidanceEn,
  normalizeCharacterPresenceTarget
} = require('./content_intent');
const {
  buildCaptureSummaryEn,
  normalizeDimensionValue
} = require('./capture_intent');

function pickAllowed(value, allowed, fallback) {
  const normalized = compactText(value);
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeCharacterRuntimeSnapshot(raw, { profile, ambientStimulusPacket }) {
  const currentState = raw?.currentState || {};
  const postingTendency = raw?.postingTendency || {};
  const ambientResonance = raw?.ambientResonance || {};

  return {
    currentState: {
      energy: compactText(currentState.energy || 'medium'),
      mood: compactText(currentState.mood || 'quiet, but slightly caught by one specific detail'),
      attentionStyle: compactText(currentState.attentionStyle || 'detail_seeking'),
      socialBandwidth: compactText(currentState.socialBandwidth || 'solo_preferred'),
      activeNeeds: asStringArray(currentState.activeNeeds || [], 6),
      activeDesires: asStringArray(currentState.activeDesires || [], 6)
    },
    postingTendency: {
      shareImpulse: compactText(postingTendency.shareImpulse || 'low_but_present'),
      preferredLane: pickAllowed(
        postingTendency.preferredLane || profile?.postingBehavior?.defaultPreferredLane,
        ['selfie', 'life_record'],
        'life_record'
      ),
      whyPostToday: compactText(postingTendency.whyPostToday || 'One tiny beat briefly felt worth keeping.'),
      disclosureStyle: compactText(postingTendency.disclosureStyle || profile?.postingBehavior?.disclosureStyle || 'implied_not_explained')
    },
    ambientResonance: {
      activeTexturesZh: asStringArray(ambientResonance.activeTexturesZh || ambientResonance.activeTextures || [], 4),
      weakPullsZh: asStringArray(ambientResonance.weakPullsZh || [], 4),
      ignoredSignalCategories: asStringArray(
        ambientResonance.ignoredSignalCategories || [],
        (ambientStimulusPacket?.categoriesRepresented || []).length || 5
      ),
      directiveGuardrail: 'ambient_can_color_but_not_direct'
    },
    groundingNotes: asStringArray(raw?.groundingNotes || [], 6)
  };
}

function normalizeProtoMomentCandidates(raw, { policy }) {
  const allowedLanes = policy?.momentGeneration?.allowedLanes || ['selfie', 'life_record'];
  const allowedPresenceModes = policy?.momentGeneration?.allowedPresenceModes || [
    'full_selfie',
    'partial_presence',
    'wide_scene_with_character_trace'
  ];
  const input = Array.isArray(raw) ? raw : (raw?.candidates || []);

  return input.map((candidate, index) => {
    const factSupport = candidate?.factSupport || {};
    const ambientInfluence = candidate?.ambientInfluence || {};
    return {
      candidateId: compactText(candidate?.candidateId || `event_${String(index + 1).padStart(2, '0')}`),
      lane: pickAllowed(candidate?.lane, allowedLanes, 'life_record'),
      eventSummaryZh: compactText(candidate?.eventSummaryZh || candidate?.eventSummary || ''),
      hookWhyInterestingZh: compactText(candidate?.hookWhyInterestingZh || candidate?.whySheWouldPost || ''),
      causalChainZh: asStringArray(candidate?.causalChainZh || candidate?.causalChain || [], 4),
      factSupport: {
        provisionalBoundIds: asStringArray(
          factSupport?.provisionalBoundIds
            || [...(factSupport?.dayFacts || []), ...(factSupport?.worldFacts || [])],
          8
        ),
        inferredDetailsZh: asStringArray(factSupport?.inferredDetailsZh || factSupport?.inferredDetails || [], 4)
      },
      placeRef: compactText(candidate?.placeRef || ''),
      objectRefs: asStringArray(candidate?.objectRefs || [], 4),
      routineRef: compactText(candidate?.routineRef || ''),
      presenceMode: pickAllowed(candidate?.presenceMode, allowedPresenceModes, 'partial_presence'),
      interiorStateBeforeZh: compactText(candidate?.interiorStateBeforeZh || candidate?.interiorStateBefore || ''),
      interiorShiftZh: compactText(candidate?.interiorShiftZh || candidate?.interiorShift || ''),
      whyTodayZh: compactText(candidate?.whyTodayZh || candidate?.whyToday || ''),
      whyShareableZh: compactText(candidate?.whyShareableZh || candidate?.whySheWouldPost || ''),
      visualEvidenceZh: asStringArray(candidate?.visualEvidenceZh || candidate?.visualEvidence || [], 4),
      ambientInfluence: {
        used: Boolean(ambientInfluence?.used),
        resonanceOnlyZh: asStringArray(ambientInfluence?.resonanceOnlyZh || ambientInfluence?.resonanceOnly || [], 4),
        mustNotBeReadAsDirectCause: Boolean(ambientInfluence?.mustNotBeReadAsDirectCause ?? true)
      },
      imageMode: compactText(candidate?.imageMode || ''),
      captionVoice: compactText(candidate?.captionVoice || 'soft_private_observation')
    };
  }).filter(candidate => candidate.eventSummaryZh);
}

function normalizeGroundedMomentReview(raw, { candidates }) {
  const candidateIds = new Set((candidates || []).map(item => item.candidateId));
  const reviews = (raw?.candidateReviews || []).map(review => ({
    candidateId: compactText(review?.candidateId || ''),
    personaTruthScore: clampScore(review?.personaTruthScore, 0),
    groundingScore: clampScore(review?.groundingScore, 0),
    postabilityScore: clampScore(review?.postabilityScore, 0),
    coherenceScore: clampScore(review?.coherenceScore, 0),
    characterPresenceFitScore: clampScore(review?.characterPresenceFitScore, 0),
    sourceMirroringRiskScore: clampScore(review?.sourceMirroringRiskScore, 0),
    strengthsZh: asStringArray(review?.strengthsZh || review?.strengths || [], 5),
    risksZh: asStringArray(review?.risksZh || review?.risks || [], 5),
    verdict: compactText(review?.verdict || 'keep')
  })).filter(review => candidateIds.has(review.candidateId));

  return {
    recommendedCandidateId: compactText(raw?.recommendedCandidateId || reviews[0]?.candidateId || ''),
    candidateReviews: reviews,
    summaryZh: compactText(raw?.summaryZh || 'Reviewed persona truth, grounding, and caption-image coherence.')
  };
}

function scoreReview(review) {
  return review.personaTruthScore
    + review.groundingScore
    + review.postabilityScore
    + review.coherenceScore
    + review.characterPresenceFitScore
    - review.sourceMirroringRiskScore;
}

function aestheticBasinPenalty(candidate) {
  const source = [
    candidate?.eventSummaryZh || '',
    ...(candidate?.visualEvidenceZh || [])
  ].join(' ');
  let penalty = 0;
  if (/樱花|花瓣|cherry blossom|petal/i.test(source)) penalty += 18;
  if (/书签|bookmark|pressed leaf/i.test(source)) penalty += 10;
  if (/梦幻|dreamy|ethereal/i.test(source)) penalty += 8;
  return penalty;
}

function selectMoment({ candidates, review, policy, contentIntent }) {
  const thresholds = policy?.momentSelection || {};
  const byId = new Map((review?.candidateReviews || []).map(item => [item.candidateId, item]));
  const ranked = [...(review?.candidateReviews || [])].sort((left, right) => {
    const leftCandidate = (candidates || []).find(item => item.candidateId === left.candidateId);
    const rightCandidate = (candidates || []).find(item => item.candidateId === right.candidateId);
    return (scoreReview(right) - aestheticBasinPenalty(rightCandidate))
      - (scoreReview(left) - aestheticBasinPenalty(leftCandidate));
  });
  const preferred = ranked.filter(item => (
    item.personaTruthScore >= Number(thresholds.minimumPersonaTruthScore || 0)
      && item.groundingScore >= Number(thresholds.minimumGroundingScore || 0)
      && item.postabilityScore >= Number(thresholds.minimumPostabilityScore || 0)
      && item.coherenceScore >= Number(thresholds.minimumCoherenceScore || 0)
      && item.characterPresenceFitScore >= Number(thresholds.minimumCharacterPresenceFitScore || 0)
      && (
        item.sourceMirroringRiskScore
        + aestheticBasinPenalty((candidates || []).find(candidate => candidate.candidateId === item.candidateId))
      ) <= Number(thresholds.maximumSourceMirroringRisk || 100)
  ));
  const chosenReview = preferred[0]
    || byId.get(review?.recommendedCandidateId)
    || ranked[0]
    || null;
  const chosenCandidate = (candidates || []).find(item => item.candidateId === chosenReview?.candidateId) || candidates?.[0];
  const heuristicPenalty = aestheticBasinPenalty(chosenCandidate);

  if (!chosenCandidate) {
    throw new Error('No proto moment candidate could be selected.');
  }

  return {
    ...chosenCandidate,
    selectedAt: new Date().toISOString(),
    review: chosenReview || null,
    heuristicPenalty,
    characterPresenceTarget: compactText(contentIntent?.characterPresenceTarget || ''),
    characterPresenceGuidanceEn: compactText(contentIntent?.guidanceEn || ''),
    selectionMode: preferred.length > 0 ? 'meets_thresholds' : 'best_available_after_repair',
    selectionReasonZh: preferred.length > 0
      ? 'This candidate best satisfies persona truth, grounding, postability, and caption-image coherence together.'
      : 'This is the best available candidate right now even though it still needs later polishing.'
  };
}

function normalizeCaptionIntent(raw, { profile, momentPackage }) {
  return {
    shareDistance: compactText(raw?.shareDistance || profile?.postingBehavior?.shareDistance || 'private_but_legible'),
    disclosureLevel: compactText(raw?.disclosureLevel || profile?.postingBehavior?.disclosureStyle || 'implied_not_explained'),
    voiceMode: compactText(raw?.voiceMode || 'soft_private_observation'),
    emotionalFocusZh: compactText(raw?.emotionalFocusZh || momentPackage?.characterInterior?.after || 'Keep the tiny emotional shift, not the full explanation.'),
    whatToSayZh: compactText(raw?.whatToSayZh || 'Name the concrete detail without explaining the whole reason.'),
    whatToLeaveUnsaidZh: compactText(raw?.whatToLeaveUnsaidZh || 'Leave the private meaning unspoken.'),
    openingMovesZh: asStringArray(raw?.openingMovesZh || [], 4),
    hashtagAnglesZh: asStringArray(raw?.hashtagAnglesZh || [], 4)
  };
}

function normalizeHashtags(values, maxHashtags = 4) {
  return uniqueStrings((values || []).map(item => {
    const raw = compactText(item).replace(/^#+/, '').replace(/\s+/g, '');
    return raw ? `#${raw}` : '';
  }), maxHashtags).filter(Boolean);
}

function normalizeCaptionCandidates(raw, { maxHashtags }) {
  const input = Array.isArray(raw) ? raw : (raw?.candidates || []);
  return input.map((candidate, index) => ({
    id: compactText(candidate?.id || candidate?.candidateId || `caption_${String(index + 1).padStart(2, '0')}`),
    angle: compactText(candidate?.angle || 'private_observation'),
    caption: compactText(candidate?.caption || ''),
    hashtags: normalizeHashtags(candidate?.hashtags || [], maxHashtags),
    rationale: compactText(candidate?.rationale || candidate?.reason || '')
  })).filter(candidate => candidate.caption);
}

function normalizeCaptionReview(raw, { candidates }) {
  const candidateIds = new Set((candidates || []).map(item => item.id));
  const selectedCandidateId = compactText(raw?.selectedCandidateId || candidates?.[0]?.id || '');
  return {
    selectedCandidateId: candidateIds.has(selectedCandidateId) ? selectedCandidateId : (candidates?.[0]?.id || ''),
    reasonZh: compactText(raw?.reasonZh || raw?.reason || 'This line sounds the most like something the character would actually post.'),
    strengthsZh: asStringArray(raw?.strengthsZh || raw?.strengths || [], 4),
    risksZh: asStringArray(raw?.risksZh || raw?.risks || [], 4)
  };
}

function selectCaption({ candidates, review }) {
  const selected = (candidates || []).find(item => item.id === review?.selectedCandidateId) || candidates?.[0];
  if (!selected) {
    throw new Error('No caption candidate could be selected.');
  }
  return {
    selectedAt: new Date().toISOString(),
    selectedCandidateId: selected.id,
    selectionReason: review?.reasonZh || 'This line reads the most naturally.',
    selectionStrengthsZh: review?.strengthsZh || [],
    candidateAngle: selected.angle,
    caption: selected.caption,
    hashtags: selected.hashtags
  };
}

function defaultFaceVisibility(profile, momentPackage, contentIntent) {
  if (contentIntent?.characterPresenceTarget === 'expression_led') {
    return 'full_face';
  }
  if (momentPackage?.lane === 'selfie') {
    return 'full_face';
  }

  const lifeRecordRule = compactText(profile?.visual?.faceVisibilityRules?.life_record || '');
  if (/required/.test(lifeRecordRule)) {
    return 'full_face';
  }
  if (/optional/.test(lifeRecordRule)) {
    return 'optional';
  }
  return 'optional';
}

function defaultFramingZh(profile, momentPackage, captureTarget = {}) {
  if (momentPackage?.lane === 'selfie') {
    return 'Let the expression land first, then let the environment complete the beat.';
  }
  return compactText(
    [
      'Let the framing follow the same lived beat so the action and space become readable together.',
      'The protagonist may be felt through a partial view, posture, face, or a fuller in-frame presence.',
      buildCaptureSummaryEn(captureTarget)
    ].filter(Boolean).join(' ')
  );
}

function defaultFramingEn(profile, momentPackage, captureTarget = {}) {
  if (momentPackage?.lane === 'selfie') {
    return compactText([
      'expression-led framing rooted in the same lived moment',
      buildCaptureSummaryEn(captureTarget)
    ].filter(Boolean).join(', '));
  }

  const principles = asStringArray(profile?.visual?.framingPrinciplesEn || [], 4);
  return compactText(
    [
      principles.join(', ')
        || 'moment-led framing rooted in the same lived action',
      buildCaptureSummaryEn(captureTarget)
    ].filter(Boolean).join(', ')
  );
}

function resolveCaptureDimension(rawValue, fallbackValue, allowance = [], hardFallback = '') {
  const normalizedFallback = normalizeDimensionValue(fallbackValue, allowance, hardFallback)
    || normalizeDimensionValue(hardFallback, allowance, '')
    || compactText(hardFallback);
  return normalizeDimensionValue(rawValue, allowance, normalizedFallback);
}

function isGenericImageEvidence(text = '') {
  const source = compactText(text).toLowerCase();
  return [
    'the action or evidence that proves the moment happened',
    'the action that proves the moment happened',
    'ordinary context from the same moment',
    'additional ordinary context from the same moment',
    'an ordinary daily moment',
    '能证明这个瞬间发生过的动作或细节',
    '同一时刻的现场证据',
    '环境边缘信息',
    '角色的一段日常小瞬间'
  ].some(pattern => source === String(pattern).toLowerCase());
}

function filterConcreteImageEvidence(values = [], maxItems = 5) {
  return asStringArray(values || [], maxItems).filter(item => !isGenericImageEvidence(item));
}

function isOutfitManagementLanguage(text = '') {
  const source = compactText(text).toLowerCase();
  if (!source) return false;
  const hasManagementCue = /\b(avoid|must not|do not|don't|never|policy|guardrail|rule|ban|forbid|without)\b/.test(source);
  const hasClothingCue = /\b(outfit|clothing|wardrobe|uniform|cardigan|jacket|coat|dress|skirt|shirt|top|sock|socks|shoe|shoes|collar|sleeve|hem|fashion|officewear|adult-coded|mature)\b/.test(source);
  return hasManagementCue && hasClothingCue;
}

function asList(values) {
  if (Array.isArray(values)) return values;
  if (values === undefined || values === null || values === '') return [];
  return [values];
}

function filterPromptNegativeItems(values = [], maxItems = 8) {
  return uniqueStrings(
    asList(values)
      .map(item => compactText(item))
      .filter(item => item && !isOutfitManagementLanguage(item)),
    maxItems
  );
}

function normalizePositiveOutfitList(values = [], maxItems = 6) {
  return uniqueStrings(
    asList(values)
      .map(item => compactText(item))
      .filter(item => item && !isOutfitManagementLanguage(item)),
    maxItems
  );
}

function fallbackOutfitSummary({
  raw,
  promptCuesEn,
  outfitIntent,
  laneTendency,
  policy
}) {
  return compactText(
    raw?.outfitSummaryEn
      || raw?.summaryEn
      || [
        outfitIntent?.directionEn,
        laneTendency?.vibeEn,
        policy?.everydayMoodEn,
        ...promptCuesEn.slice(0, 3)
      ].filter(Boolean).join(', ')
  );
}

function normalizeOutfitPlan(raw, {
  profile,
  outfitIntent,
  dayContext,
  selectedMoment,
  contentIntent
}) {
  const policy = profile?.clothing || {};
  const lane = compactText(
    contentIntent?.lane
      || selectedMoment?.lane
      || outfitIntent?.lane
      || 'life_record'
  );
  const laneTendency = policy?.laneTendencies?.[lane] || {};
  const upperGarmentEn = compactText(raw?.upperGarmentEn || raw?.topEn || '');
  const lowerGarmentEn = compactText(raw?.lowerGarmentEn || raw?.bottomEn || '');
  const outerLayerEn = compactText(raw?.outerLayerEn || '');
  const legwearEn = compactText(raw?.legwearEn || '');
  const footwearEn = compactText(raw?.footwearEn || '');
  const accessoryNotesEn = normalizePositiveOutfitList(
    raw?.accessoryNotesEn || raw?.accessoriesEn || [],
    5
  );
  const materialColorCuesEn = normalizePositiveOutfitList(
    raw?.materialColorCuesEn || raw?.colorAndMaterialCuesEn || [],
    6
  );
  const promptCuesEn = normalizePositiveOutfitList(
    raw?.promptCuesEn || raw?.visibleCuesEn || raw?.surfaceCuesEn || [],
    10
  );
  const derivedPromptCuesEn = uniqueStrings([
    upperGarmentEn,
    lowerGarmentEn,
    outerLayerEn,
    legwearEn,
    footwearEn,
    ...materialColorCuesEn,
    ...accessoryNotesEn
  ], 10);

  return {
    outfitSummaryEn: fallbackOutfitSummary({
      raw,
      promptCuesEn: promptCuesEn.length > 0 ? promptCuesEn : derivedPromptCuesEn,
      outfitIntent,
      laneTendency,
      policy
    }),
    outfitMoodEn: compactText(
      raw?.outfitMoodEn
        || outfitIntent?.directionEn
        || laneTendency?.vibeEn
        || policy?.everydayMoodEn
    ),
    silhouetteEn: compactText(
      raw?.silhouetteEn
        || [
          laneTendency?.vibeEn,
          ...(policy?.silhouetteTendenciesEn || []).slice(0, 2)
        ].filter(Boolean).join(', ')
    ),
    upperGarmentEn,
    lowerGarmentEn,
    outerLayerEn,
    legwearEn,
    footwearEn,
    accessoryNotesEn,
    materialColorCuesEn,
    weatherResponseEn: compactText(
      raw?.weatherResponseEn
        || `weather-aware for ${compactText(dayContext?.weather?.summary || 'today')}`
    ),
    sceneFitEn: compactText(
      raw?.sceneFitEn
        || `fits the ${lane} moment in ${compactText(dayContext?.location?.currentContext || 'an ordinary daily setting')}`
    ),
    promptCuesEn: promptCuesEn.length > 0 ? promptCuesEn : derivedPromptCuesEn,
    bodyReadAnchorsEn: asStringArray(policy?.bodyReadAnchorsEn || [], 6),
    presenceReadAnchorsEn: asStringArray(policy?.presenceReadAnchorsEn || [], 6),
    manualOverrideApplied: Boolean(outfitIntent?.manualOverrideProvided),
    sourceMode: compactText(outfitIntent?.sourceMode || 'persona_policy_default'),
    notesZh: asStringArray(raw?.notesZh || outfitIntent?.notesZh || [], 4)
  };
}

function normalizeImageIntent(raw, { momentPackage, policy, profile, contentIntent, captureIntent }) {
  const mustShowZh = filterConcreteImageEvidence(raw?.mustShowZh || [], 5);
  const mustShowEn = filterConcreteImageEvidence(raw?.mustShowEn || [], 5);
  const mayShowZh = filterConcreteImageEvidence(raw?.mayShowZh || [], 5);
  const mayShowEn = filterConcreteImageEvidence(raw?.mayShowEn || [], 5);
  const altTextZh = compactText(raw?.altTextZh || '');
  const capturePolicy = profile?.postingBehavior?.capturePolicy || {};
  const captureAllowances = captureIntent?.allowances || capturePolicy?.laneAllowances?.[momentPackage?.lane || 'life_record'] || {};
  const captureDefaultTarget = captureIntent?.resolvedTarget || capturePolicy?.laneDefaults?.[momentPackage?.lane || 'life_record'] || {};
  const characterPresenceTarget = normalizeCharacterPresenceTarget(
    raw?.characterPresenceTarget
      || contentIntent?.characterPresenceTarget
      || momentPackage?.postIntent?.characterPresenceTarget,
    profile?.postingBehavior?.characterPresencePolicy?.allowedTargets,
    profile?.postingBehavior?.characterPresencePolicy?.defaultTarget || 'supporting_presence'
  );
  const characterPresencePlanEn = compactText(
    raw?.characterPresencePlanEn
      || contentIntent?.guidanceEn
      || momentPackage?.postIntent?.characterPresenceGuidanceEn
      || characterPresenceGuidanceEn(profile?.postingBehavior || {}, characterPresenceTarget)
  );
  const cameraRelation = resolveCaptureDimension(
    raw?.cameraRelation,
    captureDefaultTarget.cameraRelation,
    captureAllowances.cameraRelation || [],
    momentPackage?.lane === 'selfie' ? 'self_held' : 'observational'
  );
  const faceReadability = resolveCaptureDimension(
    raw?.faceReadability,
    captureDefaultTarget.faceReadability,
    captureAllowances.faceReadability || [],
    momentPackage?.lane === 'selfie' ? 'expression_led' : 'glimpse'
  );
  const bodyCoverage = resolveCaptureDimension(
    raw?.bodyCoverage,
    captureDefaultTarget.bodyCoverage,
    captureAllowances.bodyCoverage || [],
    'partial'
  );
  const distance = resolveCaptureDimension(
    raw?.distance,
    captureDefaultTarget.distance,
    captureAllowances.distance || [],
    momentPackage?.lane === 'selfie' ? 'close' : 'medium'
  );
  const environmentWeight = resolveCaptureDimension(
    raw?.environmentWeight,
    captureDefaultTarget.environmentWeight,
    captureAllowances.environmentWeight || [],
    'balanced'
  );
  const resolvedCaptureTarget = {
    cameraRelation,
    faceReadability,
    bodyCoverage,
    distance,
    environmentWeight
  };
  const captureSummaryEn = compactText(
    raw?.captureSummaryEn
      || buildCaptureSummaryEn(resolvedCaptureTarget)
  );
  const captureGuidanceEn = uniqueStrings([
    ...(captureIntent?.guidanceEn || []),
    ...(raw?.captureGuidanceEn || [])
  ], 8);

  return {
    imageMode: compactText(raw?.imageMode || momentPackage?.postIntent?.imageMode || 'trace_led_life_record'),
    faceVisibility: compactText(raw?.faceVisibility || defaultFaceVisibility(profile, momentPackage, contentIntent)),
    characterPresenceTarget,
    characterPresencePlanEn,
    cameraRelation,
    faceReadability,
    bodyCoverage,
    distance,
    environmentWeight,
    captureSummaryEn,
    captureGuidanceEn,
    framingZh: compactText(raw?.framingZh || defaultFramingZh(profile, momentPackage, resolvedCaptureTarget)),
    framingEn: compactText(raw?.framingEn || defaultFramingEn(profile, momentPackage, resolvedCaptureTarget)),
    mustShowZh,
    mustShowEn,
    mayShowZh,
    mayShowEn,
    mustAvoidZh: filterPromptNegativeItems([
      ...(raw?.mustAvoidZh || []),
      ...((policy?.image?.mustAvoid || []).map(item => compactText(item)))
    ], 8),
    mustAvoidEn: filterPromptNegativeItems(raw?.mustAvoidEn || [], 8),
    atmosphereZh: compactText(raw?.atmosphereZh || 'This should feel like a real daily beat, not a designed poster.'),
    altTextZh: (!altTextZh || isGenericImageEvidence(altTextZh))
      ? compactText(momentPackage?.livedEvent?.summaryZh || 'A small daily-life moment from the character.')
      : altTextZh
  };
}

module.exports = {
  normalizeCaptionCandidates,
  normalizeCaptionIntent,
  normalizeCaptionReview,
  normalizeCharacterRuntimeSnapshot,
  normalizeGroundedMomentReview,
  normalizeImageIntent,
  normalizeOutfitPlan,
  normalizeProtoMomentCandidates,
  selectCaption,
  selectMoment
};
