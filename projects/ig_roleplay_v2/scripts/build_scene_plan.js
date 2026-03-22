const path = require('path');
const {
  fileExists,
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  readJsonl,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const {
  buildBaseSceneNotes,
  collectConcreteSceneCues,
  sanitizeCreativeGuidanceNotes,
  uniqueStrings
} = require('./lib/scene_design');

function extractRecentStyles(posts, historyWindow) {
  return posts
    .slice(-historyWindow)
    .reverse()
    .map(post => String(post.image_style || post.lane || '').trim().toLowerCase())
    .filter(Boolean);
}

function deriveWeatherSignal(signals, worldStateSnapshot) {
  if (worldStateSnapshot?.environment?.weatherSummary) {
    const temperature = worldStateSnapshot?.environment?.temperatureC;
    return typeof temperature === 'number'
      ? `${worldStateSnapshot.environment.weatherSummary}, about ${temperature}C`
      : worldStateSnapshot.environment.weatherSummary;
  }

  const code = Number(signals?.weather?.weather_code);
  const codeMap = {
    0: 'clear sky',
    1: 'mostly clear',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'fog',
    48: 'rime fog',
    51: 'light drizzle',
    53: 'moderate drizzle',
    55: 'dense drizzle',
    61: 'light rain',
    63: 'rain',
    65: 'heavy rain',
    71: 'light snow',
    73: 'snow',
    75: 'heavy snow',
    80: 'rain showers',
    81: 'heavy rain showers',
    95: 'thunderstorm'
  };
  const summary = codeMap[code] || signals?.weather?.summary || 'weather shift';
  const temp = signals?.weather?.temperature_c;
  if (typeof temp === 'number') return `${summary}, about ${temp}C`;
  return summary;
}

function deriveTrendSignal(signals) {
  const trends = Array.isArray(signals?.trends) ? signals.trends : [];
  const validTrend = trends
    .map(item => String(item || '').trim())
    .find(item => item && !/fetch_failed|news fetch failed|failed/i.test(item));
  if (validTrend) return validTrend;

  const news = Array.isArray(signals?.news) ? signals.news : [];
  const firstNews = news.find(item => item && item.title && !String(item.title).startsWith('news_fetch_failed'));
  if (firstNews) return String(firstNews.title);

  return 'No stable trend signal, so daily world-state cues should lead the run';
}

function deriveSensoryFocus(worldStateSnapshot, draft, candidate, signals, programInstance) {
  if (String(draft?.sensoryFocus || '').trim()) return String(draft.sensoryFocus).trim();
  if ((programInstance?.frameIntent || []).length > 0) return String(programInstance.frameIntent[0]).trim();
  if ((candidate?.imageHooks || []).length > 0) return String(candidate.imageHooks[0]).trim();
  if (worldStateSnapshot?.environment?.weatherSummary) return String(worldStateSnapshot.environment.weatherSummary).trim();
  return String(signals?.weather?.summary || '').trim();
}

function buildLifeRecordTraceCues(config, identityProfile) {
  const configured = ((config.vision && config.vision.life_record && config.vision.life_record.requiredTraceCues) || [])
    .map(item => String(item).trim())
    .filter(Boolean);
  const signatureTraits = (identityProfile?.coreIdentity?.signatureTraits || [])
    .map(item => String(item).trim())
    .filter(Boolean);
  return Array.from(new Set([...configured, ...signatureTraits]));
}

function buildConcreteSceneCueInputs({ candidate, draft, continuityCreativeReview, signals, programInstance }) {
  const locationLabel = String(candidate?.locationArchetype || '').replace(/_/g, ' ');
  const objectLabel = (candidate?.objectBindings || []).join(', ');
  return {
    lane: candidate?.lane || 'life_record',
    locationName: signals?.location?.name || '',
    narrativePremise: String(draft?.narrativePremise || programInstance?.executionIntention || candidate?.premiseSeed || '').trim(),
    microPlot: uniqueStrings([
      ...(programInstance?.actionBeats || []),
      ...(candidate?.actionSequence || []),
      ...(draft?.microPlot || [])
    ], 6).slice(0, 3),
    sensoryFocus: String(draft?.sensoryFocus || '').trim(),
    sceneNotes: uniqueStrings([
      ...(programInstance?.frameIntent || []),
      ...(draft?.sceneNotes || []),
      locationLabel ? `Scene location archetype: ${locationLabel}` : '',
      objectLabel ? `Object focus: ${objectLabel}` : ''
    ], 12),
    continuityImageAdvice: sanitizeCreativeGuidanceNotes(continuityCreativeReview?.imageAdvice || []),
    captionFocus: uniqueStrings([
      ...(programInstance?.captionHooks || []),
      ...(draft?.captionFocus || []),
      ...(candidate?.captionHooks || [])
    ], 10)
  };
}

function buildSceneNotes({ lane, locationName, candidate, draft, continuityCreativeReview, lifeRecordTraceCues, programInstance }) {
  const candidateNotes = uniqueStrings([
    ...(programInstance?.frameIntent || []),
    ...(programInstance?.antiRepeatNotes || []),
    ...(candidate?.imageHooks || []),
    ...(candidate?.captionHooks || []),
    ...sanitizeCreativeGuidanceNotes(continuityCreativeReview?.imageAdvice || []),
    ...(draft?.sceneNotes || [])
  ], 14);

  const base = buildBaseSceneNotes(lane, locationName || '');
  if (lane === 'selfie') {
    return uniqueStrings([
      ...base,
      ...candidateNotes,
      'Keep identity stability higher than background novelty.'
    ], 16);
  }

  const presenceMode = String(candidate?.presenceMode || 'partial_presence');
  return uniqueStrings([
    ...base,
    ...candidateNotes,
    `Presence mode: ${presenceMode}.`,
    `Preferred trace cues: ${lifeRecordTraceCues.join(', ') || 'hand, sleeve, reflection, or accessory'}.`
  ], 18);
}

function buildSceneSemantics(candidate, worldStateSnapshot, scenePlanDraft, selectedHypothesis) {
  const locationArchetype = String(candidate?.locationArchetype || 'indoor_desk_corner');
  const locationCluster = String(candidate?.locationCluster || '');
  return {
    selectedCandidateId: String(candidate?.candidateId || ''),
    hypothesisId: String(candidate?.hypothesisId || selectedHypothesis?.hypothesisId || ''),
    sourceSeedId: String(candidate?.sourceSeedId || selectedHypothesis?.sourceSeedId || ''),
    situationType: String(candidate?.situationType || selectedHypothesis?.situationType || ''),
    relationshipTension: String(candidate?.relationshipTension || selectedHypothesis?.relationshipTension || ''),
    sceneProgramId: String(candidate?.sceneProgramId || 'legacy_program'),
    affordanceId: String(candidate?.affordanceId || ''),
    locationArchetype,
    locationCluster,
    objectFamily: String(candidate?.objectFamily || ''),
    objectBindings: uniqueStrings(candidate?.objectBindings || selectedHypothesis?.suggestedObjectBindings || [], 6),
    actionKernel: String(candidate?.actionKernel || ''),
    weatherRole: String(candidate?.weatherRole || worldStateSnapshot?.environment?.weatherRoleDefault || 'background_only'),
    emotionalLanding: String(candidate?.emotionalLanding || ''),
    presencePolicy: String(candidate?.presenceMode || scenePlanDraft?.requestedPresenceMode || ''),
    captionHooks: uniqueStrings(candidate?.captionHooks || [], 6),
    imageHooks: uniqueStrings(candidate?.imageHooks || [], 6),
    repeatRiskLabel: String(candidate?.repeatCritique?.repeatRiskLabel || selectedHypothesis?.validation?.repeatRiskLabel || ''),
    repeatRiskScore: Number(candidate?.repeatCritique?.repeatRiskScore || selectedHypothesis?.validation?.repeatRiskScore || 0)
  };
}

function buildAllowedVariation(lane, config, sceneSemantics) {
  if (lane === 'selfie') {
    return {
      ...(config?.vision?.selfie?.variationBudget || {})
    };
  }
  return {
    sceneProgramId: sceneSemantics.sceneProgramId,
    objectBindings: sceneSemantics.objectBindings,
    weatherRole: sceneSemantics.weatherRole
  };
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const paths = config.paths || {};
  const planner = config.planner || {};
  const historyWindow = Number(planner.historyWindow || 7);

  const legacyDataDir = resolveRelative(configPath, paths.legacyDataDir || '../../../data/ig_roleplay');
  const runtimeDir = resolveRelative(configPath, paths.runtimeDir || '../runtime');
  const currentDir = path.join(runtimeDir, 'current');
  const identityProfilePath = resolveRelative(configPath, paths.identityProfile || '../character/identity_profile.json');
  const referenceLibraryPath = resolveRelative(configPath, paths.referenceLibrary || '../vision/reference_library.json');
  const continuitySnapshotPath = path.join(currentDir, 'continuity_snapshot.json');
  const continuityCreativeReviewPath = path.join(currentDir, 'continuity_creative_review.json');
  const selectedSceneCandidatePath = path.join(currentDir, 'selected_scene_candidate.json');
  const scenePlanDraftPath = path.join(currentDir, 'scene_plan_draft.json');
  const worldStateSnapshotPath = path.join(currentDir, 'world_state_snapshot.json');
  const affordancePoolPath = path.join(currentDir, 'affordance_pool.json');
  const programInstancePath = path.join(currentDir, 'program_instance_ai.json');
  const validatedSituationHypothesesPath = path.join(currentDir, 'validated_situation_hypotheses.json');

  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');
  readJsonRequired(referenceLibraryPath, 'reference library');
  const signals = readJsonOptional(path.join(legacyDataDir, 'signals.json'), {});
  const posted = readJsonl(path.join(legacyDataDir, 'posted.jsonl'));
  const continuitySnapshot = readJsonRequired(continuitySnapshotPath, 'continuity snapshot');
  const continuityCreativeReview = fileExists(continuityCreativeReviewPath) ? readJsonOptional(continuityCreativeReviewPath, {}) : {};
  const selectedSceneCandidateDoc = fileExists(selectedSceneCandidatePath) ? readJsonOptional(selectedSceneCandidatePath, {}) : {};
  const scenePlanDraft = fileExists(scenePlanDraftPath) ? readJsonOptional(scenePlanDraftPath, {}) : {};
  const worldStateSnapshot = fileExists(worldStateSnapshotPath) ? readJsonOptional(worldStateSnapshotPath, {}) : {};
  const affordancePool = fileExists(affordancePoolPath) ? readJsonOptional(affordancePoolPath, {}) : {};
  const programInstance = fileExists(programInstancePath) ? readJsonOptional(programInstancePath, {}) : {};
  const validatedSituationHypotheses = fileExists(validatedSituationHypothesesPath) ? readJsonOptional(validatedSituationHypothesesPath, {}) : {};

  const recentPosts = continuitySnapshot && Array.isArray(continuitySnapshot.recentPosts)
    ? continuitySnapshot.recentPosts
    : posted.slice(-historyWindow);
  const recentStyles = continuitySnapshot && Array.isArray(continuitySnapshot.recentPosts)
    ? continuitySnapshot.recentPosts.map(post => String(post.lane || '').trim().toLowerCase()).filter(Boolean)
    : extractRecentStyles(posted, historyWindow);

  const selectedCandidate = selectedSceneCandidateDoc?.selectedCandidate || {};
  const selectedHypothesis = (validatedSituationHypotheses?.acceptedHypotheses || []).find(item => item.hypothesisId === selectedCandidate.hypothesisId) || {};
  const lane = String(selectedCandidate.lane || continuitySnapshot?.recommendation?.preferredLane || planner.primaryLane || 'selfie').toLowerCase();
  const weatherSignal = deriveWeatherSignal(signals, worldStateSnapshot);
  const trendSignal = deriveTrendSignal(signals);
  const lifeRecordTraceCues = buildLifeRecordTraceCues(config, identityProfile);
  const sceneSemantics = buildSceneSemantics(selectedCandidate, worldStateSnapshot, scenePlanDraft, selectedHypothesis);
  const concreteSceneCueInputs = buildConcreteSceneCueInputs({
    candidate: selectedCandidate,
    draft: scenePlanDraft,
    continuityCreativeReview,
    signals,
    programInstance
  });
  const concreteSceneCues = collectConcreteSceneCues(concreteSceneCueInputs);
  const sceneNotes = buildSceneNotes({
    lane,
    locationName: signals?.location?.name || worldStateSnapshot?.environment?.locationName || '',
    candidate: selectedCandidate,
    draft: scenePlanDraft,
    continuityCreativeReview,
    lifeRecordTraceCues,
    programInstance
  });

  const output = {
    version: config.version || '2.0.0-alpha.1',
    runId: `sceneplan-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
    createdAt: new Date().toISOString(),
    lane,
    laneReason: String(worldStateSnapshot?.continuityPressure?.reason || continuitySnapshot?.recommendation?.reason || '').trim(),
    sourceSnapshot: {
      signalsPath: path.join(legacyDataDir, 'signals.json'),
      postedPath: path.join(legacyDataDir, 'posted.jsonl'),
      continuitySnapshotPath,
      continuityCreativeReviewPath: fileExists(continuityCreativeReviewPath) ? continuityCreativeReviewPath : null,
      selectedSceneCandidatePath: fileExists(selectedSceneCandidatePath) ? selectedSceneCandidatePath : null,
      validatedSituationHypothesesPath: fileExists(validatedSituationHypothesesPath) ? validatedSituationHypothesesPath : null,
      programInstancePath: fileExists(programInstancePath) ? programInstancePath : null,
      scenePlanDraftPath: fileExists(scenePlanDraftPath) ? scenePlanDraftPath : null,
      worldStateSnapshotPath: fileExists(worldStateSnapshotPath) ? worldStateSnapshotPath : null,
      affordancePoolPath: fileExists(affordancePoolPath) ? affordancePoolPath : null,
      identityProfilePath,
      referenceLibraryPath
    },
    freshness: {
      weatherSignal,
      trendSignal,
      locationName: signals?.location?.name || worldStateSnapshot?.environment?.locationName || '',
      noveltyGuard: `Checked the latest ${recentPosts.length} posts and ${Number(continuitySnapshot?.semanticHistory?.historyWindow || 0)} semantic history items for repetition risk`
    },
    continuity: {
      recentPostCount: recentPosts.length,
      recentStyles,
      semanticFatigue: continuitySnapshot?.recommendation?.sceneFatigue || [],
      dominantSemantics: continuitySnapshot?.semanticHistory?.stats || {}
    },
    worldState: {
      timeContext: worldStateSnapshot?.timeContext || {},
      environment: worldStateSnapshot?.environment || {},
      characterState: worldStateSnapshot?.characterState || {},
      continuityPressure: worldStateSnapshot?.continuityPressure || {}
    },
    narrative: {
      premise: String(scenePlanDraft?.narrativePremise || programInstance?.executionIntention || selectedCandidate?.premiseSeed || '').trim(),
      microPlot: uniqueStrings([
        ...(scenePlanDraft?.microPlot || []),
        ...(programInstance?.actionBeats || []),
        ...(selectedCandidate?.actionSequence || [])
      ], 6).slice(0, 3),
      sensoryFocus: deriveSensoryFocus(worldStateSnapshot, scenePlanDraft, selectedCandidate, signals, programInstance),
      emotionalLanding: sceneSemantics.emotionalLanding,
      microTension: String(programInstance?.microTension || sceneSemantics.relationshipTension || '').trim()
    },
    sceneSemantics,
    sceneProgramInstance: {
      dynamicProgramName: String(programInstance?.dynamicProgramName || '').trim(),
      executionIntention: String(programInstance?.executionIntention || '').trim(),
      antiRepeatNotes: uniqueStrings(programInstance?.antiRepeatNotes || [], 6),
      summary: String(programInstance?.summary || '').trim(),
      sourceStatus: String(programInstance?.status || '').trim() || 'missing'
    },
    visual: {
      mode: lane === 'selfie' ? 'character_selfie' : 'life_record',
      styleDirection: 'japanese_anime_bishoujo_slice_of_life',
      presenceMode: sceneSemantics.presencePolicy || (lane === 'selfie' ? 'full_selfie' : 'partial_presence'),
      identityAnchors: lane === 'selfie' ? (config?.vision?.selfie?.requiredIdentityAnchors || []) : [],
      characterTraceCues: lane === 'selfie' ? [] : lifeRecordTraceCues,
      allowedVariation: buildAllowedVariation(lane, config, sceneSemantics),
      concreteSceneCues,
      sceneNotes
    },
    caption: {
      tone: uniqueStrings([
        'light chunibyo',
        'gentle',
        'private ritual energy',
        'daily-life texture',
        'non-commercial',
        ...(scenePlanDraft?.tone || [])
      ], 10),
      requiredElements: ['micro_plot', 'sensory_detail', 'daily_variable', 'ordinary_object_with_secret_weight'],
      hooks: uniqueStrings([...(sceneSemantics.captionHooks || []), ...(programInstance?.captionHooks || [])], 8),
      limits: {
        minHashtags: config.caption?.minHashtags || 2,
        maxHashtags: config.caption?.maxHashtags || 5,
        maxEmojis: config.caption?.maxEmojis || 2,
        targetMaxChars: config.caption?.targetMaxChars || 180
      }
    },
    publish: {
      platform: 'instagram',
      dryRunDefault: true
    },
    creativeDirection: {
      continuitySoftPreference: String(continuityCreativeReview.laneSoftPreference || '').trim(),
      continuitySummary: String(continuityCreativeReview.summary || '').trim(),
      draftSummary: String(scenePlanDraft.summary || '').trim(),
      sourceStatus: {
        continuityCreativeReview: String(continuityCreativeReview.status || '').trim() || 'missing',
        selectedSceneCandidate: String(selectedSceneCandidateDoc.status || '').trim() || 'missing',
        validatedSituationHypotheses: String(validatedSituationHypotheses.status || '').trim() || 'missing',
        programInstanceAi: String(programInstance.status || '').trim() || 'missing',
        scenePlanDraft: String(scenePlanDraft.status || '').trim() || 'missing'
      },
      affordanceHints: affordancePool?.primaryAffordanceIds || [],
      noveltyClaims: uniqueStrings([selectedHypothesis?.noveltyClaim || '', ...(programInstance?.antiRepeatNotes || [])], 6)
    }
  };

  const written = writeRuntimeArtifact(runtimeDir, 'scene_plan.json', 'sceneplan', output, { runId: output.runId });
  console.log(`scene plan created: ${written.currentPath}`);
  console.log(`scene plan snapshot: ${written.archivedPath}`);
}

main();
