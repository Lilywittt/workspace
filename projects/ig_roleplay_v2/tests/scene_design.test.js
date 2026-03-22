const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildBaseSceneNotes,
  collectConcreteSceneCues,
  sanitizeCreativeGuidanceNotes
} = require('../scripts/lib/scene_design');

test('collectConcreteSceneCues keeps creative scene details and filters stock instructions', () => {
  const cues = collectConcreteSceneCues({
    lane: 'life_record',
    locationName: 'Shanghai',
    narrativePremise: 'She tidies her desk and finds an old half-finished sketch between two notebooks.',
    microPlot: [
      'Clearing her study space to make room for a fresh start.',
      'Unfolding a wrinkled sketch of a fantastical bird she started days ago.',
      'Feeling a quiet spark of motivation to finish what she began.'
    ],
    sensoryFocus: 'soft rustle of paper, cool desk surface',
    sceneNotes: [
      'Desk cluttered with closed textbooks and a drained mug.',
      'Hands gently smoothing the creased sketch paper.',
      'Prefer environment-led framing shaped by today\'s concrete action, found object, or discovery, not a stock backdrop.'
    ],
    continuityImageAdvice: [
      'Compose a life_record shot: hands interacting with an object or a scene from a third-person perspective'
    ],
    captionFocus: [
      'Finding forgotten inspiration in everyday cleanup.'
    ]
  });

  assert.deepEqual(cues, [
    'Desk cluttered with closed textbooks and a drained mug',
    'Hands gently smoothing the creased sketch paper',
    'Clearing her study space to make room for a fresh start',
    'Unfolding a wrinkled sketch of a fantastical bird she started days ago',
    'Feeling a quiet spark of motivation to finish what she began',
    'Finding forgotten inspiration in everyday cleanup'
  ]);
});

test('buildBaseSceneNotes avoids hard-coded cafe motifs for life_record scenes', () => {
  const notes = buildBaseSceneNotes('life_record', 'Shanghai');
  assert.equal(notes.length, 3);
  assert.match(notes[0], /today's concrete action, found object, or discovery/);
  assert.doesNotMatch(notes.join(' '), /street corners|window light|tabletops|drinks/i);
});

test('sanitizeCreativeGuidanceNotes removes generic stock-backdrop examples', () => {
  const notes = sanitizeCreativeGuidanceNotes([
    'Frame a life detail: a hand holding an object, a street corner, a cafe interior',
    'Use natural light but from a new angle or setting',
    'Capture an activity or object, not just a mood or weather reaction'
  ]);

  assert.deepEqual(notes, [
    'Use natural light but from a new angle or setting',
    'Capture an activity or object, not just a mood or weather reaction'
  ]);
});
