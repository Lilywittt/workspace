const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildOutput,
  normalizeHashtag,
  validateCandidates
} = require('../scripts/build_caption_candidates');

test('normalizeHashtag strips punctuation and preserves a single leading hash', () => {
  assert.equal(normalizeHashtag('  ##\u65e5\u5e38\uFF0C  '), '#\u65e5\u5e38');
  assert.equal(normalizeHashtag('\u57ce\u5e02\u788e\u7247'), '#\u57ce\u5e02\u788e\u7247');
});

test('validateCandidates removes duplicate openings and non-Chinese captions', () => {
  const candidates = [
    {
      id: 'a',
      caption: '\u4eca\u5929\u98ce\u5f88\u8f7b\uff0c\u6211\u60f3\u628a\u8fd9\u70b9\u5b89\u9759\u7559\u7ed9\u81ea\u5df1\u3002',
      hashtags: ['#\u65e5\u5e38'],
      hasChinese: true,
      captionLength: 19
    },
    {
      id: 'b',
      caption: '\u4eca\u5929\u98ce\u5f88\u8f7b\uff0c\u6211\u60f3\u628a\u8fd9\u70b9\u5b89\u9759\u7559\u7ed9\u81ea\u5df1\u3002',
      hashtags: ['#\u5929\u6c14'],
      hasChinese: true,
      captionLength: 18
    },
    {
      id: 'c',
      caption: 'just a quiet mood',
      hashtags: ['#daily'],
      hasChinese: false,
      captionLength: 17
    },
    {
      id: 'd',
      caption: '\u8def\u8fc7\u7a97\u8fb9\u7684\u65f6\u5019\uff0c\u5149\u7ebf\u521a\u597d\u6162\u4e0b\u6765\u4e86\u4e00\u70b9\u3002',
      hashtags: ['#\u751f\u6d3b\u7247\u6bb5'],
      hasChinese: true,
      captionLength: 20
    }
  ];

  const validated = validateCandidates(candidates, 40);
  assert.deepEqual(validated.map(item => item.id), ['a', 'd']);
});

test('buildOutput falls back to local candidates when AI output is invalid', () => {
  const output = buildOutput({
    config: { version: '2.0.0-alpha.1' },
    scenePlan: {
      runId: 'sceneplan-1',
      lane: 'life_record',
      freshness: { weatherSignal: 'light rain, about 11C', locationName: 'Shanghai' },
      narrative: {
        premise: 'After studying, she tidies her desk and finds an old half-finished sketch.',
        microPlot: [
          'Clearing the clutter from the morning review session.',
          'Uncovering a crumpled sketch of a cat beneath a notebook.',
          'Feeling a small nostalgic smile.'
        ],
        sensoryFocus: 'graphite smudge on fingertips, paper crinkle'
      },
      visual: {
        concreteSceneCues: [
          'Desk lit by a warm lamp',
          'Hand holding a creased sketch page'
        ]
      },
      caption: { limits: { maxHashtags: 5, targetMaxChars: 180 } }
    },
    captionBrief: {
      goal: 'test',
      writingDirectives: ['Start from the desk or tidying action.'],
      contentBlocks: {
        hashtagAngles: ['Study or desk aesthetic tags', 'Anime-style art or doodle tags'],
      }
    },
    aiDoc: {
      source: 'skill',
      status: 'caption_candidates_ai_ready',
      candidates: [
        { id: 'x1', caption: 'hello world', hashtags: ['#oops'] }
      ]
    }
  });

  assert.equal(output.source, 'fallback_after_skill');
  assert.equal(output.candidates.length, 3);
  assert.match(output.candidates[0].caption, /书桌|草稿/);
  assert.doesNotMatch(output.candidates.map(item => item.caption).join(' '), /街角|窗边|咖啡/);
});
