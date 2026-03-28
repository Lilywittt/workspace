const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getProviderSpec,
  requiredEnvFor,
  defaultModelFor,
  defaultEndpointFor,
  deriveSize
} = require('../scripts/lib/provider_catalog');

test('provider catalog returns the expected Alibaba z-image defaults', () => {
  const spec = getProviderSpec('aliyun-z-image');

  assert.equal(spec.provider, 'aliyun-z-image');
  assert.equal(spec.apiStyle, 'dashscope-multimodal');
  assert.equal(spec.defaultModel, 'z-image-turbo');
  assert.equal(spec.model, 'z-image-turbo');
  assert.equal(defaultModelFor('aliyun-z-image'), 'z-image-turbo');
  assert.equal(defaultEndpointFor('aliyun-z-image'), 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
  assert.deepEqual(requiredEnvFor('aliyun-z-image'), ['DASHSCOPE_API_KEY']);
  assert.equal(deriveSize('aliyun-z-image', '4:5'), '1024*1280');
});

test('provider catalog supports overriding the requested model cleanly', () => {
  const spec = getProviderSpec('aliyun-qwen-image', 'qwen-image-2.0-pro');

  assert.equal(spec.provider, 'aliyun-qwen-image');
  assert.equal(spec.model, 'qwen-image-2.0-pro');
  assert.equal(spec.defaultModel, 'qwen-image-2.0');
});

test('provider catalog exposes the local ComfyUI anime engineering provider', () => {
  const spec = getProviderSpec('comfyui-local-anime');

  assert.equal(spec.provider, 'comfyui-local-anime');
  assert.equal(spec.apiStyle, 'comfyui-workflow');
  assert.equal(spec.model, 'animagine-xl-4.0-opt.safetensors');
  assert.equal(defaultEndpointFor('comfyui-local-anime'), 'http://127.0.0.1:8188');
  assert.deepEqual(requiredEnvFor('comfyui-local-anime'), []);
  assert.equal(deriveSize('comfyui-local-anime', '4:5'), '1024x1280');
  assert.equal(spec.workflowProfilePath, './render/comfyui_anime_engineering_profile.json');
});

test('provider catalog returns null for unknown providers instead of inventing defaults', () => {
  assert.equal(getProviderSpec('missing-provider'), null);
  assert.deepEqual(requiredEnvFor('missing-provider'), []);
  assert.equal(defaultModelFor('missing-provider'), null);
  assert.equal(defaultEndpointFor('missing-provider'), null);
  assert.equal(deriveSize('missing-provider', '4:5'), null);
});
