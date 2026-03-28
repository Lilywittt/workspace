const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildGeneratedImageArtifactBase,
  buildProviderRequestBody,
  composePrompt,
  hasFakeIpAddress,
  sizeForProvider
} = require('../scripts/lib/image_generation');
const { getProviderSpec } = require('../scripts/lib/provider_catalog');

test('composePrompt appends negative cues in a provider-friendly format', () => {
  const prompt = composePrompt({
    promptPackage: {
      positivePrompt: 'anime daily life scene',
      negativePrompt: 'extra hands'
    }
  });

  assert.equal(prompt, 'anime daily life scene\n\nAvoid: extra hands');
});

test('buildProviderRequestBody supports hosted OpenAI-style and DashScope bodies', () => {
  const openaiSpec = getProviderSpec('openai-images');
  const aliyunSpec = getProviderSpec('aliyun-z-image');

  const openaiBody = buildProviderRequestBody({
    providerSpec: openaiSpec,
    prompt: 'test prompt',
    size: sizeForProvider(openaiSpec, '4:5'),
    quality: 'high',
    outputFormat: 'png'
  });
  const aliyunBody = buildProviderRequestBody({
    providerSpec: aliyunSpec,
    prompt: 'test prompt',
    size: sizeForProvider(aliyunSpec, '4:5'),
    quality: 'medium',
    outputFormat: 'png'
  });

  assert.equal(openaiBody.model, 'gpt-image-1');
  assert.equal(openaiBody.output_format, 'png');
  assert.equal(openaiBody.quality, 'high');
  assert.equal(aliyunBody.model, 'z-image-turbo');
  assert.equal(aliyunBody.parameters.size, '1024*1280');
  assert.equal(aliyunBody.parameters.watermark, false);
});

test('buildGeneratedImageArtifactBase keeps runtime summary stable for local providers', () => {
  const providerSpec = getProviderSpec('comfyui-local-anime');
  const artifact = buildGeneratedImageArtifactBase({
    scenePlan: { runId: 'scene-1' },
    imageRequest: {
      createdAt: '2026-03-28T12:00:00.000Z',
      generationMode: 'anime_close_crop_trace_lived_moment',
      renderPlan: { aspectRatio: '4:5', candidateCount: 1 },
      publishHints: { altText: 'windy sidewalk close crop' },
      reviewSignals: { characterPresenceTarget: 'supporting_presence' },
      references: [{ id: 'anchor_1' }],
      referencePlan: {
        unresolvedReferenceIds: [],
        placeholderReferenceIds: ['anchor_1']
      },
      promptPackage: {
        positivePrompt: 'anime close crop'
      }
    },
    providerSpec,
    requestBody: { prompt: { node: {} } },
    outputFormat: 'png',
    submissionMode: 'host_executed_workflow'
  });

  assert.equal(artifact.status, 'generation_scaffold_ready');
  assert.equal(artifact.provider, 'comfyui-local-anime');
  assert.equal(artifact.providerRequest.submissionMode, 'host_executed_workflow');
  assert.equal(artifact.requestSummary.referenceHandling.deliveryMode, 'local_only');
  assert.deepEqual(artifact.requestSummary.referenceIds, ['anchor_1']);
});

test('hasFakeIpAddress catches fake-ip DNS ranges used by some tunnels', () => {
  assert.equal(hasFakeIpAddress(['198.18.0.2']), true);
  assert.equal(hasFakeIpAddress(['127.0.0.1', '8.8.8.8']), false);
});
