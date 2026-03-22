const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAffordancePool,
  buildWorldStateSnapshot,
  deriveDaypart,
  deriveMobilityWindow,
  deriveTemperatureBand,
  deriveWeekdayMode
} = require('../scripts/lib/world_state');

test('world state helpers derive typed time and mobility values', () => {
  assert.equal(deriveDaypart(19, {
    dayparts: [
      { id: 'afternoon', startHour: 14, endHour: 17 },
      { id: 'early_evening', startHour: 17, endHour: 20 }
    ]
  }), 'early_evening');
  assert.equal(deriveWeekdayMode('2026-03-19', {
    weekdayModes: {
      weekendDays: [0, 6],
      schoolDayLabel: 'school_day',
      weekendLabel: 'weekend'
    }
  }), 'school_day');
  assert.equal(deriveTemperatureBand(12, {
    temperatureBands: [
      { id: 'cold', max: 7 },
      { id: 'cool', max: 14 }
    ]
  }), 'cool');
  assert.equal(deriveMobilityWindow(63, 11, 9, {
    mobilityWindows: [
      { id: 'indoor_preferred', weatherCodes: [63], windAbove: 20, temperatureMax: 99 }
    ]
  }), 'indoor_preferred');
});

test('buildWorldStateSnapshot and buildAffordancePool produce typed state and affordances', () => {
  const worldState = buildWorldStateSnapshot({
    config: { version: '2.0.0-alpha.1', planner: { primaryLane: 'selfie' } },
    settingModel: {
      worldProfile: { city: 'Shanghai', timezone: 'Asia/Shanghai' },
      routineAnchors: {
        school_day: ['after_class_reset'],
        rainy_day: ['indoor_reset']
      },
      ownedObjectPools: {
        accessory: ['small red hairclip'],
        keepsake: ['bookmark']
      },
      placeArchetypes: {
        indoor_desk_corner: { kind: 'indoor' },
        bookstore_aisle: { kind: 'public_indoor' }
      }
    },
    rules: {
      dayparts: [{ id: 'afternoon', startHour: 0, endHour: 24 }],
      weekdayModes: { weekendDays: [0, 6], schoolDayLabel: 'school_day', weekendLabel: 'weekend' },
      seasonPhaseByMonth: { '3': 'early_spring' },
      temperatureBands: [{ id: 'cool', max: 14 }, { id: 'mild', max: 23 }],
      mobilityWindows: [{ id: 'indoor_preferred', weatherCodes: [63], windAbove: 20, temperatureMax: 99 }],
      energyHeuristics: { daypartBase: { afternoon: 'medium_low' } },
      socialBandwidthByLane: { life_record: 'solo_preferred' },
      weatherRolePolicies: { rainCodes: [63], stormCodes: [], fogCodes: [], snowCodes: [] },
      needStateRules: { life_record: ['small_reset', 'private_meaning'] }
    },
    signals: {
      date: '2026-03-19',
      location: { name: 'Shanghai' },
      weather: { weather_code: 63, summary: 'light rain', temperature_c: 11, wind_speed_kmh: 9 }
    },
    continuitySnapshot: {
      recommendation: { preferredLane: 'life_record', reason: 'switch away from selfie streak' }
    },
    noveltyLedger: {
      dominance: { sceneClusters: [{ value: 'indoor_reset', count: 3 }], objectFamilies: [{ value: 'stationery', count: 3 }] },
      fatigueFlags: { weatherPrimaryOveruse: true, indoorClusterOveruse: true, studyAftermathClusterOveruse: false },
      suggestions: { coolDownScenePrograms: ['desk_reset_program'] },
      counts: { emotionalLanding: [{ value: 'tiny_reset', count: 2 }] }
    },
    reflectionNotes: {
      recurringObjects: ['bookmark'],
      familiarPlaces: ['bookstore_aisle'],
      stableEmotionalLandings: ['tiny_reset']
    },
    identityProfile: {
      coreIdentity: { temperament: ['gentle'] },
      creativeGuidance: { sceneBiasZh: ['普通物件带一点私密意义'], avoidPatternsZh: ['不要固定收尾'] }
    }
  });

  assert.equal(worldState.characterState.lanePreference, 'life_record');
  assert.equal(worldState.environment.mobilityWindow, 'indoor_preferred');
  assert.ok(worldState.continuityPressure.weatherOveruse);
  assert.match(worldState.continuityPressure.reason, /switch away/);

  const affordancePool = buildAffordancePool(worldState, {
    placeArchetypes: {
      indoor_desk_corner: { kind: 'indoor' },
      bookstore_aisle: { kind: 'public_indoor' }
    }
  });

  assert.ok(affordancePool.affordances.some(item => item.id === 'indoor_reset_window'));
  assert.ok(affordancePool.affordances.some(item => item.id === 'bookstore_pause_window'));
  assert.ok(Array.isArray(affordancePool.primaryAffordanceIds));
});
