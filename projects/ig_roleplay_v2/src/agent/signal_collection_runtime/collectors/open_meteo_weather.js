const {
  aqiBand,
  buildHealthRecord,
  compactText,
  fetchJson,
  uniqueStrings,
  weatherSummary
} = require('../shared');

async function resolveCoordinates(source, runtimeContext, fetchImpl) {
  if (runtimeContext.location.latitude && runtimeContext.location.longitude) {
    return {
      latitude: runtimeContext.location.latitude,
      longitude: runtimeContext.location.longitude,
      timezone: runtimeContext.location.timezone,
      resolvedName: runtimeContext.location.name
    };
  }

  if (!runtimeContext.location.name) {
    throw new Error('Missing location name for geocoding');
  }

  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(runtimeContext.location.name)}&count=1&language=${encodeURIComponent(runtimeContext.location.language)}&format=json`;
  const geoJson = await fetchJson(fetchImpl, geoUrl, {
    timeoutMs: source.timeoutMs
  });
  const hit = Array.isArray(geoJson?.results) ? geoJson.results[0] : null;
  if (!hit) {
    throw new Error('No geocoding result');
  }

  return {
    latitude: Number(hit.latitude || 0) || null,
    longitude: Number(hit.longitude || 0) || null,
    timezone: compactText(hit.timezone || runtimeContext.location.timezone),
    resolvedName: compactText(runtimeContext.location.name || hit.name || '')
  };
}

async function collect(source, runtimeContext, fetchImpl) {
  const startedAt = Date.now();
  const coordinates = await resolveCoordinates(source, runtimeContext, fetchImpl);
  const currentVariables = (source.current || [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'precipitation',
    'weather_code',
    'wind_speed_10m',
    'cloud_cover'
  ]).join(',');

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=${encodeURIComponent(currentVariables)}&timezone=${encodeURIComponent(coordinates.timezone)}`;
  const weatherJson = await fetchJson(fetchImpl, weatherUrl, {
    timeoutMs: source.timeoutMs
  });
  const current = weatherJson.current || {};

  let airQuality = null;
  const externalSignals = [];
  if (Array.isArray(source.airQualityCurrent) && source.airQualityCurrent.length > 0) {
    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=${encodeURIComponent(source.airQualityCurrent.join(','))}&timezone=${encodeURIComponent(coordinates.timezone)}`;
    try {
      const airJson = await fetchJson(fetchImpl, aqUrl, {
        timeoutMs: source.timeoutMs
      });
      const airCurrent = airJson.current || {};
      airQuality = {
        pm10: airCurrent.pm10 ?? null,
        pm2_5: airCurrent.pm2_5 ?? null,
        us_aqi: airCurrent.us_aqi ?? null,
        uv_index: airCurrent.uv_index ?? null,
        band: aqiBand(airCurrent.us_aqi)
      };

      if (Number.isFinite(Number(airCurrent.us_aqi))) {
        externalSignals.push({
          signalId: `aqi_${runtimeContext.date}`,
          category: 'weather',
          text: `The air quality in ${coordinates.resolvedName || runtimeContext.location.name} is reading around US AQI ${Math.round(Number(airCurrent.us_aqi))} today.`,
          freshness: 'current',
          directiveness: 'low',
          sourceType: 'signals',
          priorityWeight: source.priorityWeight,
          tags: uniqueStrings([
            'air_quality',
            airQuality.band
          ], 4)
        });
      }
    } catch (err) {
      airQuality = {
        error: `air_quality_fetch_failed: ${err.message}`
      };
    }
  }

  return {
    resolvedLocation: {
      name: coordinates.resolvedName || runtimeContext.location.name,
      country: runtimeContext.location.country || null,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      timezone: coordinates.timezone
    },
    weather: {
      temperature_c: current.temperature_2m ?? null,
      apparent_temperature_c: current.apparent_temperature ?? null,
      relative_humidity: current.relative_humidity_2m ?? null,
      weather_code: current.weather_code ?? null,
      wind_speed_kmh: current.wind_speed_10m ?? null,
      precipitation_mm: current.precipitation ?? null,
      cloud_cover: current.cloud_cover ?? null,
      summary: weatherSummary(current.weather_code)
    },
    airQuality,
    externalSignals,
    sourceHealth: [buildHealthRecord({
      sourceId: source.id,
      kind: source.kind,
      sourceLabel: source.sourceLabel,
      status: 'ok',
      itemCount: 1 + externalSignals.length,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      categories: ['weather'],
      note: 'Current weather refreshed successfully.'
    })]
  };
}

module.exports = {
  collect,
  kind: 'open_meteo_weather'
};
