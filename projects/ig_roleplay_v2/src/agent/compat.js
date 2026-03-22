const { asStringArray, compactText, uniqueStrings } = require('./utils');
const { buildReferenceLookup } = require('./reference_library');

function weatherHintEn(weatherText) {
  const source = compactText(weatherText).toLowerCase();
  if (/rain|drizzle|shower|\u5c0f\u96e8|\u96e8/.test(source)) return 'rainy light, damp air, wet weather outside';
  if (/cloud|overcast|\u591a\u4e91|\u9634/.test(source)) return 'soft overcast light';
  if (/clear|sun|\u6674/.test(source)) return 'clear daylight';
  return 'ordinary daylight';
}

function contextHintEn(groundingContext = {}) {
  const currentContext = groundingContext.currentContext || '';
  const weatherHint = weatherHintEn(groundingContext.weather || '');
  if (currentContext === 'school_transition_window') {
    return `indoor classroom or school transition space after class, school bag and desk nearby, ${weatherHint}`;
  }
  if (currentContext === 'home_evening_reset' || currentContext === 'home_night_reset') {
    return `ordinary home interior during evening reset, nearby everyday objects, ${weatherHint}`;
  }
  if (currentContext === 'weekend_pause_window') {
    return `ordinary weekend pause space, quiet public or indoor edge, ${weatherHint}`;
  }
  return `${currentContext || 'ordinary daily context'}, ${weatherHint}`;
}

function isRigidVisibilityDirective(text = '') {
  const source = compactText(text).toLowerCase();
  return /full face portrait|full body standing pose|upper body portrait|full body character reveal|face out of frame|body mostly out of frame|looking at camera|one hand only|multiple hands(?: in frame)?|trace cues only|face absent|centered schoolgirl/.test(source)
    || /\u5b8c\u6574\u9762\u90e8|\u5168\u8eab|\u8096\u50cf|\u6b63\u5bf9\u955c\u5934/.test(String(text || ''));
}

function sanitizeTraceLedList(values = [], traceLed) {
  if (!traceLed) {
    return values.filter(Boolean);
  }
  return values.filter(value => value && !isRigidVisibilityDirective(value));
}

function sanitizeTraceLedFraming(text = '', traceLed) {
  if (!traceLed) {
    return compactText(text);
  }

  return compactText(String(text)
    .replace(/face out of frame/ig, '')
    .replace(/body mostly out of frame/ig, '')
    .replace(/face absent/ig, '')
    .replace(/one hand only/ig, '')
    .replace(/multiple hands(?: in frame)?/ig, '')
    .replace(/trace cues only/ig, '')
    .replace(/\u9762\u90e8\u4e0d\u5165\u955c/gu, '')
    .replace(/\u5168\u8eab\u4e0d\u5165\u955c/gu, ''));
}

function requiresStrongerIdentityLock(characterPresenceTarget = '') {
  return ['clear_character_presence', 'expression_led'].includes(compactText(characterPresenceTarget));
}

function resolveReferenceEntries({ requiredAnchors = [], styleAnchor, referenceLibrary }) {
  const referenceLookup = buildReferenceLookup(referenceLibrary);
  const entries = [
    ...requiredAnchors.map(id => ({
      id,
      kind: 'identity',
      source: 'character_profile',
      weight: 1.0,
      why: 'Keep the recurring character visually stable.'
    })),
    ...(styleAnchor ? [{
      id: styleAnchor.id,
      kind: 'style',
      source: 'character_profile',
      weight: 0.55,
      why: 'Carry the product visual language without turning into a fixed template.'
    }] : [])
  ];

  return entries.map(entry => {
    const libraryEntry = referenceLookup.get(entry.id);
    return {
      ...entry,
      libraryStatus: compactText(libraryEntry?.status || 'unregistered'),
      librarySource: compactText(libraryEntry?.source || ''),
      assetPath: compactText(libraryEntry?.assetPath || ''),
      notes: compactText(libraryEntry?.notes || '')
    };
  });
}

function buildReferencePlan(references = []) {
  const identityReferences = references.filter(item => item.kind === 'identity');
  const styleReferences = references.filter(item => item.kind === 'style');
  const unresolvedReferenceIds = references
    .filter(item => ['placeholder', 'unregistered'].includes(item.libraryStatus))
    .map(item => item.id);

  return {
    identityReferenceIds: identityReferences.map(item => item.id),
    styleReferenceIds: styleReferences.map(item => item.id),
    unresolvedReferenceIds,
    placeholderReferenceIds: references
      .filter(item => item.libraryStatus === 'placeholder')
      .map(item => item.id)
  };
}

function buildMomentPackage({
  selectedMoment,
  characterRuntime,
  dayContext,
  realityBounds,
  characterProfile,
  contentIntent,
  captureIntent,
  outfitPlan
}) {
  return {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    sourceCandidateId: selectedMoment.candidateId,
    lane: selectedMoment.lane,
    livedEvent: {
      summaryZh: selectedMoment.eventSummaryZh,
      hookWhyInterestingZh: selectedMoment.hookWhyInterestingZh,
      causalChainZh: selectedMoment.causalChainZh || [],
      factSupport: selectedMoment.factSupport || {},
      ambientInfluence: selectedMoment.ambientInfluence || {}
    },
    characterInterior: {
      before: selectedMoment.interiorStateBeforeZh,
      after: selectedMoment.interiorShiftZh,
      whyPostToday: characterRuntime?.postingTendency?.whyPostToday || '',
      shareImpulse: characterRuntime?.postingTendency?.shareImpulse || ''
    },
    groundingContext: {
      city: dayContext?.location?.city || '',
      currentContext: dayContext?.location?.currentContext || '',
      routineWindow: dayContext?.time?.routineWindow || '',
      weather: dayContext?.weather?.summary || '',
      minimalBounds: (realityBounds?.minimalBounds || []).map(item => item.boundId),
      activeExternalEventIds: (realityBounds?.activeExternalEvents || []).map(item => item.eventId),
      externalEventFacts: asStringArray(
        (realityBounds?.activeExternalEvents || []).flatMap(item => item.factStatements || []),
        4
      )
    },
    postIntent: {
      preferredLane: characterRuntime?.postingTendency?.preferredLane || selectedMoment.lane,
      disclosureStyle: characterRuntime?.postingTendency?.disclosureStyle || characterProfile?.postingBehavior?.disclosureStyle || '',
      captionVoice: selectedMoment.captionVoice || 'soft_private_observation',
      imageMode: selectedMoment.imageMode || 'trace_led_life_record',
      characterPresenceTarget: contentIntent?.characterPresenceTarget || selectedMoment?.characterPresenceTarget || '',
      characterPresenceGuidanceEn: contentIntent?.guidanceEn || selectedMoment?.characterPresenceGuidanceEn || '',
      characterPresenceSourceMode: contentIntent?.sourceMode || 'persona_lane_default',
      whyShareableZh: selectedMoment.whyShareableZh || '',
      ambientUsePolicy: 'ambient_can_color_but_not_direct'
    },
    captureIntent: {
      sourceMode: captureIntent?.sourceMode || 'persona_lane_default',
      summaryEn: compactText(captureIntent?.summaryEn || ''),
      resolvedTarget: captureIntent?.resolvedTarget || {},
      allowances: captureIntent?.allowances || {},
      guidanceEn: asStringArray(captureIntent?.guidanceEn || [], 8)
    },
    outfit: {
      sourceMode: compactText(outfitPlan?.sourceMode || 'persona_policy_default'),
      manualOverrideApplied: Boolean(outfitPlan?.manualOverrideApplied),
      outfitSummaryEn: compactText(outfitPlan?.outfitSummaryEn || ''),
      outfitMoodEn: compactText(outfitPlan?.outfitMoodEn || ''),
      silhouetteEn: compactText(outfitPlan?.silhouetteEn || ''),
      upperGarmentEn: compactText(outfitPlan?.upperGarmentEn || ''),
      lowerGarmentEn: compactText(outfitPlan?.lowerGarmentEn || ''),
      outerLayerEn: compactText(outfitPlan?.outerLayerEn || ''),
      legwearEn: compactText(outfitPlan?.legwearEn || ''),
      footwearEn: compactText(outfitPlan?.footwearEn || ''),
      accessoryNotesEn: asStringArray(outfitPlan?.accessoryNotesEn || [], 5),
      materialColorCuesEn: asStringArray(outfitPlan?.materialColorCuesEn || [], 6),
      weatherResponseEn: compactText(outfitPlan?.weatherResponseEn || ''),
      sceneFitEn: compactText(outfitPlan?.sceneFitEn || ''),
      promptCuesEn: asStringArray(outfitPlan?.promptCuesEn || [], 10),
      bodyReadAnchorsEn: asStringArray(outfitPlan?.bodyReadAnchorsEn || characterProfile?.clothing?.bodyReadAnchorsEn || [], 6),
      presenceReadAnchorsEn: asStringArray(outfitPlan?.presenceReadAnchorsEn || characterProfile?.clothing?.presenceReadAnchorsEn || [], 6)
    },
    visualEvidence: {
      mustShow: asStringArray(selectedMoment.visualEvidenceZh || [], 5),
      mayShow: asStringArray(
        (realityBounds?.repairFacts || [])
          .slice(0, 5)
          .map(item => item.statement),
        5
      ),
      traceCues: asStringArray(characterProfile?.visual?.traceCuePreferences || realityBounds?.visualTraceCues || [], 4),
      mustAvoid: [
        'generic aesthetic wallpaper',
        'fashion editorial polish',
        'tourism poster feeling',
        'empty scenery without character trace'
      ]
    }
  };
}

function buildScenePlanCompat({ runId, selectedMoment, momentPackage, dayContext, imageIntent }) {
  return {
    version: '3.0.0-alpha.1',
    runId,
    createdAt: new Date().toISOString(),
    lane: selectedMoment?.lane || 'life_record',
    freshness: {
      weatherSignal: dayContext?.weather?.summary || '',
      locationName: dayContext?.location?.city || '',
      routineWindow: dayContext?.time?.routineWindow || ''
    },
    narrative: {
      premise: momentPackage?.livedEvent?.summaryZh || '',
      microPlot: momentPackage?.livedEvent?.causalChainZh || [],
      sensoryFocus: imageIntent?.atmosphereZh || '',
      emotionalLanding: momentPackage?.characterInterior?.after || ''
    },
    visual: {
      mode: imageIntent?.imageMode || momentPackage?.postIntent?.imageMode || 'trace_led_life_record',
      presenceMode: selectedMoment?.presenceMode || 'partial_presence',
      characterPresenceTarget: imageIntent?.characterPresenceTarget || momentPackage?.postIntent?.characterPresenceTarget || '',
      concreteSceneCues: momentPackage?.visualEvidence?.mustShow || [],
      sceneNotes: [
        `context: ${momentPackage?.groundingContext?.currentContext || ''}`,
        `weather: ${momentPackage?.groundingContext?.weather || ''}`,
        ...(momentPackage?.groundingContext?.externalEventFacts || []).map(item => `world_state: ${item}`),
        ...(momentPackage?.captureIntent?.summaryEn
          ? [`capture: ${momentPackage.captureIntent.summaryEn}`]
          : []),
        ...(momentPackage?.outfit?.outfitSummaryEn
          ? [`outfit: ${momentPackage.outfit.outfitSummaryEn}`]
          : []),
        ...(momentPackage?.postIntent?.characterPresenceGuidanceEn
          ? [`character_presence: ${momentPackage.postIntent.characterPresenceGuidanceEn}`]
          : [])
      ].filter(Boolean),
      characterTraceCues: momentPackage?.visualEvidence?.traceCues || []
    },
    sceneSemantics: {
      runtimeMode: 'living_character_zero_memory',
      supportBoundIds: momentPackage?.livedEvent?.factSupport?.provisionalBoundIds || [],
      supportObjectRefs: selectedMoment?.objectRefs || [],
      supportPlaceRef: selectedMoment?.placeRef || '',
      supportRoutineRef: selectedMoment?.routineRef || '',
      activeExternalEventIds: momentPackage?.groundingContext?.activeExternalEventIds || []
    }
  };
}

function buildImageRequest({
  config,
  policy,
  scenePlan,
  momentPackage,
  imageIntent,
  characterProfile,
  imageStyleProfile,
  referenceLibrary
}) {
  const lane = scenePlan?.lane || 'life_record';
  const traceLed = lane !== 'selfie';
  const requiredAnchors = characterProfile?.visual?.requiredIdentityAnchors || [];
  const sanitizedMustAvoidEn = sanitizeTraceLedList(imageIntent?.mustAvoidEn || [], traceLed);
  const sanitizedMustAvoidZh = sanitizeTraceLedList(imageIntent?.mustAvoidZh || [], traceLed);
  const sanitizedFramingEn = sanitizeTraceLedFraming(imageIntent?.framingEn || '', traceLed);
  const sanitizedFramingZh = sanitizeTraceLedFraming(imageIntent?.framingZh || '', traceLed);
  const personaFramingPrinciples = traceLed
    ? asStringArray(characterProfile?.visual?.framingPrinciplesEn || [], 4)
    : [];
  const characterPresenceTarget = compactText(
    imageIntent?.characterPresenceTarget
      || momentPackage?.postIntent?.characterPresenceTarget
      || ''
  );
  const strongerIdentityLock = requiresStrongerIdentityLock(characterPresenceTarget);
  const characterPresencePlanEn = compactText(
    imageIntent?.characterPresencePlanEn
      || momentPackage?.postIntent?.characterPresenceGuidanceEn
      || ''
  );
  const captureSummaryEn = compactText(
    imageIntent?.captureSummaryEn
      || momentPackage?.captureIntent?.summaryEn
      || ''
  );
  const captureGuidanceEn = asStringArray(
    imageIntent?.captureGuidanceEn
      || momentPackage?.captureIntent?.guidanceEn
      || [],
    8
  );
  const outfit = momentPackage?.outfit || {};
  const outfitPromptCuesEn = uniqueStrings([
    ...asStringArray(outfit?.promptCuesEn || [], 10),
    ...asStringArray(outfit?.materialColorCuesEn || [], 6),
    ...asStringArray(outfit?.accessoryNotesEn || [], 5)
  ], 12);
  const bodyReadAnchorsEn = asStringArray(outfit?.bodyReadAnchorsEn || characterProfile?.clothing?.bodyReadAnchorsEn || [], 6);
  const presenceReadAnchorsEn = asStringArray(outfit?.presenceReadAnchorsEn || characterProfile?.clothing?.presenceReadAnchorsEn || [], 6);
  const renderStyleSummaryEn = compactText(imageStyleProfile?.styleSummaryEn || '');
  const renderStylePositive = uniqueStrings([
    ...asStringArray(imageStyleProfile?.styleDimensionPositiveEn || [], 12),
    ...asStringArray(imageStyleProfile?.stylePositiveEn || [], 12)
  ], 16);
  const renderStyleNegative = uniqueStrings([
    ...asStringArray(imageStyleProfile?.styleDimensionNegativeEn || [], 12),
    ...asStringArray(imageStyleProfile?.styleNegativeEn || [], 12)
  ], 16);
  const renderGuardrails = asStringArray(imageStyleProfile?.guardrailsEn || [], 8);
  const styleAnchor = (characterProfile?.visual?.styleAnchors || []).find(anchor => (
    lane === 'selfie' ? anchor.style === 'selfie' : anchor.style !== 'selfie'
  ));
  const references = resolveReferenceEntries({
    requiredAnchors,
    styleAnchor: styleAnchor && !traceLed ? styleAnchor : null,
    referenceLibrary
  });
  const referencePlan = buildReferencePlan(references);
  const identityPromptBaseEn = asStringArray(characterProfile?.visual?.identityPromptBaseEn || [], 6);
  const lifeRecordIdentityAnchorsEn = asStringArray(characterProfile?.visual?.lifeRecordIdentityAnchorsEn || [], 6);
  const clearPresenceIdentityAnchorsEn = strongerIdentityLock
    ? asStringArray(characterProfile?.visual?.clearPresenceIdentityAnchorsEn || [], 6)
    : [];

  const promptBlocks = {
    subject: [
      'anime slice-of-life illustration',
      ...(traceLed
        ? [
            ...identityPromptBaseEn,
            ...bodyReadAnchorsEn,
            ...presenceReadAnchorsEn,
            'action-led lived-moment framing',
            characterPresencePlanEn || 'character presence readable through action, posture, clothing, nearby objects, or small trace cues',
            ...lifeRecordIdentityAnchorsEn,
            ...clearPresenceIdentityAnchorsEn,
            ...personaFramingPrinciples
          ]
        : [
            ...identityPromptBaseEn,
            ...bodyReadAnchorsEn,
            ...presenceReadAnchorsEn,
            `age impression around ${characterProfile?.identity?.apparentAge || 13}`,
            'face visible',
            'recognizable expression',
            ...(characterPresencePlanEn ? [characterPresencePlanEn] : []),
            ...(strongerIdentityLock ? clearPresenceIdentityAnchorsEn : [])
          ]),
      ...(traceLed ? [] : (characterProfile?.identityAnchors?.immutableTraits || []))
    ].join(', '),
    moment: [
      ...(momentPackage?.visualEvidence?.mustShow || []),
      ...(imageIntent?.mustShowEn || []),
      ...(imageIntent?.mustShowZh || [])
    ].filter(Boolean).join(', '),
    context: [
      contextHintEn(momentPackage?.groundingContext || {}),
      `routine ${momentPackage?.groundingContext?.routineWindow || ''}`,
      ...(momentPackage?.groundingContext?.externalEventFacts || [])
    ].filter(Boolean).join(', '),
    characterPresence: compactText(
      [characterPresenceTarget, characterPresencePlanEn].filter(Boolean).join(', ')
    ),
    capturePlan: compactText([
      captureSummaryEn,
      ...captureGuidanceEn
    ].filter(Boolean).join(', ')),
    identityLock: uniqueStrings([
      ...identityPromptBaseEn,
      ...bodyReadAnchorsEn,
      ...presenceReadAnchorsEn,
      ...lifeRecordIdentityAnchorsEn,
      ...clearPresenceIdentityAnchorsEn
    ], 8).join(', '),
    outfit: compactText([
      outfit?.outfitSummaryEn,
      outfit?.silhouetteEn,
      ...outfitPromptCuesEn
    ].filter(Boolean).join(', ')),
    composition: compactText([
      sanitizedFramingEn,
      sanitizedFramingZh,
      ...(strongerIdentityLock
        ? ['the protagonist remains the primary readable human presence in frame']
        : []),
      ...(traceLed
        ? ['moment-first composition, the lived action stays primary even if more of the body is visible']
        : ['close selfie framing or expression-led framing'])
    ].filter(Boolean).join(', ')),
    atmosphere: compactText(imageIntent?.atmosphereZh || ''),
    renderStyleSummary: renderStyleSummaryEn,
    renderStyle: renderStylePositive.join(', '),
    renderGuardrails: renderGuardrails.join(', '),
    constraints: [
      'not photorealistic',
      'not a poster',
      'not an ad',
      ...(traceLed
        ? ['moment-led scene, not a posed portrait setup']
        : []),
      'instagram vertical 4:5'
    ].join(', ')
  };

  const unresolvedIdentityReference = referencePlan.placeholderReferenceIds.length > 0
    || referencePlan.unresolvedReferenceIds.some(id => referencePlan.identityReferenceIds.includes(id));

  return {
    version: config?.version || '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: scenePlan?.runId || '',
    lane,
    generationMode: lane === 'selfie'
      ? 'anime_selfie_consistency_guided'
      : 'anime_close_crop_trace_lived_moment',
    references,
    referencePlan,
    referenceHandling: {
      requestedReferenceCount: references.length,
      unresolvedReferenceIds: referencePlan.unresolvedReferenceIds,
      placeholderReferenceIds: referencePlan.placeholderReferenceIds,
      deliveryMode: 'pending_provider_selection'
    },
    promptPackage: {
      positivePrompt: [
        `Subject: ${promptBlocks.subject}`,
        `Moment: ${promptBlocks.moment}`,
        `Context: ${promptBlocks.context}`,
        ...(promptBlocks.characterPresence ? [`CharacterPresence: ${promptBlocks.characterPresence}`] : []),
        ...(promptBlocks.capturePlan ? [`CapturePlan: ${promptBlocks.capturePlan}`] : []),
        ...(promptBlocks.identityLock ? [`IdentityLock: ${promptBlocks.identityLock}`] : []),
        ...(promptBlocks.outfit ? [`Outfit: ${promptBlocks.outfit}`] : []),
        `Composition: ${promptBlocks.composition}`,
        `Atmosphere: ${promptBlocks.atmosphere}`,
        ...(promptBlocks.renderStyleSummary ? [`RenderStyleSummary: ${promptBlocks.renderStyleSummary}`] : []),
        ...(promptBlocks.renderStyle ? [`RenderStyle: ${promptBlocks.renderStyle}`] : []),
        ...(promptBlocks.renderGuardrails ? [`RenderGuardrails: ${promptBlocks.renderGuardrails}`] : []),
        `Constraints: ${promptBlocks.constraints}`
      ].filter(Boolean).join('\n'),
      negativePrompt: uniqueStrings([
        ...renderStyleNegative,
        ...sanitizedMustAvoidEn,
        ...sanitizedMustAvoidZh,
        ...(momentPackage?.visualEvidence?.mustAvoid || []),
        ...(traceLed ? [
          ...(/rain|drizzle|shower|\u5c0f\u96e8|\u96e8/.test(momentPackage?.groundingContext?.weather || '')
            ? ['sunny outdoor field', 'bright outdoor meadow']
            : [])
        ] : [])
      ], 22).join(', '),
      shotNotes: uniqueStrings([
        ...(momentPackage?.visualEvidence?.mustShow || []),
        ...(imageIntent?.mustShowEn || []),
        ...(imageIntent?.mayShowEn || []),
        ...(imageIntent?.mayShowZh || []),
        ...(momentPackage?.groundingContext?.externalEventFacts || [])
      ], 8),
      promptBlocks
    },
    renderPlan: {
      aspectRatio: config?.image?.aspectRatio || policy?.image?.aspectRatio || '4:5',
      candidateCount: config?.image?.candidateCount || policy?.image?.candidateCount || 1,
      seedStrategy: 'single_moment_truth',
      consistencyPolicy: lane === 'selfie' ? 'fixed_identity_references' : 'trace_led_character_consistency'
    },
    publishHints: {
      platform: 'instagram',
      recommendedCrop: '4:5',
      altText: imageIntent?.altTextZh || momentPackage?.livedEvent?.summaryZh || '',
      needsFaceReview: lane === 'selfie' || characterPresenceTarget === 'expression_led',
      needsIdentityReview: strongerIdentityLock || unresolvedIdentityReference,
      dryRunDefault: true
    },
    reviewSignals: {
      characterPresenceTarget,
      activeExternalEventIds: momentPackage?.groundingContext?.activeExternalEventIds || [],
      captureSummaryEn,
      renderStyleSummaryEn,
      outfitSummaryEn: compactText(outfit?.outfitSummaryEn || ''),
      unresolvedIdentityReference,
      strongerIdentityLock
    },
    status: 'generation_request_ready'
  };
}

function buildMemoryWritebackPlaceholder({ runId, selectedMoment }) {
  return {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    runId,
    enabled: false,
    reason: 'long_term_memory_disabled_for_current_phase',
    candidateId: selectedMoment?.candidateId || '',
    note: 'This artifact preserves the integration surface for a later memory subsystem.'
  };
}

module.exports = {
  buildImageRequest,
  buildMemoryWritebackPlaceholder,
  buildMomentPackage,
  buildScenePlanCompat
};
