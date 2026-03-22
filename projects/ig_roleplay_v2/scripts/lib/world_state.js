const { uniqueStrings } = require('./history_semantics');

function clampNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getLocalParts(timezone = 'Asia/Shanghai', fallbackDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  const parts = formatter.formatToParts(fallbackDate);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    weekdayLabel: values.weekday || '',
    date: `${values.year}-${values.month}-${values.day}`
  };
}

function deriveDaypart(hour, rules) {
  const match = (rules.dayparts || []).find(item => hour >= Number(item.startHour) && hour < Number(item.endHour));
  return match?.id || 'afternoon';
}

function deriveWeekdayMode(dateValue, rules) {
  const date = new Date(`${dateValue}T12:00:00+08:00`);
  const day = date.getUTCDay();
  const weekends = new Set(rules?.weekdayModes?.weekendDays || [0, 6]);
  return weekends.has(day)
    ? (rules?.weekdayModes?.weekendLabel || 'weekend')
    : (rules?.weekdayModes?.schoolDayLabel || 'school_day');
}

function deriveSeasonPhase(month, rules) {
  return String(rules?.seasonPhaseByMonth?.[String(month)] || 'season_transition');
}

function deriveTemperatureBand(temp, rules) {
  const entries = rules?.temperatureBands || [];
  for (const entry of entries) {
    if (temp <= Number(entry.max)) {
      return String(entry.id);
    }
  }
  return entries[entries.length - 1]?.id || 'mild';
}

function deriveMobilityWindow(weatherCode, temperatureC, windSpeedKmh, rules) {
  const entries = rules?.mobilityWindows || [];
  for (const entry of entries) {
    const weatherCodes = new Set(entry.weatherCodes || []);
    const matchesWeather = weatherCodes.has(Number(weatherCode));
    const matchesWind = clampNumber(windSpeedKmh, 0) <= Number(entry.windAbove ?? 999);
    const matchesTemp = clampNumber(temperatureC, 18) <= Number(entry.temperatureMax ?? 999);
    if (matchesWeather && matchesWind && matchesTemp) {
      return String(entry.id);
    }
  }
  return 'short_walk_ok';
}

function deriveWeatherRoleDefaults(weatherCode, rules) {
  const rainCodes = new Set(rules?.weatherRolePolicies?.rainCodes || []);
  const stormCodes = new Set(rules?.weatherRolePolicies?.stormCodes || []);
  const fogCodes = new Set(rules?.weatherRolePolicies?.fogCodes || []);
  const snowCodes = new Set(rules?.weatherRolePolicies?.snowCodes || []);
  if (stormCodes.has(Number(weatherCode))) return 'primary_scene_driver';
  if (rainCodes.has(Number(weatherCode)) || fogCodes.has(Number(weatherCode)) || snowCodes.has(Number(weatherCode))) {
    return 'reflective_support';
  }
  return 'background_only';
}

function deriveAttentionShape(preferredLane, noveltyLedger, reflectionNotes) {
  if (preferredLane === 'selfie') return 'self_reflective';
  if (noveltyLedger?.fatigueFlags?.weatherPrimaryOveruse) return 'novelty_seeking';
  if ((reflectionNotes?.fatiguePatterns || []).length > 0) return 'pattern_breaking';
  return 'detail_seeking';
}

function deriveNeedState(preferredLane, rules, noveltyLedger) {
  const defaults = uniqueStrings(rules?.needStateRules?.[preferredLane] || [], 4);
  const extras = [];
  if (noveltyLedger?.fatigueFlags?.indoorClusterOveruse) extras.push('mobility_shift');
  if (noveltyLedger?.fatigueFlags?.studyAftermathClusterOveruse) extras.push('non_study_relief');
  return uniqueStrings([...defaults, ...extras], 5);
}

function deriveWorldMemoryRefs(settingModel, reflectionNotes, noveltyLedger) {
  const recurringObjects = uniqueStrings([
    ...(reflectionNotes?.recurringObjects || []),
    ...(settingModel?.ownedObjectPools?.accessory || []).slice(0, 2),
    ...(settingModel?.ownedObjectPools?.keepsake || []).slice(0, 2)
  ], 8);

  const familiarPlaces = uniqueStrings([
    ...(reflectionNotes?.familiarPlaces || []),
    ...Object.keys(settingModel?.placeArchetypes || {}).slice(0, 3)
  ], 8);

  const emotionalThreads = uniqueStrings([
    ...(reflectionNotes?.stableEmotionalLandings || []),
    ...((noveltyLedger?.counts?.emotionalLanding || []).slice(0, 2).map(item => item.value))
  ], 6);

  return {
    recurringObjects,
    familiarPlaces,
    emotionalThreads
  };
}

function buildWorldStateSnapshot({
  config,
  settingModel,
  rules,
  signals,
  continuitySnapshot,
  noveltyLedger,
  reflectionNotes,
  identityProfile
}) {
  const timezone = settingModel?.worldProfile?.timezone || 'Asia/Shanghai';
  const localParts = getLocalParts(timezone, new Date());
  const dateValue = String(signals?.date || localParts.date);
  const weatherCode = clampNumber(signals?.weather?.weather_code, 0);
  const temperatureC = clampNumber(signals?.weather?.temperature_c, 18);
  const windSpeedKmh = clampNumber(signals?.weather?.wind_speed_kmh, 0);
  const preferredLane = String(continuitySnapshot?.recommendation?.preferredLane || config?.planner?.primaryLane || 'selfie');
  const daypart = deriveDaypart(localParts.hour, rules);
  const weekdayMode = deriveWeekdayMode(dateValue, rules);
  const seasonPhase = deriveSeasonPhase(localParts.month, rules);
  const temperatureBand = deriveTemperatureBand(temperatureC, rules);
  const mobilityWindow = deriveMobilityWindow(weatherCode, temperatureC, windSpeedKmh, rules);
  const weatherRoleDefault = deriveWeatherRoleDefaults(weatherCode, rules);
  const continuityFatigue = noveltyLedger?.dominance?.sceneClusters || [];
  const sceneFatigue = uniqueStrings([
    ...(continuityFatigue || []).map(item => item.value),
    ...(noveltyLedger?.suggestions?.coolDownScenePrograms || [])
  ], 6);

  return {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    sourceSignalsDate: dateValue,
    timeContext: {
      timezone,
      localDate: dateValue,
      localHour: localParts.hour,
      daypart,
      weekdayMode,
      seasonPhase,
      routineAnchors: uniqueStrings([
        ...(settingModel?.routineAnchors?.[weekdayMode] || []),
        ...(weatherRoleDefault !== 'background_only' ? (settingModel?.routineAnchors?.rainy_day || []) : [])
      ], 6)
    },
    environment: {
      city: settingModel?.worldProfile?.city || signals?.location?.name || '',
      locationName: signals?.location?.name || settingModel?.worldProfile?.city || '',
      weatherCode,
      weatherSummary: String(signals?.weather?.summary || '').trim(),
      temperatureC,
      windSpeedKmh,
      temperatureBand,
      mobilityWindow,
      weatherRoleDefault
    },
    characterState: {
      lanePreference: preferredLane,
      energy: String(rules?.energyHeuristics?.daypartBase?.[daypart] || 'medium_low'),
      socialBandwidth: String(rules?.socialBandwidthByLane?.[preferredLane] || 'solo_preferred'),
      attentionShape: deriveAttentionShape(preferredLane, noveltyLedger, reflectionNotes),
      needState: deriveNeedState(preferredLane, rules, noveltyLedger),
      temperament: identityProfile?.coreIdentity?.temperament || []
    },
    worldMemoryRefs: deriveWorldMemoryRefs(settingModel, reflectionNotes, noveltyLedger),
    continuityPressure: {
      preferredLane,
      reason: continuitySnapshot?.recommendation?.reason || '',
      sceneFatigue,
      objectFatigue: (noveltyLedger?.dominance?.objectFamilies || []).map(item => item.value).slice(0, 4),
      weatherOveruse: Boolean(noveltyLedger?.fatigueFlags?.weatherPrimaryOveruse),
      indoorOveruse: Boolean(noveltyLedger?.fatigueFlags?.indoorClusterOveruse),
      studyAftermathOveruse: Boolean(noveltyLedger?.fatigueFlags?.studyAftermathClusterOveruse)
    },
    personaGuidance: {
      sceneBiasZh: identityProfile?.creativeGuidance?.sceneBiasZh || [],
      avoidPatternsZh: identityProfile?.creativeGuidance?.avoidPatternsZh || []
    }
  };
}

function buildAffordancePool(worldState, settingModel) {
  const affordances = [];
  const preferredLane = worldState?.characterState?.lanePreference || 'life_record';
  const mobility = worldState?.environment?.mobilityWindow || 'short_walk_ok';
  const weatherRoleDefault = worldState?.environment?.weatherRoleDefault || 'background_only';
  const needState = new Set(worldState?.characterState?.needState || []);
  const daypart = worldState?.timeContext?.daypart || 'afternoon';
  const weekdayMode = worldState?.timeContext?.weekdayMode || 'school_day';

  function addAffordance(id, score, reasons, extra = {}) {
    affordances.push({
      id,
      score,
      reasons: uniqueStrings(reasons, 6),
      ...extra
    });
  }

  addAffordance(
    'indoor_reset_window',
    mobility === 'indoor_preferred' ? 0.95 : 0.72,
    [
      'Current mobility and energy favor a contained indoor scene.',
      needState.has('small_reset') ? 'Character state is asking for a small reset.' : '',
      daypart.includes('evening') ? 'Evening timing naturally supports reset energy.' : ''
    ],
    { preferredLocationKinds: ['indoor', 'indoor_domestic'] }
  );

  addAffordance(
    'rediscovery_window',
    0.7,
    [
      'Recurring small objects make rediscovery scenes plausible.',
      needState.has('private_meaning') ? 'Need state supports a found object carrying private meaning.' : ''
    ],
    { preferredLocationKinds: ['indoor', 'public_indoor'] }
  );

  addAffordance(
    'threshold_pause_window',
    mobility === 'indoor_preferred' ? 0.54 : 0.78,
    [
      'The day has in-between energy that suits a threshold pause.',
      weatherRoleDefault !== 'background_only' ? 'Weather can support a liminal pause without taking over.' : ''
    ],
    { preferredLocationKinds: ['liminal_indoor', 'semi_outdoor'] }
  );

  if (mobility !== 'indoor_preferred') {
    addAffordance(
      'transit_fragment_window',
      weekdayMode === 'school_day' ? 0.82 : 0.63,
      [
        'Mobility window allows a short transit fragment.',
        weekdayMode === 'school_day' ? 'School-day rhythm naturally creates transit micro-scenes.' : ''
      ],
      { preferredLocationKinds: ['public_transit', 'semi_outdoor', 'outdoor_light'] }
    );
    addAffordance(
      'micro_purchase_window',
      0.68,
      [
        'A low-stakes errand is plausible today.',
        weatherRoleDefault !== 'primary_scene_driver' ? 'Weather can stay secondary while the errand leads.' : ''
      ],
      { preferredLocationKinds: ['public_indoor', 'semi_outdoor'] }
    );
  }

  addAffordance(
    'bookstore_pause_window',
    weekdayMode === 'weekend' ? 0.84 : 0.66,
    [
      'Quiet public indoor space fits the current social bandwidth.',
      'Bookish pause scenes widen the world without breaking persona.'
    ],
    { preferredLocationKinds: ['public_indoor'] }
  );

  addAffordance(
    'return_or_repair_window',
    needState.has('small_reset') ? 0.71 : 0.6,
    [
      'Current state supports restoring, fixing, or returning a small thing.',
      'This keeps action texture different from pure observation.'
    ],
    { preferredLocationKinds: ['indoor', 'public_indoor'] }
  );

  addAffordance(
    'domestic_reset_window',
    daypart === 'late_evening' || daypart === 'night' ? 0.8 : 0.58,
    [
      'Domestic corners fit the slower end of the day.',
      'Soft household action keeps life_record grounded.'
    ],
    { preferredLocationKinds: ['indoor_domestic'] }
  );

  addAffordance(
    'kitchen_comfort_window',
    ['cool', 'cold'].includes(worldState?.environment?.temperatureBand) ? 0.84 : 0.62,
    [
      'Temperature and energy support a tiny comfort scene.',
      'Hand-to-object intimacy is plausible in the current state.'
    ],
    { preferredLocationKinds: ['indoor_domestic', 'indoor'] }
  );

  addAffordance(
    'self_capture_window',
    preferredLane === 'selfie' ? 0.92 : 0.44,
    [
      preferredLane === 'selfie' ? 'Continuity rhythm allows self-capture.' : 'Self-capture remains available as a secondary path.',
      'Persona supports close emotional translation when needed.'
    ],
    { preferredLocationKinds: ['indoor', 'liminal_indoor', 'outdoor_light'] }
  );

  const sorted = affordances
    .filter(item => item.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return {
    version: worldState.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    sourceWorldStateCreatedAt: worldState.createdAt,
    primaryAffordanceIds: sorted.slice(0, 4).map(item => item.id),
    affordances: sorted,
    placeArchetypes: Object.keys(settingModel?.placeArchetypes || {})
  };
}

module.exports = {
  buildAffordancePool,
  buildWorldStateSnapshot,
  deriveDaypart,
  deriveMobilityWindow,
  deriveSeasonPhase,
  deriveTemperatureBand,
  deriveWeekdayMode
};
