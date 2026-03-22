const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const {
  compactSceneText,
  uniqueStrings
} = require('./lib/scene_design');

function unique(items) {
  return uniqueStrings(items);
}

function compactText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/[;|]+/g, ' ')
    .trim();
}

function isIndoorScene(scenePlan) {
  const locationArchetype = String(scenePlan?.sceneSemantics?.locationArchetype || '');
  if (['indoor_desk_corner', 'window_seat', 'bookstore_aisle', 'convenience_counter', 'stairwell_landing', 'laundry_corner', 'kitchen_counter'].includes(locationArchetype)) {
    return true;
  }
  if (['station_edge', 'covered_walkway', 'campus_edge'].includes(locationArchetype)) {
    return false;
  }

  const source = [
    ...(scenePlan?.visual?.concreteSceneCues || []),
    ...(scenePlan?.visual?.sceneNotes || []),
    scenePlan?.narrative?.premise || '',
    ...(scenePlan?.narrative?.microPlot || [])
  ]
    .map(item => compactText(item).toLowerCase())
    .filter(Boolean)
    .join(' ');

  const indoorHits = /(desk|room|lamp|laptop|notebook|textbook|study|paper|pencil|book|shelf|floor|bed|mug|kitchen|indoor)/.test(source);
  const outdoorHits = /(street|alley|crosswalk|station|platform|shopfront|pavement|sidewalk|raincoat|umbrella|outdoor)/.test(source);
  return indoorHits && !outdoorHits;
}

function inferWeatherCue(scenePlan) {
  const text = String(scenePlan?.freshness?.weatherSignal || '').toLowerCase();
  const cues = [];
  const indoorScene = isIndoorScene(scenePlan);

  if (/rain|drizzle|shower/.test(text)) {
    cues.push('light rain');
    if (indoorScene) {
      cues.push('rain-muted room tone', 'soft rainy daylight', 'cool damp air');
    } else {
      cues.push('wet pavement reflections', 'window droplets', 'cool damp air');
    }
  } else if (/clear|sun|mostly clear/.test(text)) {
    cues.push(indoorScene ? 'sunlight touching nearby surfaces' : 'soft daylight', indoorScene ? 'bright indoor air' : 'clear air', 'gentle sunlight');
  } else if (/cloud|overcast/.test(text)) {
    cues.push(indoorScene ? 'dim indoor daylight' : 'overcast daylight', 'muted city light');
  } else if (/fog|mist/.test(text)) {
    cues.push(indoorScene ? 'soft diffused light' : 'soft haze', indoorScene ? 'blurred outdoors beyond the window' : 'misty distance');
  }

  const tempMatch = text.match(/(-?\d+(?:\.\d+)?)c/);
  if (tempMatch) {
    const temp = Number(tempMatch[1]);
    if (temp <= 12) cues.push('slightly chilly');
    else if (temp >= 28) cues.push('slightly warm');
    else cues.push('comfortable temperature');
  }

  return unique(cues);
}

function collectConcreteSceneCues(scenePlan) {
  return unique((scenePlan?.visual?.concreteSceneCues || [])
    .map(cue => compactSceneText(cue))
    .filter(Boolean));
}

function inferAngleCue(selectedCaption, scenePlan) {
  const angle = String(selectedCaption?.candidateAngle || '').toLowerCase();
  const presenceMode = String(scenePlan?.visual?.presenceMode || '');
  const cues = [];

  if (angle.includes('selfie')) {
    cues.push('close selfie framing', 'phone camera feeling');
  } else if (angle.includes('mirror')) {
    cues.push('mirror-assisted framing');
  } else if (angle.includes('cleanup') || angle.includes('rediscovery')) {
    cues.push('activity-led framing', 'object-first composition');
  }

  if (presenceMode === 'partial_presence') {
    cues.push('partial first-person presence');
  } else if (presenceMode === 'wide_scene_with_character_trace') {
    cues.push('wide scene with readable character trace');
  } else if (scenePlan?.lane === 'selfie') {
    cues.push('close selfie framing', 'phone camera feeling');
  }

  return unique(cues);
}

function traceCueToPhrase(value) {
  return String(value || '')
    .replace(/hand_with_phone_or_drink/ig, 'a hand holding a phone or drink')
    .replace(/sleeve_or_outfit_edge/ig, 'a sleeve edge or outfit edge')
    .replace(/hair_tip_or_red_hairclip/ig, 'hair tip or a small red hairclip')
    .replace(/reflection_shadow_or_mirror_hint/ig, 'a reflection, shadow, or mirror hint')
    .replace(/soft_anime_face/ig, 'a soft anime face when visible')
    .replace(/youthful_presence/ig, 'a youthful presence')
    .replace(/small_red_hairclip/ig, 'a small red hairclip');
}

function locationArchetypeToPhrases(value) {
  const map = {
    indoor_desk_corner: ['a lived-in study corner', 'desk surface with daily texture'],
    window_seat: ['a quiet seat near the window', 'soft light touching nearby objects'],
    bookstore_aisle: ['a quiet bookstore aisle', 'shelf depth and paper texture'],
    convenience_counter: ['a bright small-store counter', 'small errand atmosphere'],
    station_edge: ['a station edge held briefly still', 'passing-through transit air'],
    stairwell_landing: ['a stairwell landing between places', 'in-between corridor depth'],
    covered_walkway: ['a covered walkway holding back the weather', 'edge-of-rain atmosphere'],
    campus_edge: ['the edge of campus after movement', 'after-school air'],
    laundry_corner: ['a small laundry corner', 'soft fabric texture'],
    kitchen_counter: ['a warm kitchen counter', 'small comfort glow']
  };
  return map[String(value || '')] || [];
}

function actionKernelToPhrases(value, objectBindings) {
  const objectLabel = (objectBindings || []).join(', ') || 'one small object';
  const map = {
    sort_reset_arrange: [`gently sorting or straightening ${objectLabel}`],
    find_unfold_notice_again: [`finding ${objectLabel} and giving it renewed attention`],
    pause_listen_hold: [`pausing with ${objectLabel} long enough for the mood to settle`],
    wait_carry_pass_through: [`carrying ${objectLabel} through a brief transition`],
    browse_pause_notice: [`browsing until ${objectLabel} becomes personally meaningful`],
    choose_pay_carry_back: [`bringing ${objectLabel} back from a tiny errand`],
    return_fix_restore: [`repairing or returning ${objectLabel} to its place`],
    fold_sort_pause: [`folding or sorting around ${objectLabel}`],
    heat_hold_breathe: [`holding ${objectLabel} as the day softens`],
    notice_capture_breathe: [`catching the feeling before it slips away`],
    adjust_check_capture: [`adjusting one detail before capture`],
    touch_adjust_notice: [`letting a small adjustment carry the mood`]
  };
  return map[String(value || '')] || [];
}

function weatherRoleToPhrases(value) {
  const map = {
    primary_scene_driver: ['weather is visibly shaping the scene'],
    reflective_support: ['weather supports reflection without taking over'],
    texture_modifier: ['weather appears mainly through texture and air'],
    background_only: ['weather stays in the background']
  };
  return map[String(value || '')] || [];
}

function emotionalLandingToPhrases(value) {
  const map = {
    quiet_completion: ['a feeling of quietly closing a small loop'],
    memory_return: ['a soft return of memory'],
    tiny_reset: ['a tiny emotional reset'],
    private_omen: ['ordinary detail with private omen energy'],
    gentle_order: ['restoring a little order'],
    shy_attachment: ['quiet fondness kept mostly private']
  };
  return map[String(value || '')] || [];
}

function toneToPhrase(value) {
  return String(value || '')
    .replace(/light chunibyo/ig, 'slightly chunibyo')
    .replace(/gentle/ig, 'gentle')
    .replace(/daily-life texture/ig, 'lived-in daily texture')
    .replace(/non-commercial/ig, 'non-commercial');
}

function buildSubjectBlock(identityProfile, scenePlan) {
  const age = identityProfile?.coreIdentity?.apparentAge;
  const traits = unique(identityProfile?.coreIdentity?.signatureTraits || []);
  const pieces = ['Japanese anime bishoujo'];

  if (age) pieces.push(`about ${age} years old in impression`);
  if (traits.includes('soft_anime_face')) pieces.push('soft anime face');
  if (traits.includes('youthful_presence')) pieces.push('youthful presence');
  if (traits.includes('small_red_hairclip')) pieces.push('small red hairclip');

  if (scenePlan?.lane === 'selfie') {
    pieces.push('the same recognizable girl across future runs');
  } else if (scenePlan?.visual?.presenceMode === 'partial_presence') {
    pieces.push('not necessarily fully visible, but clearly her');
  } else {
    pieces.push('present through subtle but readable character traces');
  }

  return `Subject: ${pieces.join(', ')}`;
}

function buildSceneBlock(scenePlan) {
  const sceneSemantics = scenePlan?.sceneSemantics || {};
  const weatherCues = inferWeatherCue(scenePlan);
  const concreteCues = collectConcreteSceneCues(scenePlan);
  const locationName = compactText(scenePlan?.freshness?.locationName || '');
  const cues = unique([
    ...locationArchetypeToPhrases(sceneSemantics.locationArchetype),
    ...(sceneSemantics.objectBindings || []),
    ...actionKernelToPhrases(sceneSemantics.actionKernel, sceneSemantics.objectBindings || []),
    ...weatherRoleToPhrases(sceneSemantics.weatherRole),
    ...weatherCues,
    ...concreteCues,
    (locationName && !concreteCues.some(cue => cue.toLowerCase().includes(locationName.toLowerCase())))
      ? `everyday life in ${locationName}`
      : ''
  ]);
  return `Scene: ${cues.join(', ')}`;
}

function buildStyleBlock(scenePlan) {
  const base = [
    'anime slice-of-life illustration',
    'light novel aesthetic',
    'beautiful girl appeal',
    'clean color design',
    'non-photorealistic'
  ];

  if (scenePlan?.lane === 'selfie') {
    base.push('natural selfie mood');
  } else {
    base.push('daily record mood');
  }

  return `Style: ${base.join(', ')}`;
}

function buildCameraBlock(scenePlan, selectedCaption, imageBrief) {
  const angleCues = inferAngleCue(selectedCaption, scenePlan);
  const cameraVariation = compactText(imageBrief?.identityControl?.allowedVariation?.cameraAngle || '');
  const sceneSemantics = scenePlan?.sceneSemantics || {};
  if (sceneSemantics.locationArchetype === 'station_edge') angleCues.push('slight sense of paused motion');
  if (sceneSemantics.locationArchetype === 'bookstore_aisle') angleCues.push('shelf depth framing');
  if (sceneSemantics.locationArchetype === 'stairwell_landing') angleCues.push('threshold depth');
  const cues = unique([...angleCues, cameraVariation]);
  return `Camera: ${cues.join(', ') || 'Instagram 4:5 vertical framing'}`;
}

function buildMoodBlock(scenePlan) {
  const sceneSemantics = scenePlan?.sceneSemantics || {};
  const tones = unique(scenePlan?.caption?.tone || []).map(toneToPhrase).filter(Boolean);
  const sensory = compactText(scenePlan?.narrative?.sensoryFocus || '')
    .replace(/rain noise/ig, 'rain sound')
    .replace(/damp air/ig, 'damp air')
    .replace(/drops collecting along edges/ig, 'drops collecting on edges')
    .replace(/moving hair strands, fabric motion, and cool air on the cheek/ig, 'moving hair, light fabric motion, cool air on the cheek')
    .replace(/light, temperature, and the touch of small nearby objects/ig, 'light, temperature, and the touch of nearby objects');

  const cues = unique([
    ...tones,
    ...emotionalLandingToPhrases(sceneSemantics.emotionalLanding),
    sensory
  ]).filter(Boolean);
  return `Mood: ${cues.join(', ')}`;
}

function buildDetailBlock(scenePlan, imageBrief) {
  const traceCues = unique(imageBrief?.identityControl?.requiredTraceCues || [])
    .map(traceCueToPhrase)
    .slice(0, scenePlan?.lane === 'selfie' ? 3 : 4);

  if (scenePlan?.lane === 'selfie') {
    return `Details: preserve the same face shape, same age impression, same overall temperament, with only small daily-life variations`;
  }

  return `Details: include at least one readable character trace such as ${traceCues.join(', ')}`;
}

function buildConstraintBlock(scenePlan) {
  const base = [
    'no empty scenery without character presence',
    'no ad poster feeling',
    'no tourism poster feeling',
    'no glossy fashion editorial look',
    'no photoreal live-action look',
    'no text, subtitle, watermark, or UI overlay'
  ];

  if (scenePlan?.lane === 'selfie') {
    base.push('no identity drift', 'no age jump');
  }

  return `Hard constraints: ${base.join(', ')}`;
}

function buildPromptBlocks(scenePlan, imageBrief, selectedCaption, identityProfile) {
  return {
    layeringStrategy: 'global_style + character_core + scene + camera + mood + detail + hard_constraints',
    subject: buildSubjectBlock(identityProfile, scenePlan),
    scene: buildSceneBlock(scenePlan),
    style: buildStyleBlock(scenePlan),
    camera: buildCameraBlock(scenePlan, selectedCaption, imageBrief),
    mood: buildMoodBlock(scenePlan),
    details: buildDetailBlock(scenePlan, imageBrief),
    constraints: buildConstraintBlock(scenePlan)
  };
}

function blocksToPositivePrompt(promptBlocks) {
  return [
    promptBlocks.subject,
    promptBlocks.scene,
    promptBlocks.style,
    promptBlocks.camera,
    promptBlocks.mood,
    promptBlocks.details,
    promptBlocks.constraints
  ]
    .filter(Boolean)
    .join('\n');
}

function mapReferences(imageBrief, referenceLibrary) {
  const allAnchors = [
    ...(referenceLibrary.identityAnchors || []),
    ...(referenceLibrary.styleAnchors || [])
  ];
  const requiredIds = new Set([
    ...(imageBrief?.identityControl?.requiredIdentityAnchors || []),
    ...(imageBrief?.identityControl?.optionalStyleAnchors || [])
  ]);

  const references = [];
  for (const anchor of allAnchors) {
    if (!anchor || !requiredIds.has(anchor.id)) continue;
    references.push({
      id: anchor.id,
      kind: anchor.kind || 'unknown',
      source: anchor.source || 'unspecified',
      weight: anchor.kind === 'identity' ? 1.0 : 0.55,
      why: anchor.kind === 'identity'
        ? 'Keep the character visually stable across runs.'
        : 'Carry forward scene or platform style cues without locking the composition.'
    });
  }

  return references;
}

function buildNegativePrompt(imageBrief) {
  const translated = (imageBrief?.negativeDirectives || [])
    .map(item => compactText(item)
      .replace(/Do not look like an ad, campaign poster, or glossy fashion editorial\./ig, 'ad poster, glossy editorial')
      .replace(/Do not add watermarks, on-image text, or platform UI overlays\./ig, 'text, watermark, platform UI overlay')
      .replace(/Avoid extra fingers, broken anatomy, duplicate objects, or chaotic clutter\./ig, 'extra fingers, bad anatomy, duplicate objects, chaotic clutter')
      .replace(/Avoid unrelated fantasy props that are not grounded in daily life\./ig, 'irrelevant fantasy props')
      .replace(/Do not turn the scene into a tourism poster or empty aesthetic wallpaper\./ig, 'tourism poster, empty aesthetic wallpaper')
      .replace(/Avoid looking staged, over-symmetrical, or unrealistically polished\./ig, 'staged look, over-symmetry, over-polished look')
      .replace(/No identity drift, no sudden age jump, and no dramatic face-shape changes\./ig, 'identity drift, age jump, face-shape drift')
      .replace(/Avoid oversexualized poses, heavy studio glamour, or cosplay-like costume escalation\./ig, 'oversexualized pose, heavy studio glamour, costume escalation'))
    .filter(Boolean);

  const base = unique([
    'text',
    'subtitle',
    'watermark',
    'logo',
    'UI overlay',
    'extra fingers',
    'bad hands',
    'broken anatomy',
    'duplicate objects',
    'identity drift',
    'empty scenery without character trace',
    'tourism poster',
    'ad poster',
    'glossy editorial',
    'photoreal live action'
  ]);

  return unique([...translated, ...base]).join(', ');
}

function buildAltText(scenePlan) {
  if (scenePlan.lane === 'selfie') {
    return 'A Japanese-anime daily-life selfie with stable character identity.';
  }
  return 'A Japanese-anime slice-of-life image with readable character presence.';
}

function buildImageRequestOutput({ config, scenePlan, imageBrief, selectedCaption, identityProfile, referenceLibrary }) {
  const references = mapReferences(imageBrief, referenceLibrary);
  const promptBlocks = buildPromptBlocks(scenePlan, imageBrief, selectedCaption, identityProfile);

  return {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: scenePlan.runId,
    lane: scenePlan.lane,
    sceneSemantics: scenePlan.sceneSemantics || {},
    generationMode: scenePlan.lane === 'selfie'
      ? 'anime_selfie_consistency_guided'
      : (scenePlan?.visual?.presenceMode === 'wide_scene_with_character_trace'
          ? 'anime_wide_scene_character_trace'
          : 'anime_partial_presence_daily_record'),
    sourceBriefCreatedAt: imageBrief.createdAt,
    references,
    promptPackage: {
      positivePrompt: blocksToPositivePrompt(promptBlocks),
      negativePrompt: buildNegativePrompt(imageBrief),
      shotNotes: unique([
        ...(scenePlan?.visual?.concreteSceneCues || []),
        ...(scenePlan?.visual?.sceneNotes || [])
      ]),
      promptBlocks
    },
    renderPlan: {
      aspectRatio: imageBrief?.renderHints?.aspectRatio || '4:5',
      candidateCount: imageBrief?.renderHints?.candidateCount || 4,
      seedStrategy: 'diversified_candidates',
      consistencyPolicy: scenePlan.lane === 'selfie' ? 'fixed_identity_references' : 'scene_first_style_guided'
    },
    publishHints: {
      platform: 'instagram',
      recommendedCrop: '4:5',
      altText: buildAltText(scenePlan),
      needsFaceReview: scenePlan.lane === 'selfie',
      dryRunDefault: Boolean(scenePlan?.publish?.dryRunDefault ?? true)
    },
    status: 'generation_request_ready'
  };
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const identityProfilePath = resolveRelative(configPath, (config.paths && config.paths.identityProfile) || '../character/identity_profile.json');
  const referenceLibraryPath = resolveRelative(configPath, (config.paths && config.paths.referenceLibrary) || '../vision/reference_library.json');
  const currentDir = path.join(runtimeDir, 'current');

  const imageBrief = readJsonRequired(path.join(currentDir, 'image_brief.json'), 'image brief');
  const scenePlan = readJsonRequired(path.join(currentDir, 'scene_plan.json'), 'scene plan');
  const selectedCaption = readJsonRequired(path.join(currentDir, 'selected_caption.json'), 'selected caption');
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');
  const referenceLibrary = readJsonRequired(referenceLibraryPath, 'reference library');

  if (!imageBrief || !scenePlan) {
    throw new Error('image_brief.json or scene_plan.json is missing');
  }

  const output = buildImageRequestOutput({
    config,
    scenePlan,
    imageBrief,
    selectedCaption,
    identityProfile,
    referenceLibrary
  });

  const written = writeRuntimeArtifact(runtimeDir, 'image_request.json', 'imagerequest', output);
  console.log(`image request created: ${written.currentPath}`);
  console.log(`image request archived: ${written.archivedPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildImageRequestOutput,
  buildNegativePrompt,
  buildPromptBlocks
};
