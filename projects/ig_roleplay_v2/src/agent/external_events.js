const { readJsonOptional } = require('../common/runtime');
const { asStringArray, compactText, slugify, uniqueStrings } = require('./utils');

function normalizeTimeWindow(raw = {}) {
  return {
    start: compactText(raw.start || ''),
    end: compactText(raw.end || ''),
    scheduleModes: asStringArray(raw.scheduleModes || raw.scheduleMode || [], 4),
    routineWindows: asStringArray(raw.routineWindows || raw.routineWindow || [], 6),
    currentContexts: asStringArray(raw.currentContexts || raw.currentContext || [], 6)
  };
}

function normalizeScope(raw = {}) {
  return {
    city: compactText(raw.city || ''),
    placeIds: asStringArray(raw.placeIds || raw.placeId || [], 8),
    objectIds: asStringArray(raw.objectIds || raw.objectId || [], 8)
  };
}

function normalizePlaceStateChange(raw = {}, index = 0) {
  return {
    changeId: compactText(raw.changeId || `place_change_${String(index + 1).padStart(2, '0')}`),
    placeId: compactText(raw.placeId || ''),
    label: compactText(raw.label || ''),
    stateFacts: asStringArray(raw.stateFacts || [], 6),
    addedPhysicalTraits: asStringArray(raw.addedPhysicalTraits || [], 6),
    addedAvailabilityTags: asStringArray(raw.addedAvailabilityTags || [], 6)
  };
}

function normalizeObjectAvailabilityChange(raw = {}, index = 0) {
  return {
    changeId: compactText(raw.changeId || `object_change_${String(index + 1).padStart(2, '0')}`),
    objectId: compactText(raw.objectId || ''),
    label: compactText(raw.label || ''),
    availabilityMode: compactText(raw.availabilityMode || 'available'),
    stateFacts: asStringArray(raw.stateFacts || [], 6),
    physicalTraits: asStringArray(raw.physicalTraits || [], 6),
    addedAvailabilityTags: asStringArray(raw.addedAvailabilityTags || [], 6)
  };
}

function normalizeExternalEvent(raw = {}, index = 0) {
  return {
    eventId: compactText(raw.eventId || `external_event_${String(index + 1).padStart(2, '0')}`),
    title: compactText(raw.title || raw.summary || ''),
    status: compactText(raw.status || 'active'),
    sourceMode: compactText(raw.sourceMode || 'manual_upstream'),
    timeWindow: normalizeTimeWindow(raw.timeWindow || {}),
    scope: normalizeScope(raw.scope || {}),
    factStatements: asStringArray(raw.factStatements || [], 8),
    placeStateChanges: (raw.placeStateChanges || [])
      .map((item, itemIndex) => normalizePlaceStateChange(item, itemIndex))
      .filter(item => item.placeId || item.label || item.stateFacts.length > 0),
    objectAvailabilityChanges: (raw.objectAvailabilityChanges || [])
      .map((item, itemIndex) => normalizeObjectAvailabilityChange(item, itemIndex))
      .filter(item => item.objectId || item.label || item.stateFacts.length > 0),
    ambientShifts: asStringArray(raw.ambientShifts || [], 6),
    hardConstraints: asStringArray(raw.hardConstraints || [], 6),
    notesZh: compactText(raw.notesZh || '')
  };
}

function loadManualExternalEvents(filePath) {
  const source = readJsonOptional(filePath, {});
  return {
    version: compactText(source.version || '3.0.0-alpha.1'),
    sourceFile: filePath,
    events: (source.events || [])
      .map((item, index) => normalizeExternalEvent(item, index))
      .filter(item => item.eventId)
  };
}

function sameText(left, right) {
  return compactText(left).toLowerCase() === compactText(right).toLowerCase();
}

function isWithinDateRange(timestamp, start, end) {
  const numeric = Date.parse(timestamp || '');
  if (!Number.isFinite(numeric)) return true;

  const startNumeric = Date.parse(start || '');
  if (start && Number.isFinite(startNumeric) && numeric < startNumeric) {
    return false;
  }

  const endNumeric = Date.parse(end || '');
  if (end && Number.isFinite(endNumeric) && numeric > endNumeric) {
    return false;
  }

  return true;
}

function matchesTimeWindow(event, dayContext) {
  const window = event.timeWindow || {};
  if (!isWithinDateRange(
    dayContext?.time?.timestamp || dayContext?.createdAt || '',
    window.start,
    window.end
  )) {
    return false;
  }

  const scheduleModes = window.scheduleModes || [];
  if (scheduleModes.length > 0 && !scheduleModes.includes(dayContext?.date?.scheduleMode || '')) {
    return false;
  }

  const routineWindows = window.routineWindows || [];
  if (routineWindows.length > 0 && !routineWindows.includes(dayContext?.time?.routineWindow || '')) {
    return false;
  }

  const currentContexts = window.currentContexts || [];
  if (currentContexts.length > 0 && !currentContexts.includes(dayContext?.location?.currentContext || '')) {
    return false;
  }

  return true;
}

function matchesScope(event, dayContext) {
  const scope = event.scope || {};
  if (scope.city && !sameText(scope.city, dayContext?.location?.city || '')) {
    return false;
  }
  return true;
}

function isDisabledStatus(status) {
  return ['disabled', 'archived', 'inactive'].includes(compactText(status).toLowerCase());
}

function activationModeForEvent(event, dayContext, scenarioEventIds) {
  if (scenarioEventIds.has(event.eventId)) {
    return isDisabledStatus(event.status) ? '' : 'scenario_selected';
  }
  if (isDisabledStatus(event.status)) {
    return '';
  }
  if (!matchesScope(event, dayContext) || !matchesTimeWindow(event, dayContext)) {
    return '';
  }
  if (compactText(event.status).toLowerCase() === 'scheduled') {
    return 'time_window_match';
  }
  return 'active_by_default';
}

function buildExternalEventPacket({ manualExternalEvents, dayContext, scenario = {} }) {
  const scenarioEventIds = new Set([
    ...asStringArray(scenario.manualExternalEventIds || [], 12),
    ...asStringArray(scenario.activeExternalEventIds || [], 12)
  ]);
  const activeEvents = [];
  const inactiveEvents = [];

  for (const event of (manualExternalEvents?.events || [])) {
    const activationMode = activationModeForEvent(event, dayContext, scenarioEventIds);
    if (!activationMode) {
      inactiveEvents.push({
        eventId: event.eventId,
        title: event.title,
        status: event.status
      });
      continue;
    }
    activeEvents.push({
      ...event,
      activationMode
    });
  }

  const worldStateNotes = uniqueStrings(activeEvents.flatMap(event => [
    ...event.factStatements,
    ...event.placeStateChanges.flatMap(change => change.stateFacts),
    ...event.objectAvailabilityChanges.flatMap(change => change.stateFacts),
    ...event.ambientShifts
  ]), 18);

  const hardConstraints = uniqueStrings(activeEvents.flatMap(event => event.hardConstraints || []), 12);

  return {
    version: manualExternalEvents?.version || '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    sourceFile: manualExternalEvents?.sourceFile || '',
    sourceMode: 'manual_external_events',
    activeEventIds: activeEvents.map(item => item.eventId),
    activeEvents,
    inactiveEvents,
    worldStateNotes,
    hardConstraints,
    guardrails: [
      'Manual external events may change factual world state, but they must not assign a post topic by themselves.',
      'Treat active events as environmental reality and availability facts, not as a required moment.'
    ]
  };
}

function factStatementFromPlaceChange(change = {}, placeLookup = {}) {
  const label = change.label || placeLookup[change.placeId] || change.placeId;
  if (!label) return '';
  if (change.stateFacts.length > 0) {
    return `${label}: ${change.stateFacts[0]}`;
  }
  if (change.addedPhysicalTraits.length > 0) {
    return `${label} currently carries ${change.addedPhysicalTraits[0]}.`;
  }
  return '';
}

function factStatementFromObjectChange(change = {}) {
  const label = change.label || change.objectId;
  if (!label) return '';
  if (change.stateFacts.length > 0) {
    return `${label}: ${change.stateFacts[0]}`;
  }
  if (change.physicalTraits.length > 0) {
    return `${label} is currently plausible with ${change.physicalTraits[0]}.`;
  }
  return '';
}

function buildExternalEventRepairFacts({ externalEventPacket, placeLookup = {} }) {
  const facts = [];

  for (const event of (externalEventPacket?.activeEvents || [])) {
    event.factStatements.forEach((statement, index) => {
      facts.push({
        factId: `external_event_${slugify(event.eventId)}_${String(index + 1).padStart(2, '0')}`,
        kind: 'external_event',
        refId: event.eventId,
        statement
      });
    });

    event.placeStateChanges.forEach((change, index) => {
      const statement = factStatementFromPlaceChange(change, placeLookup);
      if (!statement) return;
      facts.push({
        factId: `external_place_${slugify(event.eventId)}_${String(index + 1).padStart(2, '0')}`,
        kind: 'place_state',
        refId: change.placeId || event.eventId,
        statement,
        traits: uniqueStrings([
          ...change.stateFacts,
          ...change.addedPhysicalTraits
        ], 4)
      });
    });

    event.objectAvailabilityChanges.forEach((change, index) => {
      const statement = factStatementFromObjectChange(change);
      if (!statement) return;
      facts.push({
        factId: `external_object_${slugify(event.eventId)}_${String(index + 1).padStart(2, '0')}`,
        kind: 'object_state',
        refId: change.objectId || change.label || event.eventId,
        statement,
        traits: uniqueStrings([
          ...change.stateFacts,
          ...change.physicalTraits
        ], 4)
      });
    });
  }

  return facts;
}

module.exports = {
  buildExternalEventPacket,
  buildExternalEventRepairFacts,
  loadManualExternalEvents
};
