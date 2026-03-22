const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readHistoricalSemanticEntries } = require('../scripts/lib/history_semantics');

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function buildScenePlan(runId, sceneProgramId, locationArchetype) {
  return {
    runId,
    createdAt: '2026-03-20T10:00:00.000Z',
    lane: 'life_record',
    visual: {
      presenceMode: 'partial_presence'
    },
    narrative: {
      premise: `${sceneProgramId} at ${locationArchetype}`
    },
    sceneSemantics: {
      sceneProgramId,
      locationArchetype,
      locationCluster: 'test_cluster',
      actionKernel: 'browse_pause_notice',
      objectFamily: 'stationery',
      objectBindings: ['mechanical pencil'],
      weatherRole: 'texture_modifier',
      emotionalLanding: 'tiny_reset',
      presencePolicy: 'partial_presence'
    }
  };
}

test('readHistoricalSemanticEntries includes recent archived runtime runs', () => {
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-roleplay-history-'));
  try {
    writeJson(
      path.join(runtimeDir, 'intermediate', 'runs', 'sceneplan-2026-03-20T10-00-00', 'scene_plan.json'),
      buildScenePlan('sceneplan-001', 'bookstore_pause_program', 'bookstore_aisle')
    );
    writeJson(
      path.join(runtimeDir, 'intermediate', 'runs', 'sceneplan-2026-03-20T10-05-00', 'scene_plan.json'),
      buildScenePlan('sceneplan-002', 'transit_fragment_program', 'station_edge')
    );

    const entries = readHistoricalSemanticEntries(runtimeDir, 4);
    const runIds = entries.map(entry => entry.runId);
    const sources = entries.map(entry => entry.source);

    assert.deepEqual([...runIds].sort(), ['sceneplan-001', 'sceneplan-002']);
    assert.ok(sources.every(source => source === 'runtime_run'));
    assert.deepEqual(
      [...entries.map(entry => entry.sceneProgramId)].sort(),
      ['bookstore_pause_program', 'transit_fragment_program']
    );
  } finally {
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  }
});
