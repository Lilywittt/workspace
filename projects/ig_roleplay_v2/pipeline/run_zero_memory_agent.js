const path = require('path');
const {
  buildRunStamp,
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  writeRuntimeArtifact
} = require('../src/common/runtime');
const { loadAgentConfig, defaultConfigPath } = require('../src/agent/config');
const { runJsonAgent } = require('../src/agent/agents');
const { loadEditableCharacterInputs, compileCharacterProfile } = require('../src/agent/character_profile');
const { buildContentIntent } = require('../src/agent/content_intent');
const { buildCaptureIntent } = require('../src/agent/capture_intent');
const { buildOutfitIntent } = require('../src/agent/outfit_intent');
const { loadImageStyleProfile } = require('../src/agent/image_style_profile');
const { buildDayContext } = require('../src/agent/day_context');
const { buildExternalEventPacket, loadManualExternalEvents } = require('../src/agent/external_events');
const { loadReferenceLibrary } = require('../src/agent/reference_library');
const { buildAmbientSignalPool, buildAmbientStimulusPacket } = require('../src/agent/ambient_signals');
const { buildRealityBounds, buildRealityBoundsSummary } = require('../src/agent/reality_bounds');
const {
  fallbackCaptionCandidates,
  fallbackCaptionIntent,
  fallbackCaptionReview,
  fallbackCharacterRuntimeSnapshot,
  fallbackGroundedMomentReview,
  fallbackImageIntent,
  fallbackOutfitPlan,
  fallbackProtoMomentCandidates
} = require('../src/agent/fallbacks');
const {
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
} = require('../src/agent/validators');
const {
  buildImageRequest,
  buildMemoryWritebackPlaceholder,
  buildMomentPackage,
  buildScenePlanCompat
} = require('../src/agent/compat');
const { compactText, slugify } = require('../src/agent/utils');

function withRunMetadata(runId, artifact, extra = {}) {
  return {
    ...artifact,
    runId,
    ...extra
  };
}

function writeArtifact(runtimeDir, runId, fileName, artifact) {
  return writeRuntimeArtifact(
    runtimeDir,
    fileName,
    'zeromemory',
    withRunMetadata(runId, artifact),
    { runId }
  );
}

function buildCharacterStateContract() {
  return {
    currentState: {
      energy: 'medium',
      mood: 'quiet, but slightly caught by one specific detail',
      attentionStyle: 'detail_seeking',
      socialBandwidth: 'solo_preferred',
      activeNeeds: ['keep one small piece of reality'],
      activeDesires: ['do not turn today into a dramatic story']
    },
    postingTendency: {
      shareImpulse: 'low_but_present',
      preferredLane: 'life_record',
      whyPostToday: 'One tiny beat briefly felt worth keeping.',
      disclosureStyle: 'implied_not_explained'
    },
    ambientResonance: {
      activeTexturesZh: ['A faint feeling of being brushed by the outside world.'],
      weakPullsZh: ['Ambient pressure colors the day, but does not assign the topic.'],
      ignoredSignalCategories: ['trending_topics']
    },
    groundingNotes: ['Do not translate outside signals directly into a forced topic.']
  };
}

function buildProtoMomentContract() {
  return {
    candidates: [
      {
        candidateId: 'event_01',
        lane: 'life_record',
        eventSummaryZh: 'She was only tidying up for a second, then paused because of one small detail.',
        hookWhyInterestingZh: 'It is tiny, but it feels like the kind of fragment a real day would leave behind.',
        causalChainZh: [
          'She was only moving through an ordinary routine.',
          'One specific detail briefly pulled her attention sideways.',
          'The emotional weight shifted only a little.'
        ],
        factSupport: {
          provisionalBoundIds: ['window_after_class', 'weather_rain'],
          inferredDetailsZh: ['The detail was minor in itself, but today it happened to register.']
        },
        presenceMode: 'partial_presence',
        interiorStateBeforeZh: 'She was only trying to move through the moment normally.',
        interiorShiftZh: 'One small detail made her pause internally for half a beat.',
        whyTodayZh: 'Today\'s pacing and air made this kind of pause land more clearly.',
        whyShareableZh: 'It is concrete and quiet at the same time, so it can become a believable small record.',
        visualEvidenceZh: ['small object nearby', 'the action paused for one beat', 'clear trace of the protagonist'],
        ambientInfluence: {
          used: true,
          resonanceOnlyZh: ['Only a slight ambient pressure from the day itself.'],
          mustNotBeReadAsDirectCause: true
        },
        imageMode: 'trace_led_life_record',
        captionVoice: 'soft_private_observation'
      }
    ]
  };
}

function buildGroundedReviewContract() {
  return {
    recommendedCandidateId: 'event_01',
    candidateReviews: [
      {
        candidateId: 'event_01',
        personaTruthScore: 84,
        groundingScore: 78,
        postabilityScore: 80,
        coherenceScore: 82,
        characterPresenceFitScore: 80,
        sourceMirroringRiskScore: 18,
        strengthsZh: ['Concrete physical trigger.', 'Caption and image can come from the same upstream truth.'],
        risksZh: ['If the detail stays too vague, it may collapse back into a familiar safe basin.'],
        verdict: 'recommended'
      }
    ],
    summaryZh: 'Completed review of persona truth, grounding, source-overfitting risk, and caption-image coherence.'
  };
}

function buildCaptionIntentContract() {
  return {
    shareDistance: 'private_but_legible',
    disclosureLevel: 'implied_not_explained',
    voiceMode: 'soft_private_observation',
    emotionalFocusZh: 'Keep the small shift the moment caused.',
    whatToSayZh: 'Name the concrete detail without unpacking the whole reason.',
    whatToLeaveUnsaidZh: 'Leave the private meaning in the blank space.',
    openingMovesZh: ['Start from one concrete detail.'],
    hashtagAnglesZh: ['daily fragment']
  };
}

function buildCaptionCandidatesContract() {
  return {
    candidates: [
      {
        id: 'caption_01',
        angle: 'soft_observation',
        caption: 'A tiny touch, and suddenly today had a place to pause.',
        hashtags: ['daily_fragment'],
        rationale: 'Natural and spacious.'
      }
    ]
  };
}

function buildCaptionReviewContract() {
  return {
    selectedCandidateId: 'caption_01',
    reasonZh: 'This line sounds the most like something the character would actually post.',
    strengthsZh: ['Concrete', 'Natural'],
    risksZh: []
  };
}

function buildOutfitPlanContract() {
  return {
    outfitSummaryEn: 'fresh youthful rainy after-class outfit with a light cardigan, simple inner top, clean pleated skirt, and everyday sneakers',
    outfitMoodEn: 'fresh, softly youthful, lightly rain-cooled',
    silhouetteEn: 'light layered school-age casual silhouette',
    upperGarmentEn: 'simple pale inner top',
    lowerGarmentEn: 'clean pleated skirt',
    outerLayerEn: 'light knit cardigan',
    legwearEn: 'dark knee socks',
    footwearEn: 'clean everyday sneakers',
    accessoryNotesEn: ['small practical school bag or cuff detail may stay visible'],
    materialColorCuesEn: ['soft cool-neutral palette with a tiny red accent', 'light knit texture over clean cotton layers'],
    weatherResponseEn: 'A light rain-ready layer keeps the outfit tidy and comfortable.',
    sceneFitEn: 'Fits an after-class school transition moment.',
    promptCuesEn: ['light knit cardigan', 'simple pale inner top', 'clean pleated skirt', 'dark knee socks', 'clean everyday sneakers'],
    notesZh: ['The outfit should feel ordinary, youthful, and natural for the day.']
  };
}

function buildImageIntentContract() {
  return {
    imageMode: 'trace_led_life_record',
    faceVisibility: 'optional',
    characterPresenceTarget: 'supporting_presence',
    characterPresencePlanEn: 'the protagonist should be readable through partial face, posture, clothing, or body action without forcing portrait dominance',
    cameraRelation: 'observational',
    faceReadability: 'glimpse',
    bodyCoverage: 'partial',
    distance: 'medium',
    environmentWeight: 'balanced',
    captureSummaryEn: 'observational camera relation, medium distance, partial body coverage, glimpse face readability, balanced environment weight',
    captureGuidanceEn: [
      'the frame should feel witnessed from the outside, not automatically self-held',
      'a brief or partial face glimpse is enough; do not force portrait dominance'
    ],
    framingZh: 'Let the framing follow the same lived beat so the action and space stay coherent.',
    framingEn: 'moment-led framing rooted in the same lived action',
    mustShowZh: ['the concrete action or detail that proves the moment happened', 'same-moment local evidence'],
    mustShowEn: ['the action or evidence that proves the moment happened', 'ordinary context from the same moment'],
    mayShowZh: ['secondary environment cue'],
    mayShowEn: ['additional ordinary context from the same moment'],
    mustAvoidZh: ['generic aesthetic wallpaper'],
    mustAvoidEn: ['generic aesthetic wallpaper', 'fashion editorial polish', 'rewriting the moment into a different event'],
    atmosphereZh: 'A real slice of life kept in passing.',
    altTextZh: 'A small daily-life moment from the character.'
  };
}

function buildRetrievedMemoryPlaceholder() {
  return {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    mode: 'zero_long_term_memory',
    entries: [],
    openThreads: [],
    postingHistorySummary: {
      enabled: false,
      reason: 'long_term_memory_disabled_for_current_phase'
    }
  };
}

function buildValidationArtifact({
  runId,
  scenarioId,
  contentIntent,
  captureIntent,
  characterStateMeta,
  protoMomentMeta,
  groundedReviewMeta,
  outfitPlanMeta,
  captionIntentMeta,
  captionCandidatesMeta,
  captionReviewMeta,
  imageIntentMeta,
  selectedMoment,
  selectedCaption
}) {
  return {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    runId,
    scenarioId: compactText(scenarioId || ''),
    mode: 'zero_memory_agent',
    contentIntent: {
      lane: contentIntent?.lane || '',
      characterPresenceTarget: contentIntent?.characterPresenceTarget || '',
      sourceMode: contentIntent?.sourceMode || ''
    },
    captureIntent: {
      lane: captureIntent?.lane || '',
      sourceMode: captureIntent?.sourceMode || '',
      summaryEn: captureIntent?.summaryEn || '',
      resolvedTarget: captureIntent?.resolvedTarget || {}
    },
    stageSources: {
      characterState: characterStateMeta,
      protoMomentGeneration: protoMomentMeta,
      groundingReview: groundedReviewMeta,
      outfitPlanning: outfitPlanMeta,
      captionIntent: captionIntentMeta,
      captionCandidates: captionCandidatesMeta,
      captionReview: captionReviewMeta,
      imageIntent: imageIntentMeta
    },
    selectedMoment: {
      candidateId: selectedMoment?.candidateId || '',
      lane: selectedMoment?.lane || '',
      characterPresenceTarget: selectedMoment?.characterPresenceTarget || '',
      selectionMode: selectedMoment?.selectionMode || '',
      selectionReasonZh: selectedMoment?.selectionReasonZh || ''
    },
    selectedCaption: {
      selectedCandidateId: selectedCaption?.selectedCandidateId || '',
      candidateAngle: selectedCaption?.candidateAngle || ''
    }
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : defaultConfigPath();
  const agent = loadAgentConfig(configPath);
  const runtimeDir = agent.runtimeDir;
  const generationPolicy = readJsonRequired(agent.generationPolicyPath, 'agent generation policy');
  const worldFacts = readJsonRequired(agent.worldFactsPath, 'world facts');
  const imageStyleProfile = loadImageStyleProfile(agent.imageStyleProfilePath);
  const manualExternalEvents = loadManualExternalEvents(agent.manualExternalEventsPath);
  const referenceLibrary = loadReferenceLibrary(agent.referenceLibraryPath);
  const legacySignals = readJsonOptional(agent.legacySignalsPath, {});
  const scenario = args.scenario ? readJsonRequired(path.resolve(args.scenario), 'scenario override') : {};

  const runId = args['run-id']
    || `zeromemory-${buildRunStamp()}${scenario.scenarioId ? `-${slugify(scenario.scenarioId)}` : ''}`;
  const seedKey = `${runId}:${scenario.scenarioId || 'default'}`;

  const editableInputs = loadEditableCharacterInputs(agent.characterEditableDir);
  const characterProfile = compileCharacterProfile(editableInputs, {
    version: agent.version
  });
  writeArtifact(runtimeDir, runId, 'character_profile.json', characterProfile);
  writeArtifact(runtimeDir, runId, 'image_style_profile.json', imageStyleProfile);

  const dayContext = buildDayContext({
    signals: legacySignals,
    worldFacts,
    override: scenario,
    nowIso: args.now
  });
  writeArtifact(runtimeDir, runId, 'day_context.json', dayContext);

  const externalEventPacket = buildExternalEventPacket({
    manualExternalEvents,
    dayContext,
    scenario
  });
  writeArtifact(runtimeDir, runId, 'external_event_packet.json', externalEventPacket);

  const retrievedMemoryContext = buildRetrievedMemoryPlaceholder();
  writeArtifact(runtimeDir, runId, 'retrieved_memory_context.json', retrievedMemoryContext);

  const ambientSignalPool = buildAmbientSignalPool({
    dayContext,
    signals: legacySignals,
    override: scenario,
    policy: generationPolicy.ambientSignals || {}
  });
  writeArtifact(runtimeDir, runId, 'ambient_signal_pool.json', ambientSignalPool);

  const ambientStimulusPacket = buildAmbientStimulusPacket({
    ambientSignalPool,
    policy: generationPolicy.ambientSignals || {},
    seedKey
  });
  writeArtifact(runtimeDir, runId, 'ambient_stimulus_packet.json', ambientStimulusPacket);

  const characterState = await runJsonAgent({
    promptName: 'character-state-agent',
    taskLabel: 'Infer today\'s character runtime state under zero long-term memory and weak ambient resonance.',
    input: {
      characterProfile,
      dayContext,
      ambientStimulusPacket,
      retrievedMemoryContext
    },
    outputContract: buildCharacterStateContract(),
    modelConfigPath: agent.creativeModelPath,
    fallbackFactory: input => fallbackCharacterRuntimeSnapshot(input),
    validate: output => normalizeCharacterRuntimeSnapshot(output, {
      profile: characterProfile,
      ambientStimulusPacket
    })
  });
  writeArtifact(runtimeDir, runId, 'character_runtime_snapshot.json', {
    ...characterState.output,
    agentMeta: characterState.meta
  });

  const contentIntent = buildContentIntent({
    characterProfile,
    characterRuntime: characterState.output,
    scenario
  });
  writeArtifact(runtimeDir, runId, 'content_intent.json', contentIntent);

  const captureIntent = buildCaptureIntent({
    characterProfile,
    characterRuntime: characterState.output,
    contentIntent,
    scenario
  });
  writeArtifact(runtimeDir, runId, 'capture_intent.json', captureIntent);

  const realityBounds = buildRealityBounds({
    worldFacts,
    dayContext,
    characterRuntime: characterState.output,
    characterProfile,
    externalEventPacket
  });
  writeArtifact(runtimeDir, runId, 'reality_bounds.json', realityBounds);

  const protoMomentGeneration = await runJsonAgent({
    promptName: 'moment-generator-agent',
    taskLabel: 'Explore several small lived moments under weak fact pressure and ambient resonance.',
    input: {
      characterRuntimeSnapshot: characterState.output,
      contentIntent,
      ambientStimulusPacket,
      realityBoundsSummary: buildRealityBoundsSummary(realityBounds),
      retrievedMemoryContext
    },
    outputContract: buildProtoMomentContract(),
    modelConfigPath: agent.creativeModelPath,
    fallbackFactory: input => ({
      candidates: fallbackProtoMomentCandidates({
        characterRuntime: input.characterRuntimeSnapshot,
        realityBounds
      })
    }),
    validate: output => ({
      candidates: normalizeProtoMomentCandidates(output, { policy: generationPolicy })
    })
  });
  writeArtifact(runtimeDir, runId, 'proto_moment_candidates.json', {
    ...protoMomentGeneration.output,
    agentMeta: protoMomentGeneration.meta
  });

  const groundedMomentReview = await runJsonAgent({
    promptName: 'moment-critic-agent',
    taskLabel: 'Critique and repair proto moments against persona truth, reality fit, postability, and source overfitting risk.',
    input: {
      characterProfile,
      contentIntent,
      characterRuntimeSnapshot: characterState.output,
      realityBounds,
      protoMomentCandidates: protoMomentGeneration.output.candidates
    },
    outputContract: buildGroundedReviewContract(),
    modelConfigPath: agent.creativeModelPath,
    fallbackFactory: input => fallbackGroundedMomentReview({
      candidates: input.protoMomentCandidates,
      contentIntent: input.contentIntent
    }),
    validate: output => normalizeGroundedMomentReview(output, {
      candidates: protoMomentGeneration.output.candidates
    })
  });
  writeArtifact(runtimeDir, runId, 'grounded_moment_review.json', {
    ...groundedMomentReview.output,
    agentMeta: groundedMomentReview.meta
  });

  const selectedMoment = selectMoment({
    candidates: protoMomentGeneration.output.candidates,
    review: groundedMomentReview.output,
    policy: generationPolicy,
    contentIntent
  });
  writeArtifact(runtimeDir, runId, 'selected_moment.json', selectedMoment);

  const outfitIntent = buildOutfitIntent({
    characterProfile,
    dayContext,
    selectedMoment,
    contentIntent,
    scenario
  });
  writeArtifact(runtimeDir, runId, 'outfit_intent.json', outfitIntent);

  const outfitPlan = await runJsonAgent({
    promptName: 'outfit-resolver-agent',
    taskLabel: 'Resolve today\'s outfit from character policy, weather, and the selected lived moment.',
    input: {
      characterProfile,
      dayContext,
      contentIntent,
      captureIntent,
      selectedMoment,
      outfitIntent,
      externalEventPacket
    },
    outputContract: buildOutfitPlanContract(),
    modelConfigPath: agent.creativeModelPath,
    fallbackFactory: input => fallbackOutfitPlan(input),
    validate: output => normalizeOutfitPlan(output, {
      profile: characterProfile,
      outfitIntent,
      dayContext,
      selectedMoment,
      contentIntent
    })
  });
  writeArtifact(runtimeDir, runId, 'outfit_plan.json', {
    ...outfitPlan.output,
    agentMeta: outfitPlan.meta
  });

  const momentPackage = buildMomentPackage({
    selectedMoment,
    characterRuntime: characterState.output,
    dayContext,
    realityBounds,
    characterProfile,
    contentIntent,
    captureIntent,
    outfitPlan: outfitPlan.output
  });
  writeArtifact(runtimeDir, runId, 'moment_package.json', momentPackage);

  const captionIntent = await runJsonAgent({
    promptName: 'caption-intent-agent',
    taskLabel: 'Decide how the selected moment should be expressed without over-explaining it.',
    input: {
      characterProfile,
      momentPackage
    },
    outputContract: buildCaptionIntentContract(),
    modelConfigPath: agent.creativeModelPath,
    fallbackFactory: input => fallbackCaptionIntent(input),
    validate: output => normalizeCaptionIntent(output, {
      profile: characterProfile,
      momentPackage
    })
  });
  writeArtifact(runtimeDir, runId, 'caption_intent.json', {
    ...captionIntent.output,
    agentMeta: captionIntent.meta
  });

  const captionCandidates = await runJsonAgent({
    promptName: 'caption-writer-agent',
    taskLabel: 'Write several Chinese caption candidates from the same selected lived moment.',
    input: {
      characterProfile,
      momentPackage,
      captionIntent: captionIntent.output
    },
    outputContract: buildCaptionCandidatesContract(),
    modelConfigPath: agent.creativeModelPath,
    fallbackFactory: input => ({
      candidates: fallbackCaptionCandidates({
        momentPackage: input.momentPackage,
        maxHashtags: agent.config?.caption?.maxHashtags || generationPolicy?.caption?.maxHashtags || 4
      })
    }),
    validate: output => ({
      candidates: normalizeCaptionCandidates(output, {
        maxHashtags: agent.config?.caption?.maxHashtags || generationPolicy?.caption?.maxHashtags || 4
      })
    })
  });
  writeArtifact(runtimeDir, runId, 'caption_candidates.json', {
    ...captionCandidates.output,
    agentMeta: captionCandidates.meta
  });

  const captionReview = await runJsonAgent({
    promptName: 'caption-review-agent',
    taskLabel: 'Choose the strongest caption candidate for publication.',
    input: {
      momentPackage,
      captionIntent: captionIntent.output,
      captionCandidates: captionCandidates.output.candidates
    },
    outputContract: buildCaptionReviewContract(),
    modelConfigPath: agent.creativeModelPath,
    fallbackFactory: input => fallbackCaptionReview({
      candidates: input.captionCandidates
    }),
    validate: output => normalizeCaptionReview(output, {
      candidates: captionCandidates.output.candidates
    })
  });
  writeArtifact(runtimeDir, runId, 'caption_selection_review.json', {
    ...captionReview.output,
    agentMeta: captionReview.meta
  });

  const selectedCaption = selectCaption({
    candidates: captionCandidates.output.candidates,
    review: captionReview.output
  });
  writeArtifact(runtimeDir, runId, 'selected_caption.json', selectedCaption);

  const imageIntent = await runJsonAgent({
    promptName: 'image-intent-agent',
    taskLabel: 'Translate the selected lived moment into visual evidence for image generation.',
    input: {
      characterProfile,
      momentPackage,
      contentIntent,
      captureIntent
    },
    outputContract: buildImageIntentContract(),
    modelConfigPath: agent.creativeModelPath,
    fallbackFactory: input => fallbackImageIntent(input),
    validate: output => normalizeImageIntent(output, {
      momentPackage,
      policy: generationPolicy,
      profile: characterProfile,
      contentIntent,
      captureIntent
    })
  });
  writeArtifact(runtimeDir, runId, 'image_intent.json', {
    ...imageIntent.output,
    agentMeta: imageIntent.meta
  });

  const scenePlan = buildScenePlanCompat({
    runId,
    selectedMoment,
    momentPackage,
    dayContext,
    imageIntent: imageIntent.output
  });
  writeArtifact(runtimeDir, runId, 'scene_plan.json', scenePlan);

  const imageRequest = buildImageRequest({
    config: agent.config,
    policy: generationPolicy,
    scenePlan,
    momentPackage,
    imageIntent: imageIntent.output,
    characterProfile,
    imageStyleProfile,
    referenceLibrary
  });
  writeArtifact(runtimeDir, runId, 'image_request.json', imageRequest);

  const memoryWritebackRequest = buildMemoryWritebackPlaceholder({
    runId,
    selectedMoment
  });
  writeArtifact(runtimeDir, runId, 'memory_writeback_request.json', memoryWritebackRequest);

  const validation = buildValidationArtifact({
    runId,
    scenarioId: scenario.scenarioId,
    contentIntent,
    captureIntent,
    characterStateMeta: characterState.meta,
    protoMomentMeta: protoMomentGeneration.meta,
    groundedReviewMeta: groundedMomentReview.meta,
    outfitPlanMeta: outfitPlan.meta,
    captionIntentMeta: captionIntent.meta,
    captionCandidatesMeta: captionCandidates.meta,
    captionReviewMeta: captionReview.meta,
    imageIntentMeta: imageIntent.meta,
    selectedMoment,
    selectedCaption
  });
  writeArtifact(runtimeDir, runId, 'zero_memory_pipeline_validation.json', validation);

  console.log(`zero-memory runId: ${runId}`);
  console.log(`selected moment: ${selectedMoment.eventSummaryZh}`);
  console.log(`selected caption: ${selectedCaption.caption}`);
  console.log(`artifacts ready in runtime/intermediate/current and runtime/intermediate/runs/${runId}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
