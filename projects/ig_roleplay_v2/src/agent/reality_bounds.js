const { asStringArray, compactText, uniqueStrings } = require('./utils');
const { buildExternalEventRepairFacts } = require('./external_events');

function weatherTags(bucket) {
  if (bucket === 'rain') return ['rain_ok', 'light_rain_ok'];
  if (bucket === 'clear') return ['clear_ok'];
  if (bucket === 'cloudy') return ['clear_ok', 'rain_ok'];
  return [];
}

function matchesAvailability(itemTags = [], requiredTags = []) {
  return requiredTags.every(tag => itemTags.includes(tag));
}

function pickRelevantPlaces(worldFacts, dayContext, externalEventPacket) {
  const required = [
    dayContext?.date?.scheduleMode,
    dayContext?.time?.routineWindow
  ].filter(Boolean);
  const weatherOk = weatherTags(dayContext?.weather?.bucket);
  const forcedPlaceIds = new Set((externalEventPacket?.activeEvents || []).flatMap(event => (
    (event.placeStateChanges || []).map(change => change.placeId).filter(Boolean)
  )));
  return (worldFacts?.places || [])
    .filter(place => {
      if (forcedPlaceIds.has(place.id)) {
        return true;
      }
      const tags = place.availabilityTags || [];
      const baseMatch = matchesAvailability(tags, required);
      if (!baseMatch) return false;
      if (weatherOk.length === 0) return true;
      return weatherOk.some(tag => tags.includes(tag)) || tags.includes('always');
    })
    .slice(0, 5);
}

function pickRelevantObjects(worldFacts, dayContext, externalEventPacket) {
  const scheduleMode = dayContext?.date?.scheduleMode;
  const weatherOk = weatherTags(dayContext?.weather?.bucket);
  const forcedObjectIds = new Set((externalEventPacket?.activeEvents || []).flatMap(event => (
    (event.objectAvailabilityChanges || []).map(change => change.objectId).filter(Boolean)
  )));
  return (worldFacts?.objects || [])
    .filter(item => {
      if (forcedObjectIds.has(item.id)) {
        return true;
      }
      const tags = item.availabilityTags || [];
      return tags.includes('always')
        || tags.includes('portable')
        || tags.includes(scheduleMode)
        || weatherOk.some(tag => tags.includes(tag));
    })
    .slice(0, 6);
}

function buildRealityBounds({
  worldFacts,
  dayContext,
  characterRuntime,
  characterProfile,
  externalEventPacket
}) {
  const relevantPlaces = pickRelevantPlaces(worldFacts, dayContext, externalEventPacket);
  const relevantObjects = pickRelevantObjects(worldFacts, dayContext, externalEventPacket);
  const placeLookup = Object.fromEntries((worldFacts?.places || []).map(place => [place.id, place.label]));
  const externalRepairFacts = buildExternalEventRepairFacts({
    externalEventPacket,
    placeLookup
  });

  const minimalBounds = [
    {
      boundId: `context_${compactText(dayContext?.location?.currentContext || 'daily_context')}`,
      kind: 'context',
      statement: `Current context is ${dayContext?.location?.currentContext || 'daily_context'}.`
    },
    {
      boundId: `window_${compactText(dayContext?.time?.routineWindow || 'routine_window')}`,
      kind: 'time_window',
      statement: `Current routine window is ${dayContext?.time?.routineWindow || 'routine_window'}.`
    },
    {
      boundId: `weather_${compactText(dayContext?.weather?.bucket || 'weather')}`,
      kind: 'weather',
      statement: `Weather reads as ${dayContext?.weather?.summary || dayContext?.weather?.bucket || 'unspecified'}.`
    },
    {
      boundId: 'identity_stability',
      kind: 'identity',
      statement: `Core identity anchors must remain stable: ${(characterProfile?.identityAnchors?.immutableTraits || []).join(', ') || 'stable recurring character'}.`
    },
    ...((externalEventPacket?.activeEvents || []).map(event => ({
      boundId: `external_${compactText(event.eventId || 'event')}`,
      kind: 'external_event',
      statement: event.factStatements[0] || event.title || `External event ${event.eventId} is active in world state.`
    })))
  ];

  const repairFacts = [
    ...relevantPlaces.map(place => ({
      factId: `place_${place.id}`,
      kind: 'place',
      refId: place.id,
      statement: `${place.label} is a plausible nearby anchor in this context.`,
      traits: asStringArray(place.physicalTraits || [], 4)
    })),
    ...relevantObjects.map(item => ({
      factId: `object_${item.id}`,
      kind: 'object',
      refId: item.id,
      statement: `${item.label} is a plausible object anchor in this context.`,
      traits: asStringArray(item.physicalTraits || [], 4)
    })),
    ...externalRepairFacts
  ];

  return {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    mode: 'weak_bounds_and_repair_context',
    minimalBounds,
    ambientResonance: characterRuntime?.ambientResonance || {
      activeTexturesZh: [],
      weakPullsZh: [],
      ignoredSignalCategories: []
    },
    repairFacts,
    uncertainties: uniqueStrings([
      dayContext?.location?.specificPlaceHint
        ? ''
        : 'Exact micro-location is not fixed at generation time.',
      'Small carried details may exist without being predetermined.'
    ], 4),
    guardrails: uniqueStrings([
      'Use this layer to avoid contradiction, not to choose a topic.',
      'Prefer grounding repair after exploration over strong early steering.',
      ...(externalEventPacket?.guardrails || []),
      ...(externalEventPacket?.hardConstraints || [])
    ], 12),
    visualTraceCues: asStringArray(characterProfile?.visual?.traceCuePreferences || [], 4),
    activeExternalEvents: (externalEventPacket?.activeEvents || []).map(event => ({
      eventId: event.eventId,
      title: event.title,
      activationMode: event.activationMode,
      factStatements: asStringArray(event.factStatements || [], 3)
    }))
  };
}

function buildRealityBoundsSummary(realityBounds) {
  return {
    version: realityBounds.version,
    createdAt: realityBounds.createdAt,
    mode: 'weak_bounds_summary_for_exploration',
    minimalBounds: (realityBounds.minimalBounds || []).map(item => ({
      boundId: item.boundId,
      kind: item.kind,
      statement: item.statement
    })),
    ambientResonance: realityBounds.ambientResonance || {},
    guardrails: realityBounds.guardrails || [],
    activeExternalEvents: (realityBounds.activeExternalEvents || []).map(event => ({
      eventId: event.eventId,
      title: event.title,
      activationMode: event.activationMode,
      factStatements: event.factStatements || []
    }))
  };
}

module.exports = {
  buildRealityBounds,
  buildRealityBoundsSummary
};
