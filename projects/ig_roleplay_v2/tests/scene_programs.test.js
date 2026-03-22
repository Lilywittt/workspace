const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCandidatesFromSituationHypotheses,
  buildScenePlanCandidates,
  scoreCandidate,
  selectScenePlanCandidate
} = require('../scripts/lib/scene_programs');

function makeBaseContext() {
  return {
    config: {
      vision: {
        life_record: {
          preferredPresenceMode: 'partial_presence',
          presenceModes: ['partial_presence', 'wide_scene_with_character_trace']
        }
      }
    },
    settingModel: {
      placeArchetypes: {
        indoor_desk_corner: { kind: 'indoor', sceneCluster: 'indoor_reset' },
        bookstore_aisle: { kind: 'public_indoor', sceneCluster: 'bookish_pause' },
        covered_walkway: { kind: 'semi_outdoor', sceneCluster: 'shelter_pause' }
      },
      ownedObjectPools: {
        stationery: ['planner page'],
        keepsake: ['bookmark'],
        accessory: ['small red hairclip']
      }
    },
    catalog: {
      programs: [
        {
          id: 'desk_reset_program',
          laneEligibility: ['life_record'],
          requiredAffordances: ['indoor_reset_window'],
          actionKernel: 'sort_reset_arrange',
          locationArchetypes: ['indoor_desk_corner'],
          objectSources: ['stationery'],
          weatherPolicy: { allowPrimary: false, preferredRoles: ['reflective_support'] },
          emotionalLandingFamilies: ['gentle_order'],
          presencePolicies: ['partial_presence'],
          captionHooks: ['restoring order through one small action'],
          imageHooks: ['object-led composition']
        },
        {
          id: 'rediscovery_program',
          laneEligibility: ['life_record'],
          requiredAffordances: ['rediscovery_window'],
          actionKernel: 'find_unfold_notice_again',
          locationArchetypes: ['bookstore_aisle', 'covered_walkway'],
          objectSources: ['keepsake', 'accessory'],
          weatherPolicy: { allowPrimary: false, preferredRoles: ['reflective_support', 'texture_modifier'] },
          emotionalLandingFamilies: ['memory_return', 'private_omen'],
          presencePolicies: ['partial_presence', 'wide_scene_with_character_trace'],
          captionHooks: ['ordinary object gains secret weight'],
          imageHooks: ['close object detail']
        }
      ]
    },
    noveltyPolicy: {
      desiredCandidateCount: 5,
      weights: {
        sceneProgram: 18,
        locationArchetype: 12,
        actionKernel: 12,
        objectFamily: 10,
        emotionalLanding: 9,
        weatherRole: 8,
        presenceMode: 5,
        clusterDominance: 10
      },
      penalties: {
        weatherPrimaryOveruse: 10,
        indoorClusterOveruse: 7,
        studyAftermathClusterOveruse: 9
      }
    },
    worldState: {
      timeContext: { localDate: '2026-03-19' },
      environment: { weatherSummary: 'light rain', weatherRoleDefault: 'reflective_support', mobilityWindow: 'short_walk_ok' },
      characterState: { lanePreference: 'life_record', needState: ['small_reset', 'private_meaning'] },
      continuityPressure: { preferredLane: 'life_record' }
    },
    affordancePool: {
      affordances: [
        { id: 'indoor_reset_window' },
        { id: 'rediscovery_window' },
        { id: 'bookstore_pause_window' }
      ],
      primaryAffordanceIds: ['indoor_reset_window', 'rediscovery_window']
    },
    noveltyLedger: {
      counts: {
        sceneProgramId: [{ value: 'desk_reset_program', count: 2 }],
        locationArchetype: [{ value: 'indoor_desk_corner', count: 2 }],
        locationCluster: [{ value: 'indoor_reset', count: 3 }],
        objectFamily: [{ value: 'stationery', count: 2 }],
        weatherRole: [{ value: 'reflective_support', count: 2 }],
        emotionalLanding: [{ value: 'gentle_order', count: 2 }],
        presenceMode: [{ value: 'partial_presence', count: 1 }]
      },
      fatigueFlags: {
        weatherPrimaryOveruse: false,
        indoorClusterOveruse: true,
        studyAftermathClusterOveruse: true
      }
    },
    continuityReview: { summary: 'shift away from overused desk scenes' },
    identityProfile: {
      coreIdentity: { signatureTraits: ['small_red_hairclip'] }
    }
  };
}

test('buildScenePlanCandidates returns semantic candidates and prefers fresher programs', () => {
  const context = makeBaseContext();
  const candidates = buildScenePlanCandidates(context);
  assert.ok(candidates.length >= 2);
  assert.equal(candidates[0].lane, 'life_record');
  assert.ok(candidates.every(candidate => candidate.sceneProgramId));
  assert.ok(candidates.every(candidate => candidate.locationArchetype));
  assert.ok(candidates.every(candidate => candidate.objectBindings.length >= 1));
  assert.equal(candidates[0].sceneProgramId, 'rediscovery_program');
});

test('selectScenePlanCandidate picks the highest scoring candidate', () => {
  const selection = selectScenePlanCandidate([
    { candidateId: 'scene_cand_01', sceneProgramId: 'a', scores: { total: 77, feasibility: 80 } },
    { candidateId: 'scene_cand_02', sceneProgramId: 'b', scores: { total: 91, feasibility: 85 } }
  ]);
  assert.equal(selection.selected.candidateId, 'scene_cand_02');
  assert.equal(selection.ranked[0].candidateId, 'scene_cand_02');
});

test('scoreCandidate penalizes repeated indoor study-like clusters', () => {
  const context = makeBaseContext();
  const candidate = {
    lane: 'life_record',
    sceneProgramId: 'desk_reset_program',
    locationArchetype: 'indoor_desk_corner',
    locationCluster: 'indoor_reset',
    actionKernel: 'sort_reset_arrange',
    objectFamily: 'stationery',
    weatherRole: 'reflective_support',
    emotionalLanding: 'gentle_order',
    presenceMode: 'partial_presence'
  };
  const score = scoreCandidate(candidate, context.noveltyLedger, context.noveltyPolicy, context.worldState);
  assert.ok(score < 80);
});


test('buildCandidatesFromSituationHypotheses converts validated AI situations into ranked candidates', () => {
  const context = makeBaseContext();
  const candidates = buildCandidatesFromSituationHypotheses({
    settingModel: context.settingModel,
    noveltyPolicy: context.noveltyPolicy,
    worldState: context.worldState,
    catalog: context.catalog,
    semanticRepeatCritic: {
      critiques: [
        {
          hypothesisId: 'situation_hyp_01',
          repeatRiskLabel: 'low',
          repeatRiskScore: 18,
          freshnessWins: ['different public surface'],
          suggestedAdjustment: 'keep the object legible'
        }
      ]
    },
    validatedSituationHypotheses: {
      acceptedHypotheses: [
        {
          hypothesisId: 'situation_hyp_01',
          sourceSeedId: 'seed_01',
          situationType: 'public_pause_private_weight',
          relationshipTension: 'an ordinary object gains private weight in public',
          lane: 'life_record',
          sceneProgramId: 'rediscovery_program',
          affordanceId: 'rediscovery_window',
          locationArchetype: 'bookstore_aisle',
          locationCluster: 'bookish_pause',
          objectFamily: 'keepsake',
          suggestedObjectBindings: ['bookmark'],
          weatherRole: 'reflective_support',
          actionKernel: 'find_unfold_notice_again',
          actionArc: ['find bookmark', 'pause at shelf', 'let the feeling settle'],
          emotionalLanding: 'memory_return',
          presenceMode: 'partial_presence',
          captionHooks: ['quiet public place, private feeling'],
          imageHooks: ['shelf depth'],
          premiseSeed: 'A bookmark becomes the center of a bookstore pause.',
          scores: { total: 88, novelty: 84, feasibility: 90, personaFit: 86, activationFit: 82 }
        }
      ]
    }
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].source, 'ai_hypothesis');
  assert.equal(candidates[0].hypothesisId, 'situation_hyp_01');
  assert.equal(candidates[0].sceneProgramId, 'rediscovery_program');
});
