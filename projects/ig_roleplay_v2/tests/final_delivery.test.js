const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDeliveryReadiness,
  buildFinalDelivery
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
      localFilePath: 'F:\\runtime\\intermediate\\generated\\history\\final.jpg',
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
      localFilePath: 'F:\\runtime\\intermediate\\generated\\history\\final.jpg',
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
      localFilePath: 'F:\\runtime\\intermediate\\generated\\history\\final.jpg',
      imageUrl: 'https://cdn.example.com/final.jpg',
      providerRequestId: 'req-123',
      providerRequest: {
        endpoint: 'https://dashscope.aliyun.com/api/v1/services/aigc/text2image/image-synthesis'
      },
      requestSummary: {
        altText: 'Rain on the corner shop window.'
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
  assert.equal(output.source.lastKnownPublishStatus, 'dry_run_ready');
});
