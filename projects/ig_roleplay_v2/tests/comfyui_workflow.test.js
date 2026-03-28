const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildWorkflowRequest,
  buildDiffusionPositiveTokens,
  extractHistoryImageItems,
  loadWorkflowProfile,
  parseSizeText
} = require('../scripts/lib/comfyui_workflow');

const profilePath = path.resolve(__dirname, '..', 'config', 'render', 'comfyui_anime_engineering_profile.json');

test('parseSizeText supports both x and star separators', () => {
  assert.deepEqual(parseSizeText('1024x1280'), { width: 1024, height: 1280 });
  assert.deepEqual(parseSizeText('720*1280'), { width: 720, height: 1280 });
  assert.equal(parseSizeText('bad-size'), null);
});

test('buildWorkflowRequest injects prompts, checkpoint, and size into the ComfyUI template', () => {
  const profile = loadWorkflowProfile(profilePath);
  const output = buildWorkflowRequest({
    workflowProfile: profile,
    requestedModel: 'animagine-xl-4.0.safetensors',
    provider: 'comfyui-local-anime',
    imageRequest: {
      scenePlanRunId: 'zeromemory-2026-03-28T11-54-02',
      generationMode: 'anime_close_crop_trace_lived_moment',
      renderPlan: {
        aspectRatio: '4:5'
      },
      promptPackage: {
        positivePrompt: 'ShotBlueprint: one girl, anime slice-of-life',
        negativePrompt: 'extra hands'
      }
    }
  });

  assert.equal(output.checkpointName, 'animagine-xl-4.0.safetensors');
  assert.equal(output.size.width, 1024);
  assert.equal(output.size.height, 1280);
  assert.equal(output.submitPayload.prompt['3'].inputs.ckpt_name, 'animagine-xl-4.0.safetensors');
  assert.match(output.submitPayload.prompt['6'].inputs.text, /ShotBlueprint/);
  assert.match(output.submitPayload.prompt['6'].inputs.text, /WorkflowBias/);
  assert.match(output.submitPayload.prompt['7'].inputs.text, /extra hands/);
  assert.match(output.submitPayload.prompt['7'].inputs.text, /WorkflowAvoid/);
  assert.equal(output.submitPayload.prompt['10'].inputs.width, 1024);
  assert.equal(output.submitPayload.prompt['10'].inputs.height, 1280);
  assert.equal(output.submitPayload.prompt['13'].inputs.sampler_name, 'dpmpp_2m');
  assert.equal(typeof output.seed, 'number');
  assert.ok(output.seed > 0);
});

test('extractHistoryImageItems prioritizes configured output nodes and returns image descriptors', () => {
  const history = {
    'prompt-123': {
      outputs: {
        '9': {
          images: [
            {
              filename: 'anime_output.png',
              subfolder: '',
              type: 'output'
            }
          ]
        },
        '11': {
          images: [
            {
              filename: 'ignored_second.png',
              subfolder: '',
              type: 'output'
            }
          ]
        }
      }
    }
  };

  const items = extractHistoryImageItems(history, 'prompt-123', ['9']);

  assert.equal(items.length, 2);
  assert.equal(items[0].nodeId, '9');
  assert.equal(items[0].filename, 'anime_output.png');
});

test('buildDiffusionPositiveTokens condenses verbose prompt blocks into diffusion-friendly tags', () => {
  const profile = loadWorkflowProfile(profilePath);
  const tokens = buildDiffusionPositiveTokens({
    promptPackage: {
      promptBlocks: {
        subject: 'anime slice-of-life illustration, young middle-school age impression, early-teen face and proportions, small red hairclip',
        outfit: 'light gray windbreaker jacket, cream-colored ribbed knit sweater, small red hairclip in wind-blown hair',
        moment: 'Her own hand gripping the zipper pull of the jacket, The hem or lower portion of a light gray windbreaker jacket billowing outward, filled by the wind.',
        context: 'residential sidewalk, soft overcast light',
        composition: 'tight side or rear three-quarter chest-level crop'
      },
      shotNotes: [
        'The hem or lower portion of a light gray windbreaker jacket billowing outward, filled by the wind.',
        'Her own hand gripping the zipper pull of the jacket.'
      ]
    },
    reviewSignals: {
      captureSummaryEn: 'close distance, partial body coverage'
    }
  }, profile);

  assert.ok(tokens.includes('1girl'));
  assert.ok(tokens.includes('anime'));
  assert.ok(tokens.includes('early teen girl'));
  assert.ok(tokens.includes('light gray windbreaker jacket'));
  assert.ok(tokens.includes('cream knit sweater'));
  assert.ok(tokens.includes('hand pulling jacket zipper'));
  assert.ok(tokens.includes('jacket billowing in the wind'));
  assert.ok(tokens.includes('windy sidewalk'));
  assert.ok(tokens.includes('overcast light'));
  assert.ok(tokens.includes('close upper body crop'));
  assert.ok(tokens.includes('side view'));
});
