const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreCandidate } = require('../scripts/select_caption_candidate');

test('scoreCandidate penalizes repeated openings and frequent hashtags', () => {
  const candidate = {
    caption: 'same opening line',
    hashtags: ['#a', '#b', '#c']
  };
  const continuity = {
    duplicateGuards: {
      recentOpenings: [
        { value: 'same opening line' }
      ],
      frequentHashtags: [
        { value: '#b' },
        { value: '#c' }
      ]
    }
  };

  assert.equal(scoreCandidate(candidate, continuity), 54);
});

test('scoreCandidate stays focused on novelty signals, not specific wording', () => {
  const candidate = {
    caption: 'a candidate whose wording should not trigger any special penalty',
    hashtags: ['#a']
  };
  const continuity = { duplicateGuards: {} };

  assert.equal(scoreCandidate(candidate, continuity), 100);
});
