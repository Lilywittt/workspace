const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPostPackage } = require('../scripts/lib/post_package');

function makeBaseInputs(extra = {}) {
  return {
    config: { version: '2.0.0-alpha.1' },
    scenePlan: { runId: 'sceneplan-1', lane: 'life_record' },
    selectedCaption: {
      caption: 'Rain on the corner shop window.',
      hashtags: ['#rain', '#city'],
      selectedCandidateId: 'cand_1',
      candidatePlanSlot: 'caption_02',
      candidatePostingAct: 'world_facing_reaction',
      selectionReason: 'top score'
    },
    imageRequest: null,
    generatedImage: null,
    ...extra
  };
}

test('buildPostPackage prefers a ready V2 generated image', () => {
  const output = buildPostPackage(makeBaseInputs({
    generatedImage: {
      provider: 'openai-images',
      status: 'image_ready',
      imageUrl: 'https://cdn.example.com/final.jpg',
      assetId: 'asset_1'
    }
  }));

  assert.equal(output.image.source, 'v2_generated_image');
  assert.equal(output.publish.readiness, 'ready_for_dry_run_or_publish');
  assert.equal(output.publish.releaseStage, 'image_ready');
  assert.equal(output.image.imageUrl, 'https://cdn.example.com/final.jpg');
  assert.equal(output.image.altText, '');
  assert.equal(output.captionSource.candidatePlanSlot, 'caption_02');
  assert.equal(output.captionSource.candidatePostingAct, 'world_facing_reaction');
  assert.deepEqual(output.publish.releaseChecklist, ['caption_selected', 'image_ready', 'alt_text_missing', 'image_provider_attached']);
  assert.deepEqual(output.publish.blockers, []);
});

test('buildPostPackage keeps publish blocked while generation is only submitted', () => {
  const output = buildPostPackage(makeBaseInputs({
    generatedImage: {
      provider: 'openai-images',
      status: 'generation_submitted',
      remoteJobId: 'job_123',
      imageUrl: '',
      requestSummary: { altText: 'Rainy corner' },
      providerRequest: { submissionMode: 'submitted_or_resumed', assetFilenameHint: 'sceneplan-1-openai-images.jpg' }
    }
  }));

  assert.equal(output.image.source, 'v2_generated_image_job');
  assert.equal(output.publish.readiness, 'caption_ready_image_generation_in_progress');
  assert.equal(output.publish.releaseStage, 'waiting_for_generated_image');
  assert.equal(output.image.remoteJobId, 'job_123');
  assert.equal(output.image.altText, 'Rainy corner');
  assert.equal(output.image.assetFilenameHint, 'sceneplan-1-openai-images.jpg');
  assert.deepEqual(output.publish.blockers, ['generated_image_pending_remote_result']);
  assert.deepEqual(output.publish.releaseChecklist, ['caption_selected', 'image_pending', 'alt_text_ready', 'image_provider_attached', 'image_job_tracked']);
});

test('buildPostPackage marks local generated images as not yet publishable without a public URL', () => {
  const output = buildPostPackage(makeBaseInputs({
    generatedImage: {
      provider: 'openai-images',
      status: 'image_generated_local_only',
      imageUrl: '',
      localFilePath: '/tmp/runtime/intermediate/runs/sceneplan-1/generated_assets/example.png',
      latestFilePath: '',
      requestSummary: { altText: 'Rainy street corner' },
      providerRequest: { endpoint: 'https://api.openai.com/v1/images/generations' }
    }
  }));

  assert.equal(output.image.source, 'v2_generated_image_local');
  assert.equal(output.publish.readiness, 'local_image_ready_public_url_missing');
  assert.equal(output.publish.releaseStage, 'local_image_ready');
  assert.equal(output.image.localFilePath, '/tmp/runtime/intermediate/runs/sceneplan-1/generated_assets/example.png');
  assert.equal(output.image.altText, 'Rainy street corner');
  assert.deepEqual(output.publish.blockers, ['generated_image_public_url_missing']);
});

test('buildPostPackage falls back to image_request when no generated image artifact exists', () => {
  const output = buildPostPackage(makeBaseInputs({
    imageRequest: {
      generationMode: 'scene_grounded_daily_record',
      status: 'generation_request_ready',
      references: [{ id: 'legacy_daily_style_001' }],
      renderPlan: { aspectRatio: '4:5' },
      publishHints: { altText: 'Rainy city corner' }
    }
  }));

  assert.equal(output.image.source, 'v2_image_request');
  assert.equal(output.publish.readiness, 'caption_ready_image_generation_pending');
  assert.equal(output.publish.releaseStage, 'image_request_ready');
  assert.equal(output.image.altText, 'Rainy city corner');
  assert.deepEqual(output.publish.blockers, ['generated_image_missing']);
});

test('buildPostPackage surfaces provider auth failure as a formal blocker', () => {
  const output = buildPostPackage(makeBaseInputs({
    generatedImage: {
      provider: 'openai-images',
      status: 'provider_auth_failed',
      imageUrl: '',
      failureReason: 'OPENAI_API_KEY_invalid',
      requestSummary: { altText: 'Rainy street corner' },
      providerRequest: { endpoint: 'https://api.openai.com/v1/images/generations' }
    }
  }));

  assert.equal(output.image.source, 'v2_generated_image_job');
  assert.equal(output.publish.readiness, 'caption_ready_image_provider_auth_failed');
  assert.equal(output.publish.releaseStage, 'image_provider_auth_failed');
  assert.equal(output.image.failureReason, 'OPENAI_API_KEY_invalid');
  assert.deepEqual(output.publish.blockers, ['generated_image_provider_auth_failed']);
});

test('buildPostPackage keeps delivery context without injecting architecture-level review warnings', () => {
  const output = buildPostPackage(makeBaseInputs({
    selectedMoment: {
      eventSummaryZh: '路过转角的时候看到玻璃上那一点雨痕。',
      characterPresenceTarget: 'supporting_presence'
    },
    imageRequest: {
      generationMode: 'scene_grounded_daily_record',
      status: 'generation_request_ready',
      references: [],
      renderPlan: { aspectRatio: '4:5' },
      publishHints: { altText: 'Rainy city corner' }
    }
  }));

  assert.equal(output.reviewContext.selectedMomentSummaryZh, '路过转角的时候看到玻璃上那一点雨痕。');
  assert.equal(output.reviewContext.characterPresenceTarget, 'supporting_presence');
  assert.equal(Object.prototype.hasOwnProperty.call(output.reviewContext, 'reviewWarnings'), false);
});
