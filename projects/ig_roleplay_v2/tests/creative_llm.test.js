const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractFirstJsonBlock,
  parseModelJsonResponse,
  repairJsonLikeText
} = require('../scripts/lib/creative_llm');

test('extractFirstJsonBlock handles fenced JSON payloads', () => {
  const raw = [
    '```json',
    '{',
    '  "status": "ok",',
    '  "items": [1, 2, 3]',
    '}',
    '```'
  ].join('\n');

  assert.equal(
    extractFirstJsonBlock(raw),
    '{\n  "status": "ok",\n  "items": [1, 2, 3]\n}'
  );
});

test('extractFirstJsonBlock ignores leading commentary and keeps nested objects intact', () => {
  const raw = 'Here is the payload:\n{"outer":{"inner":["a","b"]},"ok":true}\nThanks.';

  assert.equal(
    extractFirstJsonBlock(raw),
    '{"outer":{"inner":["a","b"]},"ok":true}'
  );
});

test('repairJsonLikeText fixes hashtag strings that start with a bare # token', () => {
  const raw = '{"candidates":[{"hashtags":[#dailylog,"city_fragment"]}]}';

  assert.equal(
    repairJsonLikeText(raw),
    '{"candidates":[{"hashtags":["#dailylog","city_fragment"]}]}'
  );
});

test('repairJsonLikeText fixes multiline bare hashtag values', () => {
  const raw = [
    '{',
    '  "hashtagAngles": [',
    '    "rain mood",',
    '    #Shanghai citywalk',
    '  ]',
    '}'
  ].join('\n');

  assert.equal(
    repairJsonLikeText(raw),
    '{\n  "hashtagAngles": [\n    "rain mood",\n    "#Shanghai citywalk"\n  ]\n}'
  );
});

test('parseModelJsonResponse accepts lightly malformed hashtag arrays after repair', () => {
  const raw = '{"candidates":[{"caption":"today felt small but clear","hashtags":[#dailylog,"sketch_note"]}]}';

  assert.deepEqual(parseModelJsonResponse(raw), {
    candidates: [
      {
        caption: 'today felt small but clear',
        hashtags: ['#dailylog', 'sketch_note']
      }
    ]
  });
});
