const test = require('node:test');
const assert = require('node:assert/strict');
const { buildContentIntent } = require('../src/agent/content_intent');

test('buildContentIntent resolves persona lane defaults and scenario override targets explicitly', () => {
  const baseProfile = {
    postingBehavior: {
      defaultPreferredLane: 'life_record',
      laneRules: {
        selfie: {
          characterPresenceTarget: 'expression_led'
        },
        life_record: {
          characterPresenceTarget: 'supporting_presence'
        }
      },
      characterPresencePolicy: {
        defaultTarget: 'supporting_presence',
        allowedTargets: [
          'trace_only',
          'supporting_presence',
          'clear_character_presence',
          'expression_led'
        ],
        targetGuidanceEn: {
          clear_character_presence: 'the protagonist should be clearly readable in the frame through face, posture, or fuller-body action while the lived event stays primary'
        }
      }
    }
  };

  const laneDefault = buildContentIntent({
    characterProfile: baseProfile,
    characterRuntime: {
      postingTendency: {
        preferredLane: 'life_record'
      }
    },
    scenario: {}
  });
  assert.equal(laneDefault.characterPresenceTarget, 'supporting_presence');
  assert.equal(laneDefault.sourceMode, 'persona_lane_default');

  const scenarioOverride = buildContentIntent({
    characterProfile: baseProfile,
    characterRuntime: {
      postingTendency: {
        preferredLane: 'life_record'
      }
    },
    scenario: {
      contentIntent: {
        characterPresenceTarget: 'clear_character_presence'
      }
    }
  });
  assert.equal(scenarioOverride.characterPresenceTarget, 'clear_character_presence');
  assert.equal(scenarioOverride.sourceMode, 'scenario_override');
  assert.match(scenarioOverride.guidanceEn, /clearly readable in the frame/);
});
