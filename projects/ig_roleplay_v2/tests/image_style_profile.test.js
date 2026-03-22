const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeImageStyleProfile
} = require('../src/agent/image_style_profile');

test('normalizeImageStyleProfile compiles pure style dimensions into derived positive and negative prompts', () => {
  const output = normalizeImageStyleProfile({
    profileId: 'anime_finish_boost',
    styleIntentZh: '只调整画工，不改内容。',
    styleDimensions: {
      lineCrispness: 'sharp_crisp',
      contrastDepth: 'strong_clear',
      colorRichness: 'vivid_rich',
      colorSeparation: 'clear_local',
      edgeReadability: 'crisp_edges',
      depthSeparation: 'strong_separation'
    },
    stylePositiveEn: [
      'anime finish with stronger color pop'
    ],
    styleNegativeEn: [
      'chalky colors'
    ],
    guardrailsEn: [
      'adjust rendering craft only'
    ]
  });

  assert.equal(output.profileId, 'anime_finish_boost');
  assert.equal(output.styleDimensions.lineCrispness, 'sharp_crisp');
  assert.equal(output.styleDimensions.contrastDepth, 'strong_clear');
  assert.match(output.styleSummaryEn, /line sharp_crisp/);
  assert.match(output.styleSummaryEn, /contrast strong_clear/);
  assert.match(output.styleIntentZh, /只调整画工/);
  assert.match(output.styleDimensionPositiveEn.join(', '), /sharper anime linework/);
  assert.match(output.styleDimensionPositiveEn.join(', '), /stronger clear contrast/);
  assert.match(output.styleDimensionNegativeEn.join(', '), /soft unfocused linework/);
  assert.match(output.styleDimensionNegativeEn.join(', '), /flat low-contrast rendering/);
  assert.deepEqual(output.guardrailsEn, ['adjust rendering craft only']);
});
