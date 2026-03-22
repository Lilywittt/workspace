const { compactText, daypartForHour, parseLocalDateParts, weatherBucket } = require('./utils');

function weekdayKindFromParts(parts) {
  return ['Sat', 'Sun'].includes(parts.weekday) ? 'weekend' : 'school_day';
}

function inferRoutineWindow(scheduleMode, hour) {
  if (scheduleMode === 'weekend') {
    if (hour < 12) return 'late_morning_outing';
    if (hour < 17) return 'afternoon_pause';
    if (hour < 20) return 'early_evening_errand';
    return 'night_reset';
  }

  if (hour < 8) return 'before_class';
  if (hour < 14) return 'lunch_break';
  if (hour < 18) return 'after_class';
  return 'evening_reset';
}

function inferCurrentContext(scheduleMode, routineWindow) {
  const weekendMap = {
    late_morning_outing: 'weekend_outing_window',
    afternoon_pause: 'weekend_pause_window',
    early_evening_errand: 'light_errand_window',
    night_reset: 'home_night_reset'
  };
  const schoolMap = {
    before_class: 'school_pre_class_window',
    lunch_break: 'school_midday_window',
    after_class: 'school_transition_window',
    evening_reset: 'home_evening_reset'
  };
  return scheduleMode === 'weekend'
    ? (weekendMap[routineWindow] || 'weekend_pause_window')
    : (schoolMap[routineWindow] || 'school_transition_window');
}

function seasonTag(month) {
  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8].includes(month)) return 'summer';
  return 'autumn';
}

function weatherSummaryFromSignals(signalsWeather = {}) {
  const text = compactText(signalsWeather.summary || '');
  if (text) return text;
  const code = Number(signalsWeather.weather_code);
  if ([61, 63, 65, 80, 81, 82].includes(code)) return 'light rain';
  if ([45, 48].includes(code)) return 'mist';
  if ([1, 2].includes(code)) return 'partly cloudy';
  if ([3].includes(code)) return 'overcast';
  return 'clear';
}

function buildDayContext({ signals = {}, worldFacts = {}, override = {}, nowIso }) {
  const worldProfile = worldFacts.worldProfile || {};
  const location = signals.location || {};
  const weather = signals.weather || {};
  const timezone = override?.location?.timezone
    || location.timezone
    || worldProfile.timezone
    || 'Asia/Shanghai';

  const baseTimestamp = override.timestamp
    || nowIso
    || `${override.date || signals.date || new Date().toISOString().slice(0, 10)}T16:20:00+08:00`;
  const parts = parseLocalDateParts(baseTimestamp, timezone);
  const scheduleMode = compactText(override.scheduleMode || weekdayKindFromParts(parts));
  const routineWindow = compactText(override.forceRoutineWindow || inferRoutineWindow(scheduleMode, parts.hour));
  const currentContext = compactText(override?.location?.currentContext || inferCurrentContext(scheduleMode, routineWindow));

  const weatherSummary = compactText(override?.weather?.summary || weatherSummaryFromSignals(weather));
  const temperatureC = Number(
    override?.weather?.temperatureC
    ?? override?.weather?.temperature_c
    ?? weather.temperature_c
    ?? NaN
  );
  const precipitationMm = Number(
    override?.weather?.precipitationMm
    ?? override?.weather?.precipitation_mm
    ?? weather.precipitation_mm
    ?? 0
  );

  return {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    sourceMode: override.scenarioId ? 'scenario_override' : 'live_signals',
    scenarioId: compactText(override.scenarioId || ''),
    date: {
      isoDate: parts.date,
      weekday: parts.weekday,
      scheduleMode,
      season: seasonTag(Number(parts.date.slice(5, 7)))
    },
    time: {
      timestamp: baseTimestamp,
      timezone,
      localHour: parts.hour,
      localMinute: parts.minute,
      daypart: daypartForHour(parts.hour),
      routineWindow
    },
    weather: {
      summary: weatherSummary,
      bucket: compactText(override?.weather?.bucket || weatherBucket(weatherSummary)),
      temperatureC: Number.isFinite(temperatureC) ? temperatureC : null,
      precipitationMm: Number.isFinite(precipitationMm) ? precipitationMm : null,
      windSpeedKmh: Number(weather.wind_speed_kmh || 0) || null
    },
    location: {
      city: compactText(override?.location?.city || location.name || worldProfile.city || 'Shanghai'),
      locale: compactText(override?.location?.locale || worldProfile.locale || 'zh-CN'),
      timezone,
      currentContext,
      specificPlaceHint: compactText(override?.location?.specificPlaceHint || ''),
      mobilityPhase: /transition|outing|errand/.test(currentContext) ? 'between_places' : 'settled',
      indoorOutdoorBias: /home|school|indoor/.test(currentContext)
        ? 'mostly_indoor'
        : (/errand|outing/.test(currentContext) ? 'mixed' : 'unspecified')
    },
    boundaries: {
      longDistanceTravelLikely: false,
      sameCityAssumed: true,
      largePublicEventAssumed: false
    },
    factualNotes: [
      `Current context: ${currentContext}.`,
      `Weather: ${weatherSummary || 'unknown'}.`,
      `Routine window: ${routineWindow}.`
    ].filter(Boolean),
    overrideNotes: Array.isArray(override.notes)
      ? override.notes.map(item => compactText(item)).filter(Boolean)
      : []
  };
}

module.exports = {
  buildDayContext,
  inferCurrentContext,
  inferRoutineWindow
};
