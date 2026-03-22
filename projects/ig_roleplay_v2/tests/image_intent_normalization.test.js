const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeImageIntent } = require('../src/agent/validators');

test('normalizeImageIntent removes placeholder evidence, keeps presence target explicit, and falls back to the lived moment summary for alt text', () => {
  const output = normalizeImageIntent({
    mustShowZh: ['the action that proves the moment happened'],
    mustShowEn: ['the action or evidence that proves the moment happened'],
    mayShowZh: ['ordinary context from the same moment'],
    mayShowEn: ['additional ordinary context from the same moment'],
    altTextZh: 'an ordinary daily moment'
  }, {
    momentPackage: {
      lane: 'life_record',
      postIntent: {
        characterPresenceTarget: 'clear_character_presence',
        characterPresenceGuidanceEn: 'the protagonist should be clearly readable in the frame through face, posture, or fuller-body action while the lived event stays primary'
      },
      livedEvent: {
        summaryZh: 'she notices a forgotten receipt while putting away her umbrella'
      }
    },
    contentIntent: {
      characterPresenceTarget: 'clear_character_presence',
      guidanceEn: 'the protagonist should be clearly readable in the frame through face, posture, or fuller-body action while the lived event stays primary'
    },
    policy: {
      image: {
        mustAvoid: []
      }
    },
    profile: {
      visual: {
        faceVisibilityRules: {
          life_record: 'optional_moment_led'
        },
        framingPrinciplesEn: [
          'let framing scale follow the lived moment instead of a fixed crop template'
        ]
      },
      postingBehavior: {
        characterPresencePolicy: {
          allowedTargets: [
            'trace_only',
            'supporting_presence',
            'clear_character_presence',
            'expression_led'
          ],
          defaultTarget: 'supporting_presence'
        }
      }
    },
    captureIntent: {
      resolvedTarget: {
        cameraRelation: 'self_held',
        faceReadability: 'readable',
        bodyCoverage: 'half',
        distance: 'close',
        environmentWeight: 'balanced'
      },
      allowances: {
        cameraRelation: ['observational', 'self_held'],
        faceReadability: ['glimpse', 'readable'],
        bodyCoverage: ['partial', 'half'],
        distance: ['close', 'medium'],
        environmentWeight: ['balanced', 'high']
      },
      guidanceEn: [
        'a self-held perspective is allowed when it still belongs to the same lived moment'
      ]
    }
  });

  assert.deepEqual(output.mustShowZh, []);
  assert.deepEqual(output.mustShowEn, []);
  assert.deepEqual(output.mayShowZh, []);
  assert.deepEqual(output.mayShowEn, []);
  assert.equal(output.faceVisibility, 'optional');
  assert.equal(output.characterPresenceTarget, 'clear_character_presence');
  assert.equal(output.cameraRelation, 'self_held');
  assert.equal(output.faceReadability, 'readable');
  assert.equal(output.bodyCoverage, 'half');
  assert.equal(output.distance, 'close');
  assert.equal(output.environmentWeight, 'balanced');
  assert.match(output.captureSummaryEn, /self_held camera relation/);
  assert.match(output.captureGuidanceEn[0], /self-held perspective/);
  assert.match(output.characterPresencePlanEn, /clearly readable in the frame/);
  assert.equal(output.altTextZh, 'she notices a forgotten receipt while putting away her umbrella');
  assert.match(output.framingEn, /let framing scale follow the lived moment/);
  assert.match(output.framingEn, /self_held camera relation/);
});
