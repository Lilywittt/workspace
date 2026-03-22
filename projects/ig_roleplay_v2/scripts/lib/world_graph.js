const { uniqueStrings } = require('./history_semantics');

function countFor(counter, value) {
  if (!value) return 0;
  const match = (counter || []).find(item => item.value === value);
  return match ? Number(match.count || 0) : 0;
}

function normalizeId(value, fallback = 'item') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
}

function compactText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function overlaps(sourceValues, targetValues) {
  const source = new Set((sourceValues || []).map(value => String(value || '').trim()).filter(Boolean));
  return (targetValues || []).filter(value => source.has(String(value || '').trim()));
}

function isIndoorKind(kind) {
  return ['indoor', 'public_indoor', 'indoor_domestic', 'liminal_indoor'].includes(String(kind || ''));
}

function scoreReasonsToSummary(reasons, fallback) {
  const normalized = uniqueStrings(reasons || [], 4);
  return normalized.length > 0 ? normalized : [fallback];
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

function matchNeedStateWeights(graphConfig, type, needState, values) {
  const weightMap = graphConfig?.[type] || {};
  const scores = [];
  for (const need of needState || []) {
    const wanted = weightMap[need] || [];
    const matched = overlaps(values, wanted);
    if (matched.length > 0) scores.push({ need, matched });
  }
  return scores;
}

function preferredIndoorBonus(place, worldState) {
  const mobility = String(worldState?.environment?.mobilityWindow || 'short_walk_ok');
  const indoor = isIndoorKind(place?.kind);
  if (mobility === 'indoor_preferred') return indoor ? 16 : -10;
  return indoor ? 2 : 8;
}

function buildPlaceNodes({ graphConfig, settingModel, worldState, noveltyLedger, reflectionNotes }) {
  const counters = buildCounterMap(noveltyLedger);
  const familiarPlaces = new Set(reflectionNotes?.familiarPlaces || []);
  const placeEntries = Object.entries(settingModel?.placeArchetypes || {});
  return placeEntries
    .map(([placeId, place]) => {
      const weightHits = matchNeedStateWeights(graphConfig, 'placeTagWeights', worldState?.characterState?.needState || [], place?.tags || []);
      const repeatPenalty = countFor(counters.locationArchetype, placeId) * 9;
      const clusterPenalty = countFor(counters.sceneCluster, place?.sceneCluster) * 6;
      const fatiguePenalty = worldState?.continuityPressure?.indoorOveruse && /indoor|bookish|comfort|domestic/.test(String(place?.sceneCluster || '')) ? 10 : 0;
      const familiarityBonus = familiarPlaces.has(placeId) ? 12 : 0;
      const weightBonus = weightHits.reduce((sum, entry) => sum + (entry.matched.length * 8), 0);
      const activationScore = Math.max(0, Math.round(42 + weightBonus + preferredIndoorBonus(place, worldState) + familiarityBonus - repeatPenalty - clusterPenalty - fatiguePenalty));

      const reasons = [
        ...weightHits.map(entry => `${entry.need} is pulling toward ${entry.matched.join(', ')}`),
        familiarPlaces.has(placeId) ? 'This place already has some lived memory for the character.' : '',
        preferredIndoorBonus(place, worldState) > 0 ? "This place fits today's mobility window." : "This place is slightly harder to justify under today's mobility window.",
        fatiguePenalty > 0 ? 'This place carries some indoor fatigue risk.' : ''
      ];

      return {
        id: placeId,
        kind: String(place?.kind || ''),
        sceneCluster: String(place?.sceneCluster || ''),
        tags: uniqueStrings(place?.tags || [], 10),
        familiarity: familiarPlaces.has(placeId) ? 'familiar' : 'available',
        fatiguePenalty,
        activationScore,
        reasons: scoreReasonsToSummary(reasons, 'Available place node for today.')
      };
    })
    .sort((a, b) => b.activationScore - a.activationScore || a.id.localeCompare(b.id));
}

function buildObjectNodes({ graphConfig, settingModel, worldState, noveltyLedger, reflectionNotes, identityProfile }) {
  const counters = buildCounterMap(noveltyLedger);
  const recurringObjects = new Set((reflectionNotes?.recurringObjects || []).map(item => String(item || '').trim().toLowerCase()));
  const signatureTraits = new Set(identityProfile?.coreIdentity?.signatureTraits || []);
  const objectEntries = Object.entries(settingModel?.ownedObjectPools || {});

  return objectEntries
    .map(([family, pool]) => {
      const weightHits = matchNeedStateWeights(graphConfig, 'objectFamilyWeights', worldState?.characterState?.needState || [], [family]);
      const symbolicKeywords = graphConfig?.symbolicObjectKeywords?.[family] || [];
      const symbolicWeight = (pool || []).reduce((sum, objectBinding) => {
        const normalized = String(objectBinding || '').toLowerCase();
        return sum + symbolicKeywords.filter(keyword => normalized.includes(String(keyword).toLowerCase())).length;
      }, 0);
      const recurringBonus = (pool || []).some(item => recurringObjects.has(String(item || '').trim().toLowerCase())) ? 10 : 0;
      const personaBonus = signatureTraits.has('small_red_hairclip') && family === 'accessory' ? 10 : 0;
      const repeatPenalty = countFor(counters.objectFamily, family) * 8;
      const activationScore = Math.max(0, Math.round(40 + (weightHits.reduce((sum, entry) => sum + entry.matched.length * 10, 0)) + symbolicWeight * 2 + recurringBonus + personaBonus - repeatPenalty));
      const candidateBindings = uniqueStrings([...(pool || []).filter(item => recurringObjects.has(String(item || '').trim().toLowerCase())), ...(pool || [])], 5);
      const reasons = [
        ...weightHits.map(entry => `${family} matches ${entry.need}.`),
        recurringBonus > 0 ? 'This object family already has memory weight.' : '',
        personaBonus > 0 ? 'This object family is anchored to the character signature.' : '',
        symbolicWeight > 0 ? 'This family carries symbolic object cues.' : ''
      ];

      return {
        id: `object_family_${family}`,
        family,
        candidateBindings,
        symbolicKeywords,
        activationScore,
        reasons: scoreReasonsToSummary(reasons, 'Available object family for today.')
      };
    })
    .sort((a, b) => b.activationScore - a.activationScore || a.family.localeCompare(b.family));
}

function emotionalLandingBonus(family, needState) {
  const needs = new Set(needState || []);
  if (needs.has('private_meaning') && ['private_omen', 'memory_return', 'shy_attachment'].includes(family)) return 12;
  if (needs.has('small_reset') && ['tiny_reset', 'gentle_order', 'quiet_completion'].includes(family)) return 10;
  if (needs.has('mobility_shift') && ['tiny_reset', 'private_omen'].includes(family)) return 8;
  if (needs.has('non_study_relief') && ['tiny_reset', 'shy_attachment'].includes(family)) return 8;
  return 0;
}

function chooseProgramWeatherRole(program, worldState) {
  const options = program?.weatherPolicy?.preferredRoles || [];
  const defaultRole = String(worldState?.environment?.weatherRoleDefault || 'background_only');
  if (options.includes(defaultRole)) return defaultRole;
  if (program?.weatherPolicy?.allowPrimary && options.includes('primary_scene_driver')) return 'primary_scene_driver';
  return options[0] || defaultRole;
}

function chooseProgramPresence(program, worldState) {
  const lane = String(worldState?.characterState?.lanePreference || 'life_record');
  if (lane === 'selfie') return 'full_selfie';
  return String((program?.presencePolicies || [])[0] || 'partial_presence');
}

function buildProgramNodes({ catalog, worldState, affordancePool, noveltyLedger }) {
  const counters = buildCounterMap(noveltyLedger);
  const needState = worldState?.characterState?.needState || [];
  const primaryAffordances = new Set(affordancePool?.primaryAffordanceIds || []);
  const availableAffordances = new Set((affordancePool?.affordances || []).map(item => item.id));
  const preferredLane = String(worldState?.characterState?.lanePreference || 'life_record');
  const coolDownPrograms = new Set(noveltyLedger?.suggestions?.coolDownScenePrograms || []);

  return (catalog?.programs || [])
    .filter(program => (program?.laneEligibility || []).includes(preferredLane))
    .map(program => {
      const affordanceMatch = (program?.requiredAffordances || []).filter(id => primaryAffordances.has(id));
      const availableMatch = (program?.requiredAffordances || []).filter(id => availableAffordances.has(id));
      const landingBonus = (program?.emotionalLandingFamilies || []).reduce((sum, family) => sum + emotionalLandingBonus(family, needState), 0);
      const cooldownPenalty = coolDownPrograms.has(program.id) ? 18 : 0;
      const repeatPenalty = countFor(counters.sceneProgram, program.id) * 10;
      const activationScore = Math.max(0, Math.round(38 + (affordanceMatch.length * 18) + (availableMatch.length * 8) + landingBonus - cooldownPenalty - repeatPenalty));
      const reasons = [
        affordanceMatch.length > 0 ? `Strong affordance match: ${affordanceMatch.join(', ')}` : '',
        availableMatch.length > 0 && affordanceMatch.length === 0 ? `Compatible with available affordances: ${availableMatch.join(', ')}` : '',
        landingBonus > 0 ? "Emotional landing fits today's need-state." : '',
        cooldownPenalty > 0 ? 'Recent history suggests cooling this program down.' : ''
      ];

      return {
        id: program.id,
        actionKernel: String(program?.actionKernel || ''),
        requiredAffordances: uniqueStrings(program?.requiredAffordances || [], 6),
        compatibleLocationArchetypes: uniqueStrings(program?.locationArchetypes || [], 10),
        compatibleObjectFamilies: uniqueStrings(program?.objectSources || [], 10),
        compatibleEmotionalLandings: uniqueStrings(program?.emotionalLandingFamilies || [], 10),
        captionHooks: uniqueStrings(program?.captionHooks || [], 6),
        imageHooks: uniqueStrings(program?.imageHooks || [], 6),
        defaultWeatherRole: chooseProgramWeatherRole(program, worldState),
        defaultPresenceMode: chooseProgramPresence(program, worldState),
        activationScore,
        reasons: scoreReasonsToSummary(reasons, 'Available scene program for today.')
      };
    })
    .sort((a, b) => b.activationScore - a.activationScore || a.id.localeCompare(b.id));
}

function buildMemoryThreads(reflectionNotes, worldState) {
  const threads = [];
  for (const item of uniqueStrings(reflectionNotes?.recurringObjects || [], 6)) {
    threads.push({ id: `memory_object_${normalizeId(item, 'object')}`, kind: 'object', label: item, strength: 0.72, reason: 'Recurring object in recent memory.' });
  }
  for (const item of uniqueStrings(reflectionNotes?.familiarPlaces || [], 6)) {
    threads.push({ id: `memory_place_${normalizeId(item, 'place')}`, kind: 'place', label: item, strength: 0.68, reason: 'Familiar place still available for reuse or inversion.' });
  }
  for (const item of uniqueStrings(worldState?.worldMemoryRefs?.emotionalThreads || [], 6)) {
    threads.push({ id: `memory_emotion_${normalizeId(item, 'emotion')}`, kind: 'emotion', label: item, strength: 0.64, reason: 'Emotional thread still active in the recent world-state.' });
  }
  return threads;
}

function pickEmotionalLanding(programNode, worldState, noveltyLedger) {
  const counters = buildCounterMap(noveltyLedger);
  const options = programNode?.compatibleEmotionalLandings || ['tiny_reset'];
  const scored = options.map(family => ({ family, score: emotionalLandingBonus(family, worldState?.characterState?.needState || []) - (countFor(counters.emotionalLanding, family) * 7) }))
    .sort((a, b) => b.score - a.score || a.family.localeCompare(b.family));
  return scored[0]?.family || options[0] || 'tiny_reset';
}

function chooseObjectBindings(objectNode, reflectionNotes) {
  const recurring = new Set((reflectionNotes?.recurringObjects || []).map(item => String(item || '').trim().toLowerCase()));
  return uniqueStrings([...(objectNode?.candidateBindings || []).filter(item => recurring.has(String(item || '').trim().toLowerCase())), ...(objectNode?.candidateBindings || [])], 3);
}

function buildActivationMap({ graphConfig, worldGraphSnapshot, worldState, reflectionNotes, continuityReview, noveltyLedger }) {
  const rules = graphConfig?.activationRules || {};
  const topPlaceCount = Number(rules.topPlaceCount || 6);
  const topObjectCount = Number(rules.topObjectCount || 8);
  const topProgramCount = Number(rules.topProgramCount || 6);
  const topSeedCount = Number(rules.topSeedCount || 10);

  const activatedPlaces = (worldGraphSnapshot?.placeNodes || []).slice(0, topPlaceCount);
  const activatedObjects = (worldGraphSnapshot?.objectNodes || []).slice(0, topObjectCount);
  const activatedPrograms = (worldGraphSnapshot?.programNodes || []).slice(0, topProgramCount);

  const placeMap = new Map(activatedPlaces.map(item => [item.id, item]));
  const objectMap = new Map(activatedObjects.map(item => [item.family, item]));
  const seeds = [];

  activatedPrograms.forEach(programNode => {
    const compatiblePlaces = activatedPlaces.filter(place => (programNode.compatibleLocationArchetypes || []).includes(place.id));
    const compatibleObjects = activatedObjects.filter(objectNode => (programNode.compatibleObjectFamilies || []).includes(objectNode.family));
    const places = compatiblePlaces.length > 0 ? compatiblePlaces.slice(0, 2) : activatedPlaces.slice(0, 2);
    const objects = compatibleObjects.length > 0 ? compatibleObjects.slice(0, 2) : activatedObjects.slice(0, 2);
    const affordanceId = (programNode.requiredAffordances || [])[0] || (worldGraphSnapshot?.primaryAffordanceIds || [])[0] || '';

    places.forEach(place => {
      objects.forEach(objectNode => {
        const emotionalLanding = pickEmotionalLanding(programNode, worldState, noveltyLedger);
        const reasons = uniqueStrings([...programNode.reasons, ...place.reasons, ...objectNode.reasons, ...(continuityReview?.freshnessTargets || []).slice(0, 2)], 8);
        seeds.push({
          seedId: `seed_${normalizeId(`${programNode.id}_${place.id}_${objectNode.family}`, 'seed')}`,
          sceneProgramId: programNode.id,
          affordanceId,
          locationArchetype: place.id,
          locationCluster: place.sceneCluster,
          objectFamily: objectNode.family,
          suggestedObjectBindings: chooseObjectBindings(objectNode, reflectionNotes),
          actionKernel: programNode.actionKernel,
          emotionalLanding,
          weatherRole: programNode.defaultWeatherRole,
          presenceMode: programNode.defaultPresenceMode,
          activationScore: Math.round((programNode.activationScore * 0.45) + (place.activationScore * 0.3) + (objectNode.activationScore * 0.25)),
          reasons
        });
      });
    });
  });

  const activatedSeeds = seeds.sort((a, b) => b.activationScore - a.activationScore || a.seedId.localeCompare(b.seedId))
    .slice(0, topSeedCount)
    .map(seed => ({ ...seed, activatedPlace: placeMap.get(seed.locationArchetype) || null, activatedObject: objectMap.get(seed.objectFamily) || null }));

  return {
    version: worldGraphSnapshot?.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    source: 'code',
    status: 'activation_map_ready',
    lane: String(worldState?.characterState?.lanePreference || 'life_record'),
    activationNeedState: uniqueStrings(worldState?.characterState?.needState || [], 6),
    attentionShape: String(worldState?.characterState?.attentionShape || ''),
    activatedPlaces,
    activatedObjects,
    activatedPrograms,
    activatedSeeds,
    activationSummary: uniqueStrings([continuityReview?.summary || '', worldState?.continuityPressure?.reason || '', ...(activatedSeeds[0]?.reasons || [])], 4)
  };
}

function buildActionArc(actionKernel, objectBinding, locationArchetype) {
  const locationLabel = String(locationArchetype || '').replace(/_/g, ' ');
  const objectLabel = String(objectBinding || 'one small object');
  const byKernel = {
    sort_reset_arrange: [`Notice what feels slightly out of place around ${locationLabel}.`, `Straighten or arrange ${objectLabel} instead of trying to fix the whole day.`, 'Let the small act of order change the emotional temperature.'],
    find_unfold_notice_again: [`Find ${objectLabel} during a pause at ${locationLabel}.`, `Give it attention again instead of treating it as background clutter.`, 'Let the rediscovery carry quiet private weight.'],
    pause_listen_hold: [`Pause at ${locationLabel} before moving on.`, `Hold ${objectLabel} long enough for the day to slow down.`, 'Let the in-between feeling become the point of the scene.'],
    wait_carry_pass_through: [`Carry ${objectLabel} through a brief movement window.`, 'Let the transition itself hold the image, not a big event.', 'Keep the fragment small but memorable.'],
    browse_pause_notice: [`Browse in ${locationLabel} without hurrying toward a conclusion.`, `Let ${objectLabel} become strangely personal in a public setting.`, 'End on a private feeling, not a public summary.'],
    choose_pay_carry_back: [`Choose ${objectLabel} for a tiny practical reason.`, `Carry it back into the rest of the day as a private rescue.`, 'Let the purchase feel small but emotionally exact.'],
    return_fix_restore: [`Pick up ${objectLabel} because it still needs one small correction.`, 'Repair, return, or restore it instead of leaving the loop open.', 'Let the quiet completion be the emotional landing.'],
    fold_sort_pause: [`Gather a few soft domestic traces at ${locationLabel}.`, `Fold or sort around ${objectLabel} with repetitive calm.`, 'Let the texture itself do the emotional work.'],
    heat_hold_breathe: [`Warm ${objectLabel} and keep the frame close to the hands.`, 'Pause over the warmth instead of narrating the whole day.', 'Let comfort stay understated and believable.'],
    notice_capture_breathe: ['Notice the feeling arriving before it fully turns into an expression.', `Let ${objectLabel} or one tiny visual marker hold the mood steady.`, 'Capture the moment while it is still half-private.'],
    adjust_check_capture: [`Adjust ${objectLabel} once instead of performing for the frame.`, 'Use the transition itself as the moment worth keeping.', 'Keep the result intimate rather than polished.'],
    touch_adjust_notice: [`Touch ${objectLabel} as a tiny mood switch.`, 'Notice how the gesture changes the emotional texture.', 'Let the gesture stand in for the whole day.']
  };
  return uniqueStrings(byKernel[actionKernel] || byKernel.sort_reset_arrange, 3);
}

function deriveSituationType(needState, seed) {
  const needs = uniqueStrings(needState || [], 3);
  return normalizeId([seed?.sceneProgramId, ...needs].join('_'), 'daily_fragment');
}

function deriveRelationshipTension(worldState, seed) {
  const attention = String(worldState?.characterState?.attentionShape || 'detail_seeking');
  if (attention === 'novelty_seeking') return 'a familiar rhythm asking for a new angle';
  if (attention === 'pattern_breaking') return 'the day wants to break a recently overused pattern';
  if ((worldState?.characterState?.needState || []).includes('private_meaning')) return 'an ordinary object quietly gaining private weight';
  if ((worldState?.characterState?.needState || []).includes('small_reset')) return 'a slightly off day looking for a tiny reset';
  return `today's ${seed?.sceneProgramId || 'fragment'} wants a softer emotional center`;
}

function buildFallbackSituationHypotheses({ activationMap, worldState, settingModel, reflectionNotes, continuityReview }) {
  const seeds = activationMap?.activatedSeeds || [];
  return seeds.slice(0, 6).map((seed, index) => {
    const bindings = uniqueStrings([...(seed?.suggestedObjectBindings || []), ...((settingModel?.ownedObjectPools?.[seed?.objectFamily] || []).slice(0, 2))], 3);
    const objectBinding = bindings[0] || seed?.objectFamily || 'one small object';
    const actionArc = buildActionArc(seed.actionKernel, objectBinding, seed.locationArchetype);
    return {
      hypothesisId: `situation_hyp_${String(index + 1).padStart(2, '0')}`,
      sourceSeedId: seed.seedId,
      lane: String(worldState?.characterState?.lanePreference || 'life_record'),
      sceneProgramId: seed.sceneProgramId,
      affordanceId: seed.affordanceId,
      locationArchetype: seed.locationArchetype,
      objectFamily: seed.objectFamily,
      suggestedObjectBindings: bindings,
      weatherRole: seed.weatherRole,
      emotionalLanding: seed.emotionalLanding,
      presenceMode: seed.presenceMode,
      situationType: deriveSituationType(worldState?.characterState?.needState || [], seed),
      relationshipTension: deriveRelationshipTension(worldState, seed),
      actionArc,
      captionHooks: uniqueStrings([`Let ${objectBinding} become the private hinge of the post.`, ...(seed?.reasons || []).slice(0, 2)], 4),
      imageHooks: uniqueStrings([`Keep ${objectBinding} legible in ${String(seed.locationArchetype || '').replace(/_/g, ' ')}.`, ...((seed?.activatedPlace?.tags || []).slice(0, 2).map(tag => `Let ${tag.replace(/_/g, ' ')} show up in the frame.`))], 4),
      noveltyClaim: uniqueStrings([continuityReview?.summary || '', ...(continuityReview?.freshnessTargets || []).slice(0, 2), ...(seed?.reasons || []).slice(0, 2)], 3).join(' '),
      premiseSeed: `${objectBinding} becomes the center of a ${String(seed.sceneProgramId || '').replace(/_/g, ' ')} fragment at ${String(seed.locationArchetype || '').replace(/_/g, ' ')}.`,
      whyNow: uniqueStrings(seed?.reasons || [], 3).join(' ')
    };
  });
}

function validatePresenceMode(value, lane) {
  const normalized = String(value || '').trim();
  if (lane === 'selfie') return 'full_selfie';
  return ['partial_presence', 'wide_scene_with_character_trace'].includes(normalized) ? normalized : 'partial_presence';
}

function repeatRiskScore(hypothesis, noveltyLedger, settingModel) {
  const counters = buildCounterMap(noveltyLedger);
  const place = settingModel?.placeArchetypes?.[hypothesis.locationArchetype] || {};
  const cluster = place.sceneCluster || '';
  return Math.min(100, Math.round(countFor(counters.sceneProgram, hypothesis.sceneProgramId) * 22 + countFor(counters.locationArchetype, hypothesis.locationArchetype) * 16 + countFor(counters.objectFamily, hypothesis.objectFamily) * 12 + countFor(counters.emotionalLanding, hypothesis.emotionalLanding) * 10 + countFor(counters.sceneCluster, cluster) * 8));
}

function repeatRiskLabel(score, graphConfig) {
  const thresholds = graphConfig?.criticThresholds || {};
  if (score >= Number(thresholds.repeatRiskHigh || 75)) return 'high';
  if (score >= Number(thresholds.repeatRiskMedium || 45)) return 'medium';
  return 'low';
}

function feasibilityScore(hypothesis, worldState, settingModel, catalog) {
  const mobility = String(worldState?.environment?.mobilityWindow || 'short_walk_ok');
  const place = settingModel?.placeArchetypes?.[hypothesis.locationArchetype] || {};
  const program = (catalog?.programs || []).find(item => item.id === hypothesis.sceneProgramId) || {};
  let score = 88;
  if (mobility === 'indoor_preferred' && !isIndoorKind(place.kind)) score -= 18;
  if (String(worldState?.characterState?.lanePreference || 'life_record') === 'selfie' && !String(hypothesis.presenceMode || '').includes('selfie')) score -= 10;
  if (!(program?.laneEligibility || []).includes(String(hypothesis.lane || 'life_record'))) score -= 20;
  if (!(program?.locationArchetypes || []).includes(String(hypothesis.locationArchetype || ''))) score -= 12;
  if (!(program?.objectSources || []).includes(String(hypothesis.objectFamily || ''))) score -= 10;
  return Math.max(40, score);
}

function personaFitScore(hypothesis, worldState, identityProfile) {
  const temperament = new Set(identityProfile?.coreIdentity?.temperament || []);
  let score = 72;
  if (['private_omen', 'memory_return', 'shy_attachment'].includes(hypothesis.emotionalLanding)) score += 8;
  if (temperament.has('light_chunibyo') && /private|omen|secret/i.test(String(hypothesis.relationshipTension || ''))) score += 6;
  if ((worldState?.characterState?.needState || []).includes('small_reset') && ['tiny_reset', 'gentle_order', 'quiet_completion'].includes(hypothesis.emotionalLanding)) score += 8;
  return Math.min(95, score);
}

function activationFitScore(hypothesis, activationMap) {
  const seed = (activationMap?.activatedSeeds || []).find(item => item.seedId === hypothesis.sourceSeedId);
  if (!seed) return 68;
  return Math.min(95, Math.round(seed.activationScore));
}

function normalizeHypothesisShape(hypothesis, lane, settingModel) {
  const objectFamily = String(hypothesis?.objectFamily || '').trim();
  const pool = settingModel?.ownedObjectPools?.[objectFamily] || [];
  const bindings = uniqueStrings([...(hypothesis?.suggestedObjectBindings || []), ...pool], 3);

  return {
    hypothesisId: String(hypothesis?.hypothesisId || '').trim(),
    sourceSeedId: String(hypothesis?.sourceSeedId || '').trim(),
    lane: String(hypothesis?.lane || lane || 'life_record').trim(),
    sceneProgramId: String(hypothesis?.sceneProgramId || '').trim(),
    affordanceId: String(hypothesis?.affordanceId || '').trim(),
    locationArchetype: String(hypothesis?.locationArchetype || '').trim(),
    objectFamily,
    suggestedObjectBindings: bindings,
    weatherRole: String(hypothesis?.weatherRole || '').trim() || 'background_only',
    emotionalLanding: String(hypothesis?.emotionalLanding || '').trim() || 'tiny_reset',
    presenceMode: validatePresenceMode(hypothesis?.presenceMode, lane),
    situationType: String(hypothesis?.situationType || '').trim() || 'daily_fragment',
    relationshipTension: compactText(hypothesis?.relationshipTension || ''),
    actionArc: uniqueStrings(hypothesis?.actionArc || [], 3),
    captionHooks: uniqueStrings(hypothesis?.captionHooks || [], 4),
    imageHooks: uniqueStrings(hypothesis?.imageHooks || [], 4),
    noveltyClaim: compactText(hypothesis?.noveltyClaim || ''),
    premiseSeed: compactText(hypothesis?.premiseSeed || ''),
    whyNow: compactText(hypothesis?.whyNow || '')
  };
}

function validateSituationHypotheses({ graphConfig, hypothesesDoc, activationMap, worldGraphSnapshot, settingModel, catalog, noveltyLedger, worldState, identityProfile, desiredCount = 5 }) {
  const lane = String(worldState?.characterState?.lanePreference || 'life_record');
  const accepted = [];
  const rejected = [];
  const placeMap = new Map((worldGraphSnapshot?.placeNodes || []).map(item => [item.id, item]));
  const programMap = new Map((catalog?.programs || []).map(item => [item.id, item]));
  const objectFamilies = new Set(Object.keys(settingModel?.ownedObjectPools || {}));
  const activatedSeedIds = new Set((activationMap?.activatedSeeds || []).map(item => item.seedId));

  const rawHypotheses = Array.isArray(hypothesesDoc?.hypotheses) ? hypothesesDoc.hypotheses : [];
  const fallbackHypotheses = buildFallbackSituationHypotheses({
    activationMap,
    worldState,
    settingModel,
    reflectionNotes: { recurringObjects: worldState?.worldMemoryRefs?.recurringObjects || [] },
    continuityReview: { summary: '', freshnessTargets: [] }
  });
  const combined = uniqueStrings(rawHypotheses.map(item => JSON.stringify(item)), rawHypotheses.length).map(item => JSON.parse(item));
  const hypothesesToValidate = combined.length > 0 ? combined : fallbackHypotheses;

  for (const hypothesis of hypothesesToValidate) {
    const normalized = normalizeHypothesisShape(hypothesis, lane, settingModel);
    if (!normalized.hypothesisId) normalized.hypothesisId = `situation_hyp_${String(accepted.length + rejected.length + 1).padStart(2, '0')}`;
    const errors = [];
    const program = programMap.get(normalized.sceneProgramId);
    const place = placeMap.get(normalized.locationArchetype);
    if (!program) errors.push('unknown sceneProgramId');
    if (!place) errors.push('unknown locationArchetype');
    if (!objectFamilies.has(normalized.objectFamily)) errors.push('unknown objectFamily');
    if (normalized.sourceSeedId && !activatedSeedIds.has(normalized.sourceSeedId)) errors.push('sourceSeedId is not present in activation map');
    if (program && !(program.laneEligibility || []).includes(normalized.lane)) errors.push('scene program not eligible for lane');
    if (program && normalized.locationArchetype && !(program.locationArchetypes || []).includes(normalized.locationArchetype)) errors.push('location does not belong to scene program');
    if (program && normalized.objectFamily && !(program.objectSources || []).includes(normalized.objectFamily)) errors.push('object family does not belong to scene program');

    const repeatScore = repeatRiskScore(normalized, noveltyLedger, settingModel);
    const validation = { repeatRiskScore: repeatScore, repeatRiskLabel: repeatRiskLabel(repeatScore, graphConfig), errors };

    if (errors.length > 0) {
      rejected.push({ hypothesisId: normalized.hypothesisId, reasons: errors, normalized });
      continue;
    }

    const scores = {
      novelty: Math.max(18, 100 - repeatScore),
      feasibility: feasibilityScore(normalized, worldState, settingModel, catalog),
      personaFit: personaFitScore(normalized, worldState, identityProfile),
      activationFit: activationFitScore(normalized, activationMap)
    };
    scores.total = Math.round((scores.novelty * 0.32) + (scores.feasibility * 0.24) + (scores.personaFit * 0.22) + (scores.activationFit * 0.22));

    accepted.push({ ...normalized, locationCluster: place?.sceneCluster || '', validation, scores });
    if (accepted.length >= desiredCount) break;
  }

  return {
    version: worldState?.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    source: 'code',
    status: 'validated_situation_hypotheses_ready',
    inputSource: String(hypothesesDoc?.source || 'unknown'),
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    acceptedHypotheses: accepted,
    rejectedHypotheses: rejected
  };
}

function buildWorldGraphSnapshot({ config, graphConfig, settingModel, catalog, worldState, affordancePool, noveltyLedger, reflectionNotes, identityProfile }) {
  const placeNodes = buildPlaceNodes({ graphConfig, settingModel, worldState, noveltyLedger, reflectionNotes });
  const objectNodes = buildObjectNodes({ graphConfig, settingModel, worldState, noveltyLedger, reflectionNotes, identityProfile });
  const programNodes = buildProgramNodes({ catalog, worldState, affordancePool, noveltyLedger });
  const memoryThreads = buildMemoryThreads(reflectionNotes, worldState);

  return {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    source: 'code',
    status: 'world_graph_snapshot_ready',
    graphVersion: graphConfig?.version || '2.0.0-alpha.1',
    lane: String(worldState?.characterState?.lanePreference || 'life_record'),
    needState: uniqueStrings(worldState?.characterState?.needState || [], 6),
    primaryAffordanceIds: uniqueStrings(affordancePool?.primaryAffordanceIds || [], 6),
    placeNodes,
    objectNodes,
    programNodes,
    memoryThreads,
    graphSummary: {
      topPlaceIds: placeNodes.slice(0, 5).map(item => item.id),
      topObjectFamilies: objectNodes.slice(0, 5).map(item => item.family),
      topProgramIds: programNodes.slice(0, 5).map(item => item.id)
    }
  };
}

module.exports = { buildActionArc, buildActivationMap, buildFallbackSituationHypotheses, buildWorldGraphSnapshot, compactText, repeatRiskLabel, repeatRiskScore, validateSituationHypotheses };

