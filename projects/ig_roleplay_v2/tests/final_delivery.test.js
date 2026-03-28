const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDeliveryReadiness,
  buildFinalDelivery,
  buildImageDiagnosisReportText
} = require('../scripts/lib/final_delivery');

test('buildDeliveryReadiness only marks delivery publishable when caption, local image, and image URL all exist', () => {
  const ready = buildDeliveryReadiness(
    {
      fullCaptionText: 'Rain on the corner shop window.\n#rain #city',
      publish: {
        readiness: 'ready_for_dry_run_or_publish',
        releaseStage: 'image_ready',
        blockers: []
      },
      image: {
        imageUrl: 'https://cdn.example.com/final.jpg'
      }
    },
    {
      localFilePath: 'F:\\runtime\\intermediate\\runs\\sceneplan-1\\generated_assets\\final.jpg',
      imageUrl: 'https://cdn.example.com/final.jpg'
    }
  );

  const missingUrl = buildDeliveryReadiness(
    {
      fullCaptionText: 'Rain on the corner shop window.\n#rain #city',
      publish: {
        readiness: 'ready_for_dry_run_or_publish',
        releaseStage: 'image_ready',
        blockers: []
      }
    },
    {
      localFilePath: 'F:\\runtime\\intermediate\\runs\\sceneplan-1\\generated_assets\\final.jpg',
      imageUrl: ''
    }
  );

  assert.equal(ready.publishable, true);
  assert.equal(ready.hasCaption, true);
  assert.equal(ready.hasLocalImage, true);
  assert.equal(ready.hasImageUrl, true);
  assert.equal(missingUrl.publishable, false);
  assert.equal(missingUrl.hasLocalImage, true);
  assert.equal(missingUrl.hasImageUrl, false);
});

test('buildFinalDelivery carries final publish payload and provider metadata forward', () => {
  const output = buildFinalDelivery({
    config: { version: '3.0.0-alpha.1' },
    deliveryId: 'finaldelivery-1',
    scenePlan: { runId: 'sceneplan-1', lane: 'life_record' },
    selectedCaption: {
      caption: 'Rain on the corner shop window.',
      hashtags: ['#rain', '#city']
    },
    generatedImage: {
      provider: 'aliyun-z-image',
      model: 'z-image-v2',
      localFilePath: 'F:\\runtime\\intermediate\\runs\\sceneplan-1\\generated_assets\\final.jpg',
      imageUrl: 'https://cdn.example.com/final.jpg',
      providerRequestId: 'req-123',
      providerRequest: {
        endpoint: 'https://dashscope.aliyun.com/api/v1/services/aigc/text2image/image-synthesis'
      },
      requestSummary: {
        altText: 'Rain on the corner shop window.'
      }
    },
    momentPackage: {
      livedEvent: {
        summaryZh: '她在整理到一半时，被一个很小的细节留住了半拍。'
      },
      postIntent: {
        whyShareableZh: '因为它够具体，也够轻。'
      },
      outfit: {
        sourceMode: 'persona_policy_default',
        manualOverrideApplied: false,
        outfitSummaryEn: 'soft daily outfit with a light cardigan',
        promptCuesEn: ['light cardigan', 'clean skirt'],
        weatherResponseEn: 'a light layer keeps the outfit comfortable',
        sceneFitEn: 'fits an ordinary lived moment'
      }
    },
    imageRequest: {
      generationMode: 'anime_close_crop_trace_lived_moment',
      reviewSignals: {
        characterPresenceTarget: 'clear_character_presence',
        captureSummaryEn: 'observational camera relation, medium distance',
        renderStyleSummaryEn: 'line clean_crisp',
        unresolvedIdentityReference: true
      }
    },
    validation: {
      stageSources: {
        outfitPlanning: {
          mode: 'llm',
          promptName: 'outfit-resolver-agent',
          error: ''
        }
      }
    },
    postPackage: {
      scenePlanRunId: 'sceneplan-1',
      lane: 'life_record',
      fullCaptionText: 'Rain on the corner shop window.\n#rain #city',
      publish: {
        readiness: 'ready_for_dry_run_or_publish',
        releaseStage: 'image_ready',
        blockers: []
      },
      image: {
        imageUrl: 'https://cdn.example.com/final.jpg'
      }
    },
    publishResult: {
      status: 'dry_run_ready'
    },
    captionTextPath: 'F:\\runtime\\final\\current\\caption.txt',
    imagePath: 'F:\\runtime\\final\\current\\final.jpg',
    sourcePaths: {
      scenePlanPath: 'F:\\runtime\\intermediate\\current\\scene_plan.json',
      selectedMomentPath: 'F:\\runtime\\intermediate\\current\\selected_moment.json',
      momentPackagePath: 'F:\\runtime\\intermediate\\current\\moment_package.json',
      imageRequestPath: 'F:\\runtime\\intermediate\\current\\image_request.json',
      validationPath: 'F:\\runtime\\intermediate\\current\\zero_memory_pipeline_validation.json',
      postPackagePath: 'F:\\runtime\\intermediate\\current\\post_package.json',
      generatedImagePath: 'F:\\runtime\\intermediate\\current\\generated_image.json',
      publishResultPath: 'F:\\runtime\\intermediate\\current\\publish_result.json'
    }
  });

  assert.equal(output.deliveryReadiness.publishable, true);
  assert.equal(output.caption.fullTextPath, 'F:\\runtime\\final\\current\\caption.txt');
  assert.equal(output.image.localFilePath, 'F:\\runtime\\final\\current\\final.jpg');
  assert.equal(output.image.providerEndpoint, 'https://dashscope.aliyun.com/api/v1/services/aigc/text2image/image-synthesis');
  assert.equal(output.publishPayload.caption, 'Rain on the corner shop window.\n#rain #city');
  assert.equal(output.creativeSignals.outfit.applied, true);
  assert.equal(output.creativeSignals.outfit.outfitSummaryEn, 'soft daily outfit with a light cardigan');
  assert.equal(output.creativeSignals.selectedMoment.characterPresenceTarget, 'clear_character_presence');
  assert.equal(output.creativeSignals.stageSources.outfitPlanning.mode, 'llm');
  assert.equal(output.diagnostics.promptToImage.promptSnapshot.positivePrompt, '');
  assert.equal(output.diagnostics.promptToImage.traceBackPaths.scenePlanPath, 'F:\\runtime\\intermediate\\current\\scene_plan.json');
  assert.equal(output.diagnostics.promptToImage.traceBackPaths.selectedMomentPath, 'F:\\runtime\\intermediate\\current\\selected_moment.json');
  assert.equal(output.source.momentPackagePath, 'F:\\runtime\\intermediate\\current\\moment_package.json');
  assert.equal(output.source.scenePlanPath, 'F:\\runtime\\intermediate\\current\\scene_plan.json');
  assert.equal(output.source.selectedMomentPath, 'F:\\runtime\\intermediate\\current\\selected_moment.json');
  assert.equal(output.source.lastKnownPublishStatus, 'dry_run_ready');
});

test('buildImageDiagnosisReportText emits a prompt-to-image comparison surface', () => {
  const delivery = buildFinalDelivery({
    config: { version: '3.0.0-alpha.1' },
    deliveryId: 'finaldelivery-2',
    scenePlan: { runId: 'sceneplan-2', lane: 'life_record' },
    selectedCaption: {
      caption: 'A quiet detour.',
      hashtags: ['#detour']
    },
    generatedImage: {
      provider: 'aliyun-z-image',
      model: 'z-image-turbo',
      localFilePath: 'F:\\runtime\\intermediate\\runs\\sceneplan-2\\generated_assets\\final.png',
      imageUrl: 'https://cdn.example.com/final.png'
    },
    momentPackage: {
      livedEvent: {
        summaryZh: '风把她的袖口掀了一下，她把手收回外套口袋'
      },
      visualEvidence: {
        mustShow: ['overpass railing', 'jacket pocket opening']
      },
      outfit: {
        promptCuesEn: ['light hoodie', 'small red hairclip']
      }
    },
    imageRequest: {
      promptPackage: {
        positivePrompt: 'ShotBlueprint: single-subject same-body shot\nHandBudget: show one readable hand state at her own jacket pocket opening',
        negativePrompt: 'older-looking redesign',
        shotNotes: ['jacket pocket opening', 'overpass railing'],
        structuralShot: {
          poseFamily: 'wind_pocket_recoil'
        }
      },
      reviewSignals: {
        captureSummaryEn: 'single-subject same-body shot',
        shotBlueprintSummaryEn: 'single-subject same-body shot',
        shotBlueprintPoseFamily: 'wind_pocket_recoil',
        shotHandBudgetEn: 'show one readable hand state at her own jacket pocket opening'
      }
    },
    validation: {},
    postPackage: {
      fullCaptionText: 'A quiet detour.\n#detour',
      publish: {
        readiness: 'ready_for_dry_run_or_publish',
        releaseStage: 'image_ready',
        blockers: []
      },
      image: {
        imageUrl: 'https://cdn.example.com/final.png'
      }
    },
    publishResult: {},
    captionTextPath: 'F:\\runtime\\final\\current\\caption.txt',
    imagePath: 'F:\\runtime\\final\\current\\final.png',
    sourcePaths: {
      scenePlanPath: 'F:\\runtime\\intermediate\\current\\scene_plan.json',
      selectedMomentPath: 'F:\\runtime\\intermediate\\current\\selected_moment.json',
      momentPackagePath: 'F:\\runtime\\intermediate\\current\\moment_package.json',
      imageRequestPath: 'F:\\runtime\\intermediate\\current\\image_request.json',
      generatedImagePath: 'F:\\runtime\\intermediate\\current\\generated_image.json'
    }
  });
  delivery.diagnostics.promptToImage.reportPath = 'F:\\runtime\\final\\current\\image_diagnosis.md';

  const report = buildImageDiagnosisReportText(delivery);

  assert.match(report, /Prompt-to-Image Diagnosis/);
  assert.match(report, /Final image: F:\\runtime\\final\\current\\final.png/);
  assert.match(report, /Mandatory questions:/);
  assert.match(report, /HandBudget: show one readable hand state at her own jacket pocket opening/);
  assert.match(report, /scene_plan\.json/);
  assert.match(report, /wind_pocket_recoil/);
});
