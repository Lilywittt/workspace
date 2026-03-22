const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOutfitIntent } = require('../src/agent/outfit_intent');
const { normalizeOutfitPlan } = require('../src/agent/validators');

test('buildOutfitIntent reads manual scenario override from contentIntent', () => {
  const output = buildOutfitIntent({
    characterProfile: {
      clothing: {
        everydayMoodEn: 'fresh youthful everyday charm',
        laneTendencies: {
          life_record: {
            vibeEn: 'ordinary lived-in charm led by action and environment'
          }
        }
      }
    },
    dayContext: {
      weather: { summary: 'light rain' },
      time: { routineWindow: 'after_class' },
      location: { currentContext: 'school_transition_window' }
    },
    selectedMoment: {
      lane: 'life_record',
      eventSummaryZh: 'She pauses after class for one tiny detail.'
    },
    contentIntent: {
      lane: 'life_record'
    },
    scenario: {
      contentIntent: {
        outfitIntent: {
          directionEn: 'slightly tidier rainy after-class layering',
          mustIncludeEn: ['light cardigan layer'],
          preferEn: ['soft cool-neutral palette'],
          notesZh: ['manual rainy-day override']
        }
      }
    }
  });

  assert.equal(output.sourceMode, 'scenario_override');
  assert.equal(output.manualOverrideProvided, true);
  assert.equal(output.directionEn, 'slightly tidier rainy after-class layering');
  assert.deepEqual(output.mustIncludeEn, ['light cardigan layer']);
  assert.deepEqual(output.preferEn, ['soft cool-neutral palette']);
});

test('normalizeOutfitPlan keeps only positive prompt-ready clothing cues', () => {
  const output = normalizeOutfitPlan({
    outfitSummaryEn: 'fresh youthful rainy after-class outfit',
    upperGarmentEn: 'simple pale inner top',
    outerLayerEn: 'light knit cardigan',
    lowerGarmentEn: 'clean pleated skirt',
    footwearEn: 'clean everyday sneakers',
    promptCuesEn: [
      'light knit cardigan',
      'simple pale inner top',
      'avoid adult officewear',
      'do not use a heavy winter coat'
    ],
    materialColorCuesEn: [
      'soft cool-neutral palette with a tiny red accent'
    ]
  }, {
    profile: {
      clothing: {
        bodyReadAnchorsEn: ['petite early-teen proportions'],
        presenceReadAnchorsEn: ['fresh everyday innocence'],
        everydayMoodEn: 'fresh youthful everyday charm',
        silhouetteTendenciesEn: ['light layered school-age casual silhouette'],
        laneTendencies: {
          life_record: {
            vibeEn: 'ordinary lived-in charm led by action and environment'
          }
        }
      }
    },
    outfitIntent: {
      lane: 'life_record',
      sourceMode: 'scenario_override',
      manualOverrideProvided: true,
      notesZh: ['keep it natural']
    },
    dayContext: {
      weather: { summary: 'light rain' },
      location: { currentContext: 'school_transition_window' }
    },
    selectedMoment: {
      lane: 'life_record'
    },
    contentIntent: {
      lane: 'life_record'
    }
  });

  assert.equal(output.sourceMode, 'scenario_override');
  assert.equal(output.manualOverrideApplied, true);
  assert.deepEqual(output.promptCuesEn, [
    'light knit cardigan',
    'simple pale inner top'
  ]);
  assert.deepEqual(output.bodyReadAnchorsEn, ['petite early-teen proportions']);
  assert.deepEqual(output.presenceReadAnchorsEn, ['fresh everyday innocence']);
  assert.match(output.weatherResponseEn, /weather-aware|light rain/i);
});
