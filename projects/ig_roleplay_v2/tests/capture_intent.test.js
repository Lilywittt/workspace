const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCaptureIntent } = require('../src/agent/capture_intent');

test('buildCaptureIntent keeps capture policy separate from activity semantics and allows scenario-level framing overrides', () => {
  const characterProfile = {
    postingBehavior: {
      defaultPreferredLane: 'life_record',
      capturePolicy: {
        laneDefaults: {
          life_record: {
            cameraRelation: 'observational',
            faceReadability: 'glimpse',
            bodyCoverage: 'partial',
            distance: 'medium',
            environmentWeight: 'balanced'
          }
        },
        laneAllowances: {
          life_record: {
            cameraRelation: ['observational', 'self_held', 'ambiguous'],
            faceReadability: ['glimpse', 'readable'],
            bodyCoverage: ['partial', 'half', 'full'],
            distance: ['close', 'medium', 'wide'],
            environmentWeight: ['balanced', 'high']
          }
        }
      }
    }
  };

  const laneDefault = buildCaptureIntent({
    characterProfile,
    characterRuntime: {
      postingTendency: {
        preferredLane: 'life_record'
      }
    },
    contentIntent: {
      lane: 'life_record'
    },
    scenario: {}
  });

  assert.equal(laneDefault.sourceMode, 'persona_lane_default');
  assert.equal(laneDefault.resolvedTarget.cameraRelation, 'observational');
  assert.equal(laneDefault.resolvedTarget.distance, 'medium');
  assert.deepEqual(laneDefault.allowances.cameraRelation, ['observational', 'self_held', 'ambiguous']);

  const scenarioOverride = buildCaptureIntent({
    characterProfile,
    characterRuntime: {
      postingTendency: {
        preferredLane: 'life_record'
      }
    },
    contentIntent: {
      lane: 'life_record'
    },
    scenario: {
      contentIntent: {
        captureIntent: {
          cameraRelation: 'self_held',
          distance: 'close',
          faceReadability: 'readable'
        }
      }
    }
  });

  assert.equal(scenarioOverride.sourceMode, 'scenario_override');
  assert.equal(scenarioOverride.resolvedTarget.cameraRelation, 'self_held');
  assert.equal(scenarioOverride.resolvedTarget.distance, 'close');
  assert.equal(scenarioOverride.resolvedTarget.faceReadability, 'readable');
  assert.match(scenarioOverride.summaryEn, /self_held camera relation/);
});
