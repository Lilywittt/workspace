const test = require('node:test');
const assert = require('node:assert/strict');
const { buildImageRequest } = require('../src/agent/compat');

test('buildImageRequest keeps trace-led moments composition-flexible without reintroducing rigid visibility bans', () => {
  const output = buildImageRequest({
    config: {
      version: '3.0.0-alpha.1',
      image: {
        aspectRatio: '4:5',
        candidateCount: 1
      }
    },
    policy: {},
    scenePlan: {
      runId: 'zeromemory-test-run',
      lane: 'life_record'
    },
    momentPackage: {
      livedEvent: {
        summaryZh: 'after class she pauses while putting away a headphone cord'
      },
      groundingContext: {
        currentContext: 'school_transition_window',
        routineWindow: 'after_class',
        weather: 'light rain',
        activeExternalEventIds: ['school_corridor_notice_refresh'],
        externalEventFacts: [
          'The stairwell landing now has a nearby noticeboard with freshly pinned paper edges.'
        ]
      },
      postIntent: {
        characterPresenceTarget: 'clear_character_presence',
        characterPresenceGuidanceEn: 'the protagonist should be clearly readable in the frame through face, posture, or fuller-body action while the lived event stays primary'
      },
      captureIntent: {
        summaryEn: 'observational camera relation, medium distance, partial body coverage, glimpse face readability, balanced environment weight',
        guidanceEn: [
          'the frame should feel witnessed from the outside, not automatically self-held'
        ]
      },
      outfit: {
        outfitSummaryEn: 'fresh youthful rainy after-class outfit with a light cardigan and clean pleated skirt',
        silhouetteEn: 'light layered school-age casual silhouette',
        promptCuesEn: [
          'light knit cardigan',
          'simple pale inner top',
          'clean pleated skirt',
          'dark knee socks',
          'clean everyday sneakers'
        ],
        materialColorCuesEn: [
          'soft cool-neutral palette with a tiny red accent'
        ],
        accessoryNotesEn: [
          'a small practical bag or cuff detail may stay visible in motion'
        ],
        bodyReadAnchorsEn: [
          'petite early-teen proportions',
          'soft youthful body line'
        ],
        presenceReadAnchorsEn: [
          'quiet observant presence',
          'fresh everyday innocence'
        ]
      },
      visualEvidence: {
        mustShow: ['the small object in her hand'],
        mustAvoid: ['generic aesthetic wallpaper']
      }
    },
    imageIntent: {
      characterPresenceTarget: 'clear_character_presence',
      characterPresencePlanEn: 'the protagonist should be clearly readable in the frame through face, posture, or fuller-body action while the lived event stays primary',
      cameraRelation: 'self_held',
      faceReadability: 'readable',
      bodyCoverage: 'half',
      distance: 'close',
      environmentWeight: 'balanced',
      captureSummaryEn: 'self_held camera relation, close distance, half body coverage, readable face readability, balanced environment weight',
      captureGuidanceEn: [
        'a self-held perspective is allowed when it still belongs to the same lived moment'
      ],
      mustShowEn: [
        'one hand touching a slightly soft fruit candy in a pocket',
        'headphone cord neatly coiled and placed into the pocket'
      ],
      mustShowZh: [
        'the fingertip touches the softened candy'
      ],
      mustAvoidEn: [
        'full face portrait',
        'full body standing pose',
        'multiple hands in frame'
      ],
      mustAvoidZh: [
        'rigid portrait-only composition'
      ],
      framingEn: 'close crop of one hand pausing on a soft fruit candy in a pocket, face out of frame',
      atmosphereZh: 'a real ordinary moment left in passing',
      altTextZh: 'after class she pauses while putting away a headphone cord'
    },
    imageStyleProfile: {
      styleSummaryEn: 'line clean_crisp, contrast controlled_clear, color richness balanced_rich, color separation clear_local, edge readability clear_edges, depth separation layered_depth',
      styleDimensionPositiveEn: [
        'clean crisp anime linework',
        'controlled clear contrast',
        'balanced color richness',
        'clear local color separation',
        'clear clothing seam and object edge readability',
        'layered subject-background separation'
      ],
      styleDimensionNegativeEn: [
        'blurry linework',
        'washed out contrast',
        'flat fabric rendering'
      ],
      stylePositiveEn: [
        'anime daily-life rendering with stable local color blocks'
      ],
      styleNegativeEn: [
        'muddy clothing colors'
      ],
      guardrailsEn: [
        'adjust rendering craft only',
        'do not change character identity, props, actions, setting, story event, or camera framing'
      ]
    },
    characterProfile: {
      identity: {
        apparentAge: 13
      },
      identityAnchors: {
        immutableTraits: [],
        visiblePromptAnchorsEn: []
      },
      visual: {
        requiredIdentityAnchors: ['rion_core_face_01'],
        identityPromptBaseEn: [
          'same recurring girl character',
          'middle-school age impression'
        ],
        lifeRecordIdentityAnchorsEn: [
          'keep the same recurring girl-character identity even in action-led daily-life framing'
        ],
        clearPresenceIdentityAnchorsEn: [
          'clear character presence must strengthen recognition of the same girl, not replace her with a generic anime lead'
        ],
        framingPrinciplesEn: [
          'life_record may be trace-led, face-visible, half-body, or fuller-body when the same moment supports it'
        ],
        styleAnchors: []
      }
    },
    referenceLibrary: {
      identityAnchors: [
        {
          id: 'rion_core_face_01',
          kind: 'identity',
          status: 'placeholder',
          source: 'manual_curation_required',
          notes: 'Placeholder only'
        }
      ],
      styleAnchors: []
    }
  });

  assert.match(output.promptPackage.positivePrompt, /action-led lived-moment framing/);
  assert.match(output.promptPackage.positivePrompt, /CharacterPresence: clear_character_presence/);
  assert.match(output.promptPackage.positivePrompt, /CapturePlan:/);
  assert.match(output.promptPackage.positivePrompt, /self_held camera relation/);
  assert.match(output.promptPackage.positivePrompt, /IdentityLock:/);
  assert.match(output.promptPackage.positivePrompt, /same recurring girl character/);
  assert.match(output.promptPackage.positivePrompt, /clear character presence must strengthen recognition of the same girl/);
  assert.match(output.promptPackage.positivePrompt, /the protagonist should be clearly readable in the frame/);
  assert.match(output.promptPackage.positivePrompt, /life_record may be trace-led, face-visible, half-body, or fuller-body/);
  assert.match(output.promptPackage.positivePrompt, /Outfit:/);
  assert.match(output.promptPackage.positivePrompt, /light knit cardigan/);
  assert.match(output.promptPackage.positivePrompt, /petite early-teen proportions/);
  assert.match(output.promptPackage.positivePrompt, /moment-first composition/);
  assert.match(output.promptPackage.positivePrompt, /freshly pinned paper edges/);
  assert.match(output.promptPackage.positivePrompt, /RenderStyleSummary:/);
  assert.match(output.promptPackage.positivePrompt, /line clean_crisp/);
  assert.match(output.promptPackage.positivePrompt, /RenderStyle: clean crisp anime linework/);
  assert.match(output.promptPackage.positivePrompt, /RenderGuardrails: adjust rendering craft only/);
  assert.match(output.promptPackage.negativePrompt, /bright outdoor meadow/);
  assert.match(output.promptPackage.negativePrompt, /washed out contrast/);
  assert.match(output.promptPackage.negativePrompt, /muddy clothing colors/);

  assert.doesNotMatch(output.promptPackage.positivePrompt, /face out of frame/i);
  assert.doesNotMatch(output.promptPackage.positivePrompt, /body mostly out of frame/i);
  assert.doesNotMatch(output.promptPackage.positivePrompt, /one hand only/i);
  assert.doesNotMatch(output.promptPackage.negativePrompt, /generic anime boy redesign/i);
  assert.doesNotMatch(output.promptPackage.negativePrompt, /older-looking redesign/i);
  assert.doesNotMatch(output.promptPackage.negativePrompt, /full face portrait/i);
  assert.doesNotMatch(output.promptPackage.negativePrompt, /full body standing pose/i);
  assert.doesNotMatch(output.promptPackage.negativePrompt, /multiple hands/i);
  assert.deepEqual(output.referencePlan.placeholderReferenceIds, ['rion_core_face_01']);
  assert.equal(output.publishHints.needsIdentityReview, true);
});
