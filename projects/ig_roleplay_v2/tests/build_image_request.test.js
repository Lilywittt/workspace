const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildImageRequestOutput,
  buildNegativePrompt,
  buildPromptBlocks
} = require('../scripts/build_image_request');

function makeIdentityProfile() {
  return {
    coreIdentity: {
      apparentAge: 17,
      signatureTraits: ['soft_anime_face', 'youthful_presence', 'small_red_hairclip']
    }
  };
}

function makeReferenceLibrary() {
  return {
    identityAnchors: [
      { id: 'core_face_v1', kind: 'identity', source: 'library/core_face_v1.png' }
    ],
    styleAnchors: [
      { id: 'rainy_window_v1', kind: 'style', source: 'library/rainy_window_v1.png' }
    ]
  };
}

test('buildPromptBlocks encodes anime daily-life constraints for wide scene character trace', () => {
  const scenePlan = {
    lane: 'life_record',
    freshness: {
      weatherSignal: 'Light rain 11C',
      locationName: 'Shanghai'
    },
    visual: {
      presenceMode: 'wide_scene_with_character_trace',
      concreteSceneCues: [
        'Desk cluttered with closed textbooks and a drained mug',
        'Hands gently smoothing the creased sketch paper',
        'Soft, grey daylight from the window illuminating the drawing'
      ],
      sceneNotes: [
        'Prefer environment-led framing shaped by today\'s concrete action, found object, or discovery, not a stock backdrop.'
      ]
    },
    narrative: {
      sensoryFocus: 'moving hair strands, fabric motion, and cool air on the cheek'
    },
    caption: {
      tone: ['gentle', 'daily-life texture']
    }
  };

  const imageBrief = {
    identityControl: {
      allowedVariation: {
        cameraAngle: 'slight handheld perspective'
      },
      requiredTraceCues: [
        'hand_with_phone_or_drink',
        'hair_tip_or_red_hairclip'
      ]
    }
  };

  const selectedCaption = {
    candidateAngle: 'weather_corner'
  };

  const blocks = buildPromptBlocks(scenePlan, imageBrief, selectedCaption, makeIdentityProfile());
  assert.match(blocks.subject, /Japanese anime bishoujo/);
  assert.match(blocks.subject, /present through subtle but readable character traces/);
  assert.match(blocks.scene, /light rain/);
  assert.match(blocks.scene, /Desk cluttered with closed textbooks and a drained mug/);
  assert.doesNotMatch(blocks.scene, /wet pavement reflections/);
  assert.doesNotMatch(blocks.scene, /a cafe window/);
  assert.match(blocks.style, /anime slice-of-life illustration/);
  assert.match(blocks.camera, /wide scene with readable character trace/);
  assert.match(blocks.constraints, /no empty scenery without character presence/);
  assert.match(blocks.constraints, /no text, subtitle, watermark, or UI overlay/);
});

test('buildImageRequestOutput produces stable selfie requests with identity-first review hints', () => {
  const output = buildImageRequestOutput({
    config: { version: '2.0.0-alpha.1' },
    scenePlan: {
      runId: 'sceneplan-selfie-1',
      lane: 'selfie',
      sceneSemantics: {
        sceneProgramId: 'close_mood_capture_program',
        locationArchetype: 'window_seat',
        objectBindings: ['small red hairclip'],
        actionKernel: 'notice_capture_breathe',
        weatherRole: 'texture_modifier',
        emotionalLanding: 'tiny_reset'
      },
      visual: { presenceMode: 'full_selfie', sceneNotes: ['window light'] },
      narrative: { sensoryFocus: 'light, temperature, and the touch of nearby objects' },
      caption: { tone: ['gentle', 'light chunibyo'] },
      publish: { dryRunDefault: true }
    },
    imageBrief: {
      createdAt: '2026-03-18T00:00:00.000Z',
      identityControl: {
        requiredIdentityAnchors: ['core_face_v1'],
        optionalStyleAnchors: ['rainy_window_v1'],
        requiredTraceCues: ['soft_anime_face', 'small_red_hairclip']
      },
      renderHints: {
        aspectRatio: '4:5',
        candidateCount: 4
      },
      negativeDirectives: [
        'Do not add watermarks, on-image text, or platform UI overlays.',
        'No identity drift, no sudden age jump, and no dramatic face-shape changes.'
      ]
    },
    selectedCaption: {
      candidateAngle: 'close selfie'
    },
    identityProfile: makeIdentityProfile(),
    referenceLibrary: makeReferenceLibrary()
  });

  assert.equal(output.generationMode, 'anime_selfie_consistency_guided');
  assert.equal(output.sceneSemantics.sceneProgramId, 'close_mood_capture_program');
  assert.equal(output.renderPlan.consistencyPolicy, 'fixed_identity_references');
  assert.equal(output.publishHints.needsFaceReview, true);
  assert.equal(output.references.length, 2);
  assert.equal(output.references[0].id, 'core_face_v1');
  assert.match(output.promptPackage.positivePrompt, /the same recognizable girl across future runs/);
  assert.match(output.promptPackage.positivePrompt, /preserve the same face shape/);
  assert.match(output.promptPackage.negativePrompt, /identity drift/);
  assert.match(output.promptPackage.negativePrompt, /text/);
});

test('buildNegativePrompt preserves product-level bans even when custom negatives exist', () => {
  const negative = buildNegativePrompt({
    negativeDirectives: [
      'Do not add watermarks, on-image text, or platform UI overlays.',
      'Avoid extra fingers, broken anatomy, duplicate objects, or chaotic clutter.'
    ]
  });

  assert.match(negative, /text/);
  assert.match(negative, /watermark/);
  assert.match(negative, /extra fingers/);
  assert.match(negative, /empty scenery without character trace/);
  assert.match(negative, /photoreal live action/);
});
