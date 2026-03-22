const {
  compactText,
  slugify,
  uniqueStrings
} = require('./utils');
const { characterPresenceGuidanceEn } = require('./content_intent');
const { buildCaptureSummaryEn } = require('./capture_intent');

function fallbackCharacterRuntimeSnapshot({ profile, dayContext, ambientStimulusPacket }) {
  const rainy = dayContext?.weather?.bucket === 'rain';
  const nightLike = ['early_evening', 'night'].includes(dayContext?.time?.daypart);
  const textures = (ambientStimulusPacket?.items || []).slice(0, 2).map(item => item.text);

  return {
    currentState: {
      energy: nightLike ? 'medium_low' : 'medium',
      mood: rainy
        ? 'quiet, a little folded inward, more attentive to small textures'
        : 'calm, but easily caught by one specific detail',
      attentionStyle: rainy ? 'detail_seeking' : 'small_shift_seeking',
      socialBandwidth: 'solo_preferred',
      activeNeeds: rainy
        ? ['find one small corner that can hold the day together']
        : ['notice one detail worth quietly keeping'],
      activeDesires: rainy
        ? ['do not turn today into a dramatic story', 'keep only one small graspable feeling']
        : ['let an ordinary moment brighten slightly', 'write down one tiny shift']
    },
    postingTendency: {
      shareImpulse: 'low_but_present',
      preferredLane: rainy || nightLike ? 'life_record' : (profile?.postingBehavior?.defaultPreferredLane || 'life_record'),
      whyPostToday: rainy
        ? 'Today feels right for saving one small thing that can be held onto.'
        : 'One detail briefly became worth keeping.',
      disclosureStyle: profile?.postingBehavior?.disclosureStyle || 'implied_not_explained'
    },
    ambientResonance: {
      activeTexturesZh: textures.length > 0 ? textures : ['A faint feeling of being lightly brushed by the outside world.'],
      weakPullsZh: ['The outside world colors the day a little, but does not rewrite it.'],
      ignoredSignalCategories: []
    },
    groundingNotes: [
      `daypart=${dayContext?.time?.daypart || 'unknown'}`,
      `weather=${dayContext?.weather?.summary || 'unknown'}`
    ]
  };
}

function fallbackProtoMomentCandidates({ characterRuntime, realityBounds }) {
  const repairFacts = realityBounds?.repairFacts || [];
  const firstPlace = repairFacts.find(item => item.kind === 'place');
  const firstObject = repairFacts.find(item => item.kind === 'object');
  const secondObject = repairFacts.find(item => item.kind === 'object' && item.factId !== firstObject?.factId) || firstObject;
  const lane = characterRuntime?.postingTendency?.preferredLane || 'life_record';

  const templates = [
    {
      key: 'paper_pause',
      summary: `She was only tidying up for a second, then paused because of ${firstObject?.refId || 'one small everyday object'}.`,
      hook: 'It is tiny, but it feels like the sort of fragment a real day would leave behind.',
      visual: ['finger paused at an edge', 'sleeve cuff', 'partially opened carried item']
    },
    {
      key: 'small_adjustment',
      summary: 'A very small adjustment suddenly made the moment feel visible enough to keep.',
      hook: 'The beat is concrete enough to post and quiet enough to leave mostly unexplained.',
      visual: ['a recently touched small object', 'one corner of a desk or counter', 'clear trace of the protagonist nearby']
    },
    {
      key: 'carryover',
      summary: 'While moving on with the day, one leftover trace gently caught her attention.',
      hook: 'It feels like life briefly offered a pause that could be kept without explanation.',
      visual: ['object still in hand', 'edge of a passing environment', 'an action not fully finished yet']
    }
  ];

  return templates.map((template, index) => ({
    candidateId: `event_${String(index + 1).padStart(2, '0')}_${slugify(template.key)}`,
    lane,
    eventSummaryZh: template.summary,
    hookWhyInterestingZh: template.hook,
    causalChainZh: [
      'She was only moving through an ordinary routine.',
      'One specific detail briefly pulled her attention sideways.',
      'The feeling did not grow into drama; it just settled for a moment.'
    ],
    factSupport: {
      provisionalBoundIds: uniqueStrings([
        ...(realityBounds?.minimalBounds || []).map(item => item.boundId)
      ], 4),
      inferredDetailsZh: [
        'The detail was minor in itself, but today it happened to register.'
      ]
    },
    placeRef: firstPlace?.refId || '',
    objectRefs: uniqueStrings([firstObject?.refId, secondObject?.refId], 3),
    routineRef: compactText(realityBounds?.minimalBounds?.[1]?.boundId || ''),
    presenceMode: lane === 'selfie' ? 'full_selfie' : 'partial_presence',
    interiorStateBeforeZh: 'She was only trying to move through the moment normally.',
    interiorShiftZh: 'A tiny detail made her pause internally for half a beat.',
    whyTodayZh: 'Today\'s pacing and outside texture made that pause land a little more clearly.',
    whyShareableZh: 'It is concrete and quiet at the same time, so it can become a believable post.',
    visualEvidenceZh: template.visual,
    ambientInfluence: {
      used: true,
      resonanceOnlyZh: realityBounds?.ambientResonance?.activeTexturesZh || [],
      mustNotBeReadAsDirectCause: true
    },
    imageMode: lane === 'selfie' ? 'face_led' : 'trace_led_life_record',
    captionVoice: 'soft_private_observation'
  }));
}

function fallbackGroundedMomentReview({ candidates, contentIntent }) {
  const reviews = (candidates || []).map((candidate, index) => ({
    candidateId: candidate.candidateId,
    personaTruthScore: 84 - index * 2,
    groundingScore: 78 - index,
    postabilityScore: 80 - index,
    coherenceScore: 82 - index,
    characterPresenceFitScore: (
      contentIntent?.characterPresenceTarget === 'clear_character_presence'
      || contentIntent?.characterPresenceTarget === 'expression_led'
    ) ? (79 - index) : (75 - index),
    sourceMirroringRiskScore: 18 + index * 3,
    strengthsZh: ['Has a concrete trigger detail.', 'Caption and image can come from the same upstream moment.'],
    risksZh: index === 0 ? [] : ['Still drifts a bit close to a familiar tiny-pause basin and needs more differentiation.'],
    verdict: index === 0 ? 'recommended' : 'keep'
  }));
  return {
    recommendedCandidateId: reviews[0]?.candidateId || '',
    candidateReviews: reviews,
    summaryZh: 'Checked persona truth, grounding, overfitting risk, and caption-image coherence.'
  };
}

function fallbackCaptionIntent({ momentPackage, profile }) {
  return {
    shareDistance: profile?.postingBehavior?.shareDistance || 'private_but_legible',
    disclosureLevel: profile?.postingBehavior?.disclosureStyle || 'implied_not_explained',
    voiceMode: 'soft_private_observation',
    emotionalFocusZh: momentPackage?.characterInterior?.after || 'Keep the tiny internal shift, not the full explanation.',
    whatToSayZh: 'Name the concrete detail, but do not unpack the whole reason.',
    whatToLeaveUnsaidZh: 'Leave the private meaning in the blank space.',
    openingMovesZh: ['Start from one concrete detail.', 'Do not summarize the whole day first.'],
    hashtagAnglesZh: ['daily fragment', 'tiny pause']
  };
}

function fallbackCaptionCandidates({ momentPackage, maxHashtags }) {
  const detail = (momentPackage?.visualEvidence?.mustShow || [])[0] || 'this small detail';
  return [
    {
      id: 'caption_01',
      angle: 'soft_observation',
      caption: `${detail} touched my hand for half a second, and suddenly today had a place to pause.\nNot trying to explain the whole feeling. Just leaving this here first.`,
      hashtags: ['daily_fragment', 'tiny_pause'].slice(0, maxHashtags),
      rationale: 'Closest to a quiet private observation.'
    },
    {
      id: 'caption_02',
      angle: 'tiny_shift',
      caption: `It was only a small touch, but my mood tilted with it a little.\nThe change was tiny enough to keep without making it bigger than it was.`,
      hashtags: ['small_shift', 'today_fragment'].slice(0, maxHashtags),
      rationale: 'Keeps the emotional movement subtle.'
    },
    {
      id: 'caption_03',
      angle: 'private_weight',
      caption: `When an ordinary thing suddenly stops feeling ordinary, I kind of want to put it somewhere quiet first.\nMaybe that is all I wanted to keep today.`,
      hashtags: ['private_note', 'daily_life'].slice(0, maxHashtags),
      rationale: 'Leans slightly more inward without becoming abstract.'
    }
  ];
}

function fallbackCaptionReview({ candidates }) {
  return {
    selectedCandidateId: candidates?.[0]?.id || '',
    reasonZh: 'This one sounds the most natural and the most like something the character would actually post.',
    strengthsZh: ['Concrete detail.', 'Leaves enough space.'],
    risksZh: []
  };
}

function fallbackOutfitPlan({ characterProfile, dayContext, selectedMoment, contentIntent, outfitIntent }) {
  const weather = compactText(dayContext?.weather?.summary || '').toLowerCase();
  const context = compactText(dayContext?.location?.currentContext || '');
  const lane = compactText(
    contentIntent?.lane
      || selectedMoment?.lane
      || outfitIntent?.lane
      || 'life_record'
  );
  const rainy = /rain|drizzle|shower/.test(weather);
  const cool = rainy || /cool|cloud|overcast|evening/.test(weather);
  const bookstoreLike = /weekend_pause_window/.test(context);
  const homeEvening = /home_evening_reset|home_night_reset/.test(context);

  const upperGarmentEn = homeEvening
    ? 'soft fitted knit top'
    : (bookstoreLike ? 'simple light blouse' : 'simple pale inner top');
  const outerLayerEn = cool
    ? (homeEvening ? 'light soft cardigan layer' : 'light knit cardigan')
    : '';
  const lowerGarmentEn = homeEvening
    ? 'easy soft skirt or relaxed shorts'
    : 'clean pleated skirt';
  const legwearEn = homeEvening ? 'soft ankle socks' : 'dark knee socks';
  const footwearEn = homeEvening
    ? 'simple indoor casual slippers or light house shoes'
    : (bookstoreLike ? 'clean everyday loafers or sneakers' : 'clean everyday sneakers');
  const materialColorCuesEn = uniqueStrings([
    rainy
      ? 'soft cool-neutral palette with a tiny red accent'
      : 'soft neutral palette with a fresh light accent',
    cool
      ? 'light knit texture over clean cotton layers'
      : 'clean cotton texture with a light youthful drape'
  ], 4);
  const accessoryNotesEn = uniqueStrings([
    lane === 'life_record'
      ? 'a small practical bag, cuff, or hem detail may stay visible in motion'
      : 'one tiny face-near accent is enough'
  ], 3);
  const promptCuesEn = uniqueStrings([
    outerLayerEn,
    upperGarmentEn,
    lowerGarmentEn,
    legwearEn,
    footwearEn,
    ...materialColorCuesEn,
    ...accessoryNotesEn,
    ...(outfitIntent?.mustIncludeEn || []).slice(0, 2),
    ...(outfitIntent?.preferEn || []).slice(0, 2)
  ], 10);

  return {
    outfitSummaryEn: compactText([
      outfitIntent?.directionEn,
      characterProfile?.clothing?.everydayMoodEn,
      ...promptCuesEn.slice(0, 3)
    ].filter(Boolean).join(', ')),
    outfitMoodEn: compactText(
      outfitIntent?.directionEn
        || characterProfile?.clothing?.everydayMoodEn
        || 'fresh youthful everyday charm'
    ),
    silhouetteEn: compactText(
      lane === 'selfie'
        ? 'clean youthful upper-body silhouette with a soft everyday layer'
        : 'light everyday silhouette that stays readable in motion'
    ),
    upperGarmentEn,
    lowerGarmentEn,
    outerLayerEn,
    legwearEn,
    footwearEn,
    accessoryNotesEn,
    materialColorCuesEn,
    weatherResponseEn: rainy
      ? 'a light rain-ready layer keeps the outfit tidy and comfortable'
      : (cool
        ? 'a soft outer layer keeps the outfit comfortable without feeling heavy'
        : 'the outfit stays light and easy for the day'),
    sceneFitEn: homeEvening
      ? 'fits a quiet home reset moment'
      : (bookstoreLike
        ? 'fits a gentle bookstore or weekend pause moment'
        : 'fits an ordinary school-age daily moment'),
    promptCuesEn,
    notesZh: outfitIntent?.notesZh || []
  };
}

function fallbackImageIntent({ momentPackage, characterProfile, contentIntent, captureIntent }) {
  const framingPrinciples = characterProfile?.visual?.framingPrinciplesEn || [];
  const interactionGuardrails = characterProfile?.visual?.interactionGuardrailsEn || [];
  const characterPresenceTarget = contentIntent?.characterPresenceTarget
    || momentPackage?.postIntent?.characterPresenceTarget
    || 'supporting_presence';
  const characterPresencePlanEn = compactText(
    contentIntent?.guidanceEn
      || momentPackage?.postIntent?.characterPresenceGuidanceEn
      || characterPresenceGuidanceEn(characterProfile?.postingBehavior || {}, characterPresenceTarget)
  );
  const resolvedCaptureTarget = captureIntent?.resolvedTarget || {};
  const captureSummaryEn = buildCaptureSummaryEn(resolvedCaptureTarget);
  return {
    imageMode: momentPackage?.postIntent?.imageMode || 'trace_led_life_record',
    faceVisibility: (
      contentIntent?.characterPresenceTarget === 'expression_led'
      || momentPackage?.lane === 'selfie'
    ) ? 'full_face' : 'optional',
    characterPresenceTarget,
    characterPresencePlanEn,
    cameraRelation: compactText(resolvedCaptureTarget.cameraRelation || (momentPackage?.lane === 'selfie' ? 'self_held' : 'observational')),
    faceReadability: compactText(resolvedCaptureTarget.faceReadability || (momentPackage?.lane === 'selfie' ? 'expression_led' : 'glimpse')),
    bodyCoverage: compactText(resolvedCaptureTarget.bodyCoverage || 'partial'),
    distance: compactText(resolvedCaptureTarget.distance || (momentPackage?.lane === 'selfie' ? 'close' : 'medium')),
    environmentWeight: compactText(resolvedCaptureTarget.environmentWeight || 'balanced'),
    captureSummaryEn,
    captureGuidanceEn: captureIntent?.guidanceEn || [],
    framingZh: momentPackage?.lane === 'selfie'
      ? 'Let the expression land first, then let the environment support it.'
      : compactText([
          'Let the composition follow the same lived beat so the action and space become readable together.',
          captureSummaryEn
        ].filter(Boolean).join(' ')),
    framingEn: compactText(
      [
        framingPrinciples.join(', ')
        || (momentPackage?.lane === 'selfie'
          ? 'expression-led framing rooted in the same lived moment'
          : 'moment-led framing rooted in the same lived action'),
        captureSummaryEn
      ].filter(Boolean).join(', ')
    ),
    mustShowZh: momentPackage?.visualEvidence?.mustShow || [],
    mustShowEn: [],
    mayShowZh: momentPackage?.visualEvidence?.mayShow || [],
    mayShowEn: [],
    mustAvoidZh: momentPackage?.visualEvidence?.mustAvoid || [],
    mustAvoidEn: uniqueStrings([
      'generic aesthetic wallpaper',
      'fashion editorial polish',
      'staged portrait setup',
      ...((contentIntent?.characterPresenceTarget === 'clear_character_presence'
        || contentIntent?.characterPresenceTarget === 'expression_led')
        ? ['irrelevant bystanders drawing more attention than the protagonist']
        : []),
      ...interactionGuardrails
    ], 6),
    atmosphereZh: 'This should feel like a real daily beat kept in passing, not a designed poster.',
    altTextZh: momentPackage?.livedEvent?.summaryZh || 'A small daily-life moment from the character.'
  };
}

module.exports = {
  fallbackCaptionCandidates,
  fallbackCaptionIntent,
  fallbackCaptionReview,
  fallbackCharacterRuntimeSnapshot,
  fallbackGroundedMomentReview,
  fallbackImageIntent,
  fallbackOutfitPlan,
  fallbackProtoMomentCandidates
};
