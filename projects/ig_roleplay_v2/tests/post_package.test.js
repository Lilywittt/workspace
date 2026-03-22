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
      selectionReason: 'top score'
    },
    imageRequest: null,
    generatedImage: null,
    selectedImage: {},
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
      localFilePath: '/tmp/generated/history/example.png',
      latestFilePath: '/tmp/generated/current/latest-openai-images.png',
      requestSummary: { altText: 'Rainy street corner' },
      providerRequest: { endpoint: 'https://api.openai.com/v1/images/generations' }
    }
  }));

  assert.equal(output.image.source, 'v2_generated_image_local');
  assert.equal(output.publish.readiness, 'local_image_ready_public_url_missing');
  assert.equal(output.publish.releaseStage, 'local_image_ready');
  assert.equal(output.image.localFilePath, '/tmp/generated/history/example.png');
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

test('buildPostPackage surfaces identity review warnings when references stayed metadata-only', () => {
  const output = buildPostPackage(makeBaseInputs({
    selectedMoment: {
      eventSummaryZh: 'She pauses near the bookstore aisle.',
      characterPresenceTarget: 'clear_character_presence'
    },
    externalEventPacket: {
      activeEventIds: ['bookstore_weekend_stationery_display']
    },
    generatedImage: {
      provider: 'aliyun-z-image',
      status: 'image_ready',
      imageUrl: 'https://cdn.example.com/final.jpg',
      requestSummary: {
        altText: 'Bookstore aisle',
        reviewSignals: {
          characterPresenceTarget: 'clear_character_presence',
          captureSummaryEn: 'observational camera relation, medium distance, half body coverage, readable face, balanced environment weight',
          renderStyleSummaryEn: 'line clean_crisp, contrast controlled_clear, color richness balanced_rich, color separation clear_local, edge readability clear_edges, depth separation layered_depth'
        },
        referenceHandling: {
          requestedReferenceCount: 1,
          unresolvedReferenceIds: ['rion_core_face_01'],
          placeholderReferenceIds: ['rion_core_face_01'],
          deliveryMode: 'metadata_only'
        }
      }
    }
  }));

  assert.deepEqual(output.publish.reviewWarnings, [
    'identity_reference_metadata_only_manual_review_required',
    'identity_anchor_placeholder_or_unregistered',
    'active_external_world_state_present_review_against_moment'
  ]);
  assert.equal(output.reviewContext.characterPresenceTarget, 'clear_character_presence');
  assert.match(output.reviewContext.captureSummaryEn, /observational camera relation/);
  assert.match(output.reviewContext.renderStyleSummaryEn, /line clean_crisp/);
  assert.deepEqual(output.reviewContext.activeExternalEventIds, ['bookstore_weekend_stationery_display']);
});
