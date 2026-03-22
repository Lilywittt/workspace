const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGeneratedImageArtifact } = require('../scripts/lib/generated_image');

function makeBaseArgs(extra = {}) {
  return {
    flags: new Set(),
    provider: 'openai-images',
    ...extra
  };
}

function makeImageRequest() {
  return {
    createdAt: '2026-03-17T07:24:23.000Z',
    generationMode: 'scene_grounded_daily_record',
    references: [{ id: 'legacy_daily_style_001' }],
    promptPackage: { positivePrompt: 'daily life image' },
    renderPlan: { aspectRatio: '4:5', candidateCount: 3 },
    publishHints: { altText: 'A rainy city corner.' },
    reviewSignals: {
      characterPresenceTarget: 'clear_character_presence',
      captureSummaryEn: 'observational camera relation, medium distance, half body coverage, readable face, balanced environment weight',
      renderStyleSummaryEn: 'line clean_crisp, contrast controlled_clear, color richness balanced_rich, color separation clear_local, edge readability clear_edges, depth separation layered_depth'
    }
  };
}

test('buildGeneratedImageArtifact creates a scaffold record before submission', () => {
  const output = buildGeneratedImageArtifact({
    config: { version: '2.0.0-alpha.1' },
    imageRequest: makeImageRequest(),
    scenePlan: { runId: 'sceneplan-1' },
    args: makeBaseArgs()
  });

  assert.equal(output.status, 'generation_scaffold_ready');
  assert.equal(output.imageUrl, '');
  assert.equal(output.requestSummary.aspectRatio, '4:5');
  assert.deepEqual(output.requestSummary.referenceIds, ['legacy_daily_style_001']);
  assert.equal(output.requestSummary.reviewSignals.characterPresenceTarget, 'clear_character_presence');
  assert.match(output.requestSummary.reviewSignals.captureSummaryEn, /observational camera relation/);
  assert.match(output.requestSummary.reviewSignals.renderStyleSummaryEn, /line clean_crisp/);
  assert.equal(output.providerRequest.requestBody.size, '1024x1536');
  assert.deepEqual(output.providerRequest.requiredEnv, ['OPENAI_API_KEY']);
  assert.equal(output.model, 'gpt-image-1');
});

test('buildGeneratedImageArtifact marks submitted jobs without pretending a final image exists', () => {
  const output = buildGeneratedImageArtifact({
    config: { version: '2.0.0-alpha.1' },
    imageRequest: makeImageRequest(),
    scenePlan: { runId: 'sceneplan-1' },
    args: makeBaseArgs({ 'job-id': 'job_123' })
  });

  assert.equal(output.status, 'generation_submitted');
  assert.equal(output.remoteJobId, 'job_123');
  assert.equal(output.imageUrl, '');
  assert.equal(output.providerRequest.submissionMode, 'submitted_or_resumed');
});

test('buildGeneratedImageArtifact marks the image ready when a public URL is available', () => {
  const output = buildGeneratedImageArtifact({
    config: { version: '2.0.0-alpha.1' },
    imageRequest: makeImageRequest(),
    scenePlan: { runId: 'sceneplan-1' },
    args: makeBaseArgs({ 'image-url': 'https://cdn.example.com/final.jpg' })
  });

  assert.equal(output.status, 'image_ready');
  assert.equal(output.imageUrl, 'https://cdn.example.com/final.jpg');
  assert.equal(output.providerRequest.assetFilenameHint, 'sceneplan-1-openai-images.jpg');
});
