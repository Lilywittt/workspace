const test = require('node:test');
const assert = require('node:assert/strict');
const { planPublish } = require('../scripts/lib/publish_post_package');

function makeFinalDelivery(extra = {}) {
  return {
    deliveryId: 'finaldelivery-1',
    scenePlanRunId: 'sceneplan-1',
    image: {
      provider: 'openai-images',
      localFilePath: 'F:\\runtime\\final\\current\\final.jpg',
      imageUrl: 'https://cdn.example.com/final.jpg'
    },
    publishPayload: {
      caption: 'Rain on the corner shop window.\n#rain #city',
      imageUrl: 'https://cdn.example.com/final.jpg',
      altText: 'Rain on the corner shop window.'
    },
    deliveryReadiness: {
      publishable: true,
      readiness: 'ready_for_dry_run_or_publish',
      releaseStage: 'image_ready',
      blockers: []
    },
    ...extra
  };
}

test('planPublish blocks dry runs when there is no final image URL', () => {
  const result = planPublish({
    config: { version: '2.0.0-alpha.1' },
    finalDelivery: makeFinalDelivery({
      image: { provider: 'openai-images', localFilePath: 'F:\\runtime\\final\\current\\final.jpg', imageUrl: '' },
      publishPayload: {
        caption: 'Rain on the corner shop window.\n#rain #city',
        imageUrl: '',
        altText: 'Rain on the corner shop window.'
      },
      deliveryReadiness: {
        publishable: false,
        readiness: 'caption_ready_image_generation_pending',
        releaseStage: 'image_request_ready',
        blockers: ['generated_image_missing']
      }
    }),
    args: { flags: new Set(['dry-run']) },
    env: {}
  });

  assert.equal(result.shouldPublish, false);
  assert.equal(result.output.status, 'dry_run_blocked_final_delivery_not_publishable');
  assert.equal(result.output.publishTarget.mode, 'dry_run');
  assert.match(result.output.notes.join(' '), /caption_ready_image_generation_pending/);
});

test('planPublish marks dry run ready when the package has an image URL', () => {
  const result = planPublish({
    config: { version: '2.0.0-alpha.1' },
    finalDelivery: makeFinalDelivery(),
    args: { flags: new Set(['dry-run']) },
    env: {}
  });

  assert.equal(result.shouldPublish, false);
  assert.equal(result.output.status, 'dry_run_ready');
  assert.equal(result.output.publishTarget.graphApiBase, 'https://graph.facebook.com/v19.0');
});

test('planPublish blocks live publish when credentials are missing', () => {
  const result = planPublish({
    config: { version: '2.0.0-alpha.1' },
    finalDelivery: makeFinalDelivery(),
    args: { flags: new Set(['force-live']) },
    env: { IG_PUBLISH_ENABLED: 'true' }
  });

  assert.equal(result.shouldPublish, false);
  assert.equal(result.output.status, 'blocked_missing_credentials');
  assert.equal(result.output.publishTarget.mode, 'live_publish');
});

test('planPublish carries provider metadata into the publish target', () => {
  const result = planPublish({
    config: { version: '2.0.0-alpha.1' },
    finalDelivery: makeFinalDelivery({
      image: {
        provider: 'openai-images',
        localFilePath: 'F:\\runtime\\final\\current\\final.jpg',
        imageUrl: 'https://cdn.example.com/final.jpg',
        providerEndpoint: '/v1/images'
      },
      deliveryReadiness: {
        publishable: true,
        readiness: 'ready_for_dry_run_or_publish',
        releaseStage: 'image_ready',
        blockers: []
      }
    }),
    args: { flags: new Set(['dry-run']) },
    env: {}
  });

  assert.equal(result.output.publishTarget.provider, 'openai-images');
  assert.equal(result.output.publishTarget.providerEndpoint, '/v1/images');
  assert.equal(result.output.releaseStage, 'image_ready');
});
