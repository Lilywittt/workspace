const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildActivationMap,
  buildFallbackSituationHypotheses,
  buildWorldGraphSnapshot,
  validateSituationHypotheses
} = require('../scripts/lib/world_graph');

function makeContext() {
  return {
    config: { version: '2.0.0-alpha.1' },
    graphConfig: {
      version: '2.0.0-alpha.1',
      placeTagWeights: {
        private_meaning: ['private', 'quiet', 'browse'],
        small_reset: ['reset', 'domestic', 'warm_drink'],
        mobility_shift: ['transit', 'passing_through', 'edge']
      },
      objectFamilyWeights: {
        private_meaning: ['paper_fragment', 'keepsake'],
        small_reset: ['comfort_item', 'stationery'],
        mobility_shift: ['bag_contents', 'accessory']
      },
      symbolicObjectKeywords: {
        paper_fragment: ['ticket', 'paper'],
        keepsake: ['note'],
        comfort_item: ['tea'],
        accessory: ['hairclip'],
        bag_contents: ['card']
      },
      activationRules: {
        topPlaceCount: 4,
        topObjectCount: 4,
        topProgramCount: 4,
        topSeedCount: 6
      },
      criticThresholds: {
        repeatRiskHigh: 75,
        repeatRiskMedium: 45
      }
    },
    settingModel: {
      placeArchetypes: {
        bookstore_aisle: { kind: 'public_indoor', sceneCluster: 'bookish_pause', tags: ['browse', 'quiet', 'private'] },
        station_edge: { kind: 'public_transit', sceneCluster: 'transit_fragment', tags: ['transit', 'passing_through', 'edge'] },
        kitchen_counter: { kind: 'indoor_domestic', sceneCluster: 'comfort_reset', tags: ['warm_drink', 'domestic', 'reset'] }
      },
      ownedObjectPools: {
        keepsake: ['old note'],
        comfort_item: ['tea sachet'],
        bag_contents: ['library card'],
        accessory: ['small red hairclip']
      }
    },
    catalog: {
      programs: [
        {
          id: 'bookstore_pause_program',
          laneEligibility: ['life_record'],
          requiredAffordances: ['bookstore_pause_window'],
          actionKernel: 'browse_pause_notice',
          locationArchetypes: ['bookstore_aisle'],
          objectSources: ['keepsake'],
          weatherPolicy: { allowPrimary: false, preferredRoles: ['reflective_support'] },
          emotionalLandingFamilies: ['memory_return', 'private_omen'],
          presencePolicies: ['partial_presence'],
          captionHooks: ['quiet public place, private feeling'],
          imageHooks: ['shelf depth']
        },
        {
          id: 'transit_fragment_program',
          laneEligibility: ['life_record'],
          requiredAffordances: ['transit_fragment_window'],
          actionKernel: 'wait_carry_pass_through',
          locationArchetypes: ['station_edge'],
          objectSources: ['bag_contents', 'accessory'],
          weatherPolicy: { allowPrimary: false, preferredRoles: ['texture_modifier'] },
          emotionalLandingFamilies: ['tiny_reset'],
          presencePolicies: ['partial_presence'],
          captionHooks: ['ordinary transit becomes keepable'],
          imageHooks: ['platform edge']
        }
      ]
    },
    worldState: {
      version: '2.0.0-alpha.1',
      characterState: {
        lanePreference: 'life_record',
        needState: ['private_meaning', 'mobility_shift'],
        attentionShape: 'pattern_breaking'
      },
      continuityPressure: {
        reason: 'need to break indoor study repetition',
        indoorOveruse: true
      },
      environment: {
        mobilityWindow: 'short_walk_ok',
        weatherRoleDefault: 'reflective_support'
      },
      worldMemoryRefs: {
        recurringObjects: ['old note'],
        emotionalThreads: ['memory_return']
      }
    },
    affordancePool: {
      primaryAffordanceIds: ['bookstore_pause_window', 'transit_fragment_window'],
      affordances: [
        { id: 'bookstore_pause_window' },
        { id: 'transit_fragment_window' }
      ]
    },
    noveltyLedger: {
      counts: {
        sceneProgramId: [{ value: 'transit_fragment_program', count: 1 }],
        locationArchetype: [{ value: 'station_edge', count: 2 }],
        locationCluster: [{ value: 'transit_fragment', count: 2 }],
        objectFamily: [{ value: 'bag_contents', count: 1 }],
        emotionalLanding: [{ value: 'tiny_reset', count: 2 }]
      },
      suggestions: {
        coolDownScenePrograms: ['transit_fragment_program']
      }
    },
    reflectionNotes: {
      recurringObjects: ['old note'],
      familiarPlaces: ['bookstore_aisle']
    },
    identityProfile: {
      coreIdentity: {
        signatureTraits: ['small_red_hairclip'],
        temperament: ['light_chunibyo']
      }
    }
  };
}

test('world graph snapshot activates places, objects, and programs', () => {
  const context = makeContext();
  const snapshot = buildWorldGraphSnapshot(context);
  assert.equal(snapshot.placeNodes[0].id, 'bookstore_aisle');
  assert.ok(['keepsake', 'accessory'].includes(snapshot.objectNodes[0].family));
  assert.equal(snapshot.programNodes[0].id, 'bookstore_pause_program');
});

test('activation map and fallback hypotheses produce structured seeds', () => {
  const context = makeContext();
  const snapshot = buildWorldGraphSnapshot(context);
  const activationMap = buildActivationMap({
    graphConfig: context.graphConfig,
    worldGraphSnapshot: snapshot,
    worldState: context.worldState,
    reflectionNotes: context.reflectionNotes,
    continuityReview: { summary: 'break the repeated indoor basin', freshnessTargets: ['widen the world'] },
    noveltyLedger: context.noveltyLedger
  });
  assert.ok(activationMap.activatedSeeds.length >= 2);
  const hypotheses = buildFallbackSituationHypotheses({
    activationMap,
    worldState: context.worldState,
    settingModel: context.settingModel,
    reflectionNotes: context.reflectionNotes,
    continuityReview: { summary: 'break the repeated indoor basin', freshnessTargets: ['widen the world'] }
  });
  assert.ok(hypotheses.length >= 2);
  assert.ok(hypotheses[0].sceneProgramId);
  assert.equal(hypotheses[0].actionArc.length, 3);
});

test('validateSituationHypotheses keeps valid AI hypotheses and scores them', () => {
  const context = makeContext();
  const snapshot = buildWorldGraphSnapshot(context);
  const activationMap = buildActivationMap({
    graphConfig: context.graphConfig,
    worldGraphSnapshot: snapshot,
    worldState: context.worldState,
    reflectionNotes: context.reflectionNotes,
    continuityReview: { summary: 'break the repeated indoor basin', freshnessTargets: ['widen the world'] },
    noveltyLedger: context.noveltyLedger
  });

  const result = validateSituationHypotheses({
    graphConfig: context.graphConfig,
    hypothesesDoc: {
      source: 'skill',
      hypotheses: [
        {
          hypothesisId: 'situation_hyp_01',
          sourceSeedId: activationMap.activatedSeeds[0].seedId,
          lane: 'life_record',
          sceneProgramId: 'bookstore_pause_program',
          affordanceId: 'bookstore_pause_window',
          locationArchetype: 'bookstore_aisle',
          objectFamily: 'keepsake',
          suggestedObjectBindings: ['old note'],
          weatherRole: 'reflective_support',
          emotionalLanding: 'memory_return',
          presenceMode: 'partial_presence',
          situationType: 'private_memory_pause',
          relationshipTension: 'an ordinary object gaining private weight',
          actionArc: ['find note', 'pause by shelf', 'leave with quiet feeling'],
          captionHooks: ['quiet public place, private feeling'],
          imageHooks: ['shelf depth'],
          noveltyClaim: 'This shifts away from transit repetition.',
          premiseSeed: 'An old note becomes the center of a bookstore pause.',
          whyNow: 'The repeated transit basin needs a different social surface.'
        }
      ]
    },
    activationMap,
    worldGraphSnapshot: snapshot,
    settingModel: context.settingModel,
    catalog: context.catalog,
    noveltyLedger: context.noveltyLedger,
    worldState: context.worldState,
    identityProfile: context.identityProfile,
    desiredCount: 3
  });

  assert.equal(result.acceptedCount >= 1, true);
  assert.equal(result.acceptedHypotheses[0].sceneProgramId, 'bookstore_pause_program');
  assert.ok(result.acceptedHypotheses[0].scores.total > 0);
});
