const { uniqueStrings } = require('./history_semantics');

function hashSeed(text) {
  const source = String(text || '');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function countFor(counter, value) {
  if (!value) return 0;
  const match = (counter || []).find(item => item.value === value);
  return match ? Number(match.count || 0) : 0;
}

function buildCounterMap(noveltyLedger) {
  return {
    sceneProgram: noveltyLedger?.counts?.sceneProgramId || [],
    locationArchetype: noveltyLedger?.counts?.locationArchetype || [],
    actionKernel: noveltyLedger?.counts?.actionKernel || [],
    objectFamily: noveltyLedger?.counts?.objectFamily || [],
    emotionalLanding: noveltyLedger?.counts?.emotionalLanding || [],
    weatherRole: noveltyLedger?.counts?.weatherRole || [],
    presenceMode: noveltyLedger?.counts?.presenceMode || [],
    sceneCluster: noveltyLedger?.counts?.locationCluster || []
  };
}

function pickPreferredWeatherRole(program, worldState, noveltyLedger) {
  const options = program?.weatherPolicy?.preferredRoles || ['background_only'];
  const defaultRole = worldState?.environment?.weatherRoleDefault || 'background_only';
  const counters = buildCounterMap(noveltyLedger);
  const weighted = options
    .map(role => ({
      role,
      score: role === defaultRole ? 20 : 12 - (countFor(counters.weatherRole, role) * 3)
    }))
    .sort((a, b) => b.score - a.score);

  if (program?.weatherPolicy?.allowPrimary === false && weighted[0]?.role === 'primary_scene_driver') {
    const fallback = weighted.find(item => item.role !== 'primary_scene_driver');
    return fallback?.role || 'reflective_support';
  }
  return weighted[0]?.role || defaultRole;
}

function chooseLocation(program, settingModel, worldState, noveltyLedger, seed) {
  const counters = buildCounterMap(noveltyLedger);
  const placeArchetypes = settingModel?.placeArchetypes || {};
  const desiredKinds = new Set(
    ((worldState?.environment?.mobilityWindow === 'indoor_preferred')
      ? ['indoor', 'public_indoor', 'indoor_domestic', 'liminal_indoor']
      : ['indoor', 'public_indoor', 'semi_outdoor', 'public_transit', 'outdoor_light', 'liminal_indoor'])
  );

  const ranked = (program?.locationArchetypes || [])
    .map(locationId => {
      const place = placeArchetypes[locationId] || {};
      const repeatPenalty = countFor(counters.locationArchetype, locationId) * 8;
      const clusterPenalty = countFor(counters.sceneCluster, place.sceneCluster) * 5;
      const mobilityBonus = desiredKinds.has(place.kind) ? 12 : 0;
      const seedBonus = hashSeed(`${seed}:${locationId}`) % 5;
      return {
        locationId,
        sceneCluster: place.sceneCluster || '',
        score: mobilityBonus + seedBonus - repeatPenalty - clusterPenalty
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0] || {
    locationId: program?.locationArchetypes?.[0] || 'indoor_desk_corner',
    sceneCluster: placeArchetypes?.[program?.locationArchetypes?.[0]]?.sceneCluster || ''
  };
}

function chooseObject(program, settingModel, noveltyLedger, identityProfile, seed) {
  const counters = buildCounterMap(noveltyLedger);
  const pools = settingModel?.ownedObjectPools || {};
  const objectFamily = (program?.objectSources || [])[0] || 'stationery';
  const pool = pools[objectFamily] || [];
  const personaDefault = identityProfile?.coreIdentity?.signatureTraits?.includes('small_red_hairclip') && objectFamily === 'accessory'
    ? 'small red hairclip'
    : null;

  const ranked = pool
    .map(objectBinding => {
      const base = hashSeed(`${seed}:${objectBinding}`) % 7;
      const repeatPenalty = countFor(counters.objectFamily, objectFamily) * 6;
      const personaBonus = objectBinding === personaDefault ? 6 : 0;
      return {
        objectFamily,
        objectBinding,
        score: base + personaBonus - repeatPenalty
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0] || {
    objectFamily,
    objectBinding: pool[0] || objectFamily
  };
}

function chooseEmotionalLanding(program, noveltyLedger, seed) {
  const counters = buildCounterMap(noveltyLedger);
  const ranked = (program?.emotionalLandingFamilies || [])
    .map(family => ({
      family,
      score: 20 - (countFor(counters.emotionalLanding, family) * 6) + (hashSeed(`${seed}:${family}`) % 4)
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.family || 'tiny_reset';
}

function choosePresenceMode(program, config, noveltyLedger, preferredLane, seed) {
  const counters = buildCounterMap(noveltyLedger);
  if (preferredLane === 'selfie') return 'full_selfie';

  const allowedModes = new Set((config?.vision?.life_record?.presenceModes || ['partial_presence']));
  const ranked = (program?.presencePolicies || [])
    .filter(mode => allowedModes.has(mode))
    .map(mode => ({
      mode,
      score: 12 - (countFor(counters.presenceMode, mode) * 4) + (hashSeed(`${seed}:${mode}`) % 3)
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.mode || config?.vision?.life_record?.preferredPresenceMode || 'partial_presence';
}

function buildActionSequence(actionKernel, objectBinding, locationId, weatherRole) {
  const baseByKernel = {
    sort_reset_arrange: [
      `notice the slight disorder around ${locationId.replace(/_/g, ' ')}`,
      `sort or straighten ${objectBinding}`,
      'let the act of arranging shift the mood'
    ],
    find_unfold_notice_again: [
      `spot ${objectBinding} while pausing`,
      `unfold or lift it into focus`,
      'attach a quiet private meaning to it again'
    ],
    pause_listen_hold: [
      `pause at ${locationId.replace(/_/g, ' ')}`,
      `hold or touch ${objectBinding}`,
      'listen to the day long enough for the mood to settle'
    ],
    wait_carry_pass_through: [
      `carry ${objectBinding} through a short transition`,
      `pause while waiting or passing through`,
      'let an ordinary fragment become keepable'
    ],
    browse_pause_notice: [
      `browse slowly near ${objectBinding}`,
      'pause on one page or small trace',
      'let the quiet public setting turn personal'
    ],
    choose_pay_carry_back: [
      `choose ${objectBinding}`,
      'complete the tiny purchase',
      'carry the small comfort back into the day'
    ],
    return_fix_restore: [
      `pick up ${objectBinding}`,
      'repair, return, or put it back where it belongs',
      'feel the day close a tiny loop'
    ],
    fold_sort_pause: [
      'gather a few soft domestic pieces',
      `fold or sort around ${objectBinding}`,
      'let texture and repetition soften the mood'
    ],
    heat_hold_breathe: [
      `warm or hold ${objectBinding}`,
      'pause over the warmth for one breath',
      'allow the day to settle without declaration'
    ],
    notice_capture_breathe: [
      'notice the mood arriving on the face',
      `capture it while ${objectBinding} still belongs to the frame`,
      'keep the feeling before it evaporates'
    ],
    adjust_check_capture: [
      `adjust ${objectBinding} once`,
      'check the expression in a reflective surface',
      'capture the moment between movement and stillness'
    ],
    touch_adjust_notice: [
      `touch or adjust ${objectBinding}`,
      'notice how the gesture changes the mood',
      'let the small gesture carry the whole feeling'
    ]
  };

  const sequence = baseByKernel[actionKernel] || baseByKernel.sort_reset_arrange;
  if (weatherRole === 'primary_scene_driver') {
    return uniqueStrings([
      sequence[0],
      `${sequence[1]}, while the weather remains impossible to ignore`,
      sequence[2]
    ], 3);
  }
  return uniqueStrings(sequence, 3);
}

function buildPremise(program, selection) {
  const locationLabel = selection.locationArchetype.replace(/_/g, ' ');
  return `${selection.objectBinding} becomes the center of a ${program.actionKernel.replace(/_/g, ' ')} moment at ${locationLabel}.`;
}

function scoreCandidate(candidate, noveltyLedger, noveltyPolicy, worldState) {
  const counters = buildCounterMap(noveltyLedger);
  const weights = noveltyPolicy?.weights || {};
  const penalties = noveltyPolicy?.penalties || {};
  const sceneCluster = candidate.locationCluster || '';

  let score = 100;
  score -= countFor(counters.sceneProgram, candidate.sceneProgramId) * (weights.sceneProgram || 18) * 0.5;
  score -= countFor(counters.locationArchetype, candidate.locationArchetype) * (weights.locationArchetype || 12) * 0.45;
  score -= countFor(counters.actionKernel, candidate.actionKernel) * (weights.actionKernel || 12) * 0.45;
  score -= countFor(counters.objectFamily, candidate.objectFamily) * (weights.objectFamily || 10) * 0.4;
  score -= countFor(counters.emotionalLanding, candidate.emotionalLanding) * (weights.emotionalLanding || 9) * 0.4;
  score -= countFor(counters.weatherRole, candidate.weatherRole) * (weights.weatherRole || 8) * 0.35;
  score -= countFor(counters.presenceMode, candidate.presenceMode) * (weights.presenceMode || 5) * 0.3;
  score -= countFor(counters.sceneCluster, sceneCluster) * (weights.clusterDominance || 10) * 0.35;

  if (candidate.weatherRole === 'primary_scene_driver' && noveltyLedger?.fatigueFlags?.weatherPrimaryOveruse) {
    score -= penalties.weatherPrimaryOveruse || 10;
  }
  if (/indoor_reset|domestic_reset|comfort_reset|indoors_light_edge/.test(sceneCluster) && noveltyLedger?.fatigueFlags?.indoorClusterOveruse) {
    score -= penalties.indoorClusterOveruse || 7;
  }
  if (/indoor_reset|bookish_pause/.test(sceneCluster) && noveltyLedger?.fatigueFlags?.studyAftermathClusterOveruse) {
    score -= penalties.studyAftermathClusterOveruse || 9;
  }

  if (worldState?.continuityPressure?.preferredLane === candidate.lane) score += 8;
  if (worldState?.characterState?.needState?.includes('private_meaning') && candidate.emotionalLanding === 'private_omen') score += 6;
  if (worldState?.characterState?.needState?.includes('small_reset') && ['tiny_reset', 'gentle_order', 'quiet_completion'].includes(candidate.emotionalLanding)) score += 6;
  if (worldState?.environment?.mobilityWindow === 'indoor_preferred' && /outdoor|transit/.test(sceneCluster)) score -= 5;

  return Math.round(score);
}

function buildCatalogScenePlanCandidates({ config, settingModel, catalog, noveltyPolicy, worldState, affordancePool, noveltyLedger, continuityReview, identityProfile }) {
  const preferredLane = worldState?.characterState?.lanePreference || 'life_record';
  const availableAffordances = new Set((affordancePool?.affordances || []).map(item => item.id));
  const desiredCount = Number(noveltyPolicy?.desiredCandidateCount || 5);
  let programs = (catalog?.programs || [])
    .filter(program => (program?.laneEligibility || []).includes(preferredLane))
    .filter(program => (program?.requiredAffordances || []).every(id => availableAffordances.has(id)));
  if (programs.length === 0) {
    programs = (catalog?.programs || []).filter(program => (program?.laneEligibility || []).includes(preferredLane));
  }
  if (programs.length === 0) programs = catalog?.programs || [];

  const candidates = [];
  const baseSeed = hashSeed([
    worldState?.timeContext?.localDate,
    preferredLane,
    worldState?.environment?.weatherSummary,
    continuityReview?.summary
  ].join(':'));

  programs.forEach((program, index) => {
    const seed = baseSeed + index * 17;
    const locationSelection = chooseLocation(program, settingModel, worldState, noveltyLedger, seed);
    const objectSelection = chooseObject(program, settingModel, noveltyLedger, identityProfile, seed + 5);
    const emotionalLanding = chooseEmotionalLanding(program, noveltyLedger, seed + 9);
    const presenceMode = choosePresenceMode(program, config, noveltyLedger, preferredLane, seed + 11);
    const weatherRole = pickPreferredWeatherRole(program, worldState, noveltyLedger);
    const primaryAffordance = (program?.requiredAffordances || [])[0] || (affordancePool?.primaryAffordanceIds || [])[0] || '';
    const actionSequence = buildActionSequence(program.actionKernel, objectSelection.objectBinding, locationSelection.locationId, weatherRole);

    const candidate = {
      candidateId: `scene_cand_${String(index + 1).padStart(2, '0')}`,
      lane: preferredLane,
      sceneProgramId: program.id,
      affordanceId: primaryAffordance,
      locationArchetype: locationSelection.locationId,
      locationCluster: locationSelection.sceneCluster,
      objectFamily: objectSelection.objectFamily,
      objectBindings: [objectSelection.objectBinding],
      weatherRole,
      actionKernel: program.actionKernel,
      actionSequence,
      emotionalLanding,
      presenceMode,
      captionHooks: uniqueStrings(program.captionHooks || [], 6),
      imageHooks: uniqueStrings(program.imageHooks || [], 6),
      premiseSeed: buildPremise(program, {
        objectBinding: objectSelection.objectBinding,
        locationArchetype: locationSelection.locationId
      })
    };

    const totalScore = scoreCandidate(candidate, noveltyLedger, noveltyPolicy, worldState);
    candidates.push({
      ...candidate,
      scores: {
        total: totalScore,
        novelty: totalScore,
        feasibility: Math.max(55, 92 - ((worldState?.environment?.mobilityWindow === 'indoor_preferred' && /outdoor|public_transit/.test(candidate.locationCluster)) ? 18 : 0)),
        personaFit: ['private_omen', 'tiny_reset', 'gentle_order', 'shy_attachment', 'quiet_completion', 'memory_return'].includes(emotionalLanding) ? 88 : 72
      }
    });
  });

  return candidates
    .sort((a, b) => b.scores.total - a.scores.total || a.sceneProgramId.localeCompare(b.sceneProgramId))
    .slice(0, desiredCount);
}

function buildCritiqueMap(semanticRepeatCritic) {
  return new Map((semanticRepeatCritic?.critiques || []).map(item => [item.hypothesisId, item]));
}

function buildCandidatesFromSituationHypotheses({ validatedSituationHypotheses, semanticRepeatCritic, settingModel, noveltyPolicy, worldState, catalog }) {
  const critiqueMap = buildCritiqueMap(semanticRepeatCritic);
  const desiredCount = Number(noveltyPolicy?.desiredCandidateCount || 5);
  const programMap = new Map((catalog?.programs || []).map(item => [item.id, item]));

  return (validatedSituationHypotheses?.acceptedHypotheses || [])
    .map((hypothesis, index) => {
      const critique = critiqueMap.get(hypothesis.hypothesisId) || {};
      const program = programMap.get(hypothesis.sceneProgramId) || {};
      const objectBinding = (hypothesis.suggestedObjectBindings || [])[0]
        || (settingModel?.ownedObjectPools?.[hypothesis.objectFamily] || [])[0]
        || hypothesis.objectFamily;
      const actionSequence = hypothesis.actionArc?.length === 3
        ? uniqueStrings(hypothesis.actionArc, 3)
        : buildActionSequence(hypothesis.actionKernel, objectBinding, hypothesis.locationArchetype, hypothesis.weatherRole);
      const critiquePenalty = critique.repeatRiskLabel === 'high'
        ? 18
        : (critique.repeatRiskLabel === 'medium' ? 8 : 0);
      const freshnessBonus = (critique.freshnessWins || []).length * 2;
      const total = Math.round((Number(hypothesis?.scores?.total || 70) - critiquePenalty) + freshnessBonus);

      return {
        candidateId: `scene_cand_ai_${String(index + 1).padStart(2, '0')}`,
        source: 'ai_hypothesis',
        hypothesisId: hypothesis.hypothesisId,
        sourceSeedId: hypothesis.sourceSeedId,
        situationType: hypothesis.situationType,
        relationshipTension: hypothesis.relationshipTension,
        lane: hypothesis.lane,
        sceneProgramId: hypothesis.sceneProgramId,
        affordanceId: hypothesis.affordanceId,
        locationArchetype: hypothesis.locationArchetype,
        locationCluster: hypothesis.locationCluster || settingModel?.placeArchetypes?.[hypothesis.locationArchetype]?.sceneCluster || '',
        objectFamily: hypothesis.objectFamily,
        objectBindings: uniqueStrings(hypothesis.suggestedObjectBindings || [objectBinding], 3),
        weatherRole: hypothesis.weatherRole,
        actionKernel: hypothesis.actionKernel || program.actionKernel || '',
        actionSequence,
        emotionalLanding: hypothesis.emotionalLanding,
        presenceMode: hypothesis.presenceMode,
        captionHooks: uniqueStrings([...(hypothesis.captionHooks || []), ...(program.captionHooks || []), ...(critique.freshnessWins || [])], 6),
        imageHooks: uniqueStrings([...(hypothesis.imageHooks || []), ...(program.imageHooks || []), critique.suggestedAdjustment || ''], 6),
        premiseSeed: hypothesis.premiseSeed || `${objectBinding} becomes the center of a ${hypothesis.sceneProgramId} fragment.`,
        scores: {
          total,
          novelty: Math.max(20, Number(hypothesis?.scores?.novelty || 60) - (Number(critique.repeatRiskScore || 0) * 0.15)),
          feasibility: Number(hypothesis?.scores?.feasibility || 70),
          personaFit: Number(hypothesis?.scores?.personaFit || 72),
          activationFit: Number(hypothesis?.scores?.activationFit || 68),
          criticRisk: Number(critique.repeatRiskScore || 0)
        },
        repeatCritique: critique
      };
    })
    .sort((a, b) => b.scores.total - a.scores.total || a.sceneProgramId.localeCompare(b.sceneProgramId))
    .slice(0, desiredCount);
}

function buildScenePlanCandidateResult(context) {
  const acceptedHypotheses = context?.validatedSituationHypotheses?.acceptedHypotheses || [];
  if (acceptedHypotheses.length > 0) {
    return {
      plannerMode: 'situation_hypotheses_hybrid',
      source: 'hybrid',
      candidates: buildCandidatesFromSituationHypotheses(context)
    };
  }

  return {
    plannerMode: 'catalog_fallback',
    source: 'code',
    candidates: buildCatalogScenePlanCandidates(context)
  };
}

function buildScenePlanCandidates(context) {
  return buildScenePlanCandidateResult(context).candidates;
}

function selectScenePlanCandidate(candidates) {
  const ranked = [...(candidates || [])].sort((a, b) => b.scores.total - a.scores.total || b.scores.feasibility - a.scores.feasibility);
  const selected = ranked[0] || null;
  return {
    selected,
    ranked
  };
}

module.exports = {
  buildActionSequence,
  buildCandidatesFromSituationHypotheses,
  buildScenePlanCandidateResult,
  buildScenePlanCandidates,
  scoreCandidate,
  selectScenePlanCandidate
};
