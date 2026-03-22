const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');

function firstLine(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean) || '';
}

function summarizeCaption(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function pickStyleAnchorIds(referenceLibrary, lane) {
  const wantedStyle = lane === 'selfie' ? 'selfie' : 'daily-life';
  return (referenceLibrary.styleAnchors || [])
    .filter(anchor => anchor && anchor.style === wantedStyle)
    .map(anchor => anchor.id);
}

function buildGoal(scenePlan) {
  if (scenePlan.lane === 'selfie') {
    return 'Generate an Instagram-ready Japanese-anime bishoujo selfie that preserves the core character identity while allowing one or two small daily-life variations.';
  }
  return 'Generate an Instagram-ready Japanese-anime slice-of-life image that still carries clear character presence while supporting the selected caption.';
}

function buildVisualDirectives(scenePlan, selectedCaption, identityProfile, config, styleAnchorIds) {
  const directives = [];
  const concreteSceneCues = Array.isArray(scenePlan?.visual?.concreteSceneCues)
    ? scenePlan.visual.concreteSceneCues
    : [];
  const sceneSemantics = scenePlan?.sceneSemantics || {};
  directives.push('Follow the scene plan first; the image must look like it belongs to today, not like a generic mood board.');
  directives.push(`Bind the image to the selected caption opening: "${firstLine(selectedCaption.caption)}"`);
  directives.push(`Scene program: ${sceneSemantics.sceneProgramId || 'legacy_program'}`);
  directives.push(`Location archetype: ${sceneSemantics.locationArchetype || 'unknown'}`);
  directives.push(`Object bindings: ${(sceneSemantics.objectBindings || []).join(', ') || 'none'}`);
  directives.push(`Weather role: ${sceneSemantics.weatherRole || 'background_only'}`);
  directives.push(`Preserve the character temperament: ${(identityProfile?.coreIdentity?.temperament || []).join(', ')}`);
  directives.push(`Preserve the signature traits when visible: ${(identityProfile?.coreIdentity?.signatureTraits || []).join(', ')}`);
  directives.push(`Carry at least one sensory cue from the plan: ${scenePlan?.narrative?.sensoryFocus || 'daily atmosphere'}`);
  directives.push('Use Japanese anime / bishoujo slice-of-life aesthetics, not photorealistic live-action photography.');

  if (scenePlan.lane === 'selfie') {
    directives.push('Keep the face stable, youthful, and recognizable across future runs.');
    directives.push('Treat changes as small variations only: expression, accessory, outfit accent, lighting, or camera angle.');
    directives.push(`Use the selfie variation budget from config: ${JSON.stringify(config?.vision?.selfie?.variationBudget || {})}`);
  } else {
    directives.push('Prefer scene-led composition driven by today\'s concrete action, object, and environmental clue rather than a stock backdrop.');
    if (concreteSceneCues.length > 0) {
      directives.push(`Make these scene cues legible in the frame: ${concreteSceneCues.join(' | ')}`);
    }
    directives.push('Do not fall back to stock cafe, window, tabletop, or drink scenery unless the current scene cues explicitly call for it.');
    directives.push(`Presence mode: ${scenePlan?.visual?.presenceMode || 'partial_presence'}`);
    directives.push('The full face may stay off screen, but the image must still contain readable character traces.');
    directives.push(`Include at least one trace cue from: ${(scenePlan?.visual?.characterTraceCues || []).join(', ') || 'hand, sleeve, reflection, accessory'}`);
    directives.push(`Optional style anchors for scene tone: ${styleAnchorIds.join(', ') || 'none'}`);
  }

  for (const note of scenePlan?.visual?.sceneNotes || []) {
    directives.push(note);
  }
  return directives;
}

function buildNegativeDirectives(scenePlan) {
  const negatives = [
    'Do not look like an ad, campaign poster, or glossy fashion editorial.',
    'Do not add watermarks, on-image text, or platform UI overlays.',
    'Avoid extra fingers, broken anatomy, duplicate objects, or chaotic clutter.',
    'Avoid unrelated fantasy props that are not grounded in daily life.'
  ];

  if (scenePlan.lane === 'selfie') {
    negatives.push('No identity drift, no sudden age jump, and no dramatic face-shape changes.');
    negatives.push('Avoid oversexualized poses, heavy studio glamour, or cosplay-like costume escalation.');
  } else {
    negatives.push('Do not turn the scene into a tourism poster or empty aesthetic wallpaper.');
    negatives.push('Avoid looking staged, over-symmetrical, or unrealistically polished.');
  }

  return negatives;
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

  const scenePlan = readJsonRequired(path.join(currentDir, 'scene_plan.json'), 'scene plan');
  const selectedCaption = readJsonRequired(path.join(currentDir, 'selected_caption.json'), 'selected caption');
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');
  const referenceLibrary = readJsonRequired(referenceLibraryPath, 'reference library');

  if (!scenePlan || !scenePlan.runId || !selectedCaption || !selectedCaption.caption) {
    throw new Error('scene_plan.json or selected_caption.json is missing');
  }

  const requiredIdentityAnchors = scenePlan.lane === 'selfie'
    ? (config?.vision?.selfie?.requiredIdentityAnchors || [])
    : [];
  const styleAnchorIds = pickStyleAnchorIds(referenceLibrary, scenePlan.lane);

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: scenePlan.runId,
    lane: scenePlan.lane,
    briefGoal: buildGoal(scenePlan),
    storyBinding: {
      premise: scenePlan?.narrative?.premise || '',
      microPlot: scenePlan?.narrative?.microPlot || [],
      sensoryFocus: scenePlan?.narrative?.sensoryFocus || '',
      sceneSemantics: scenePlan?.sceneSemantics || {},
      selectedCaptionOpening: firstLine(selectedCaption.caption),
      selectedCaptionSummary: summarizeCaption(selectedCaption.caption),
      candidateAngle: selectedCaption.candidateAngle || ''
    },
    semanticBindings: {
      sceneProgramId: scenePlan?.sceneSemantics?.sceneProgramId || '',
      locationArchetype: scenePlan?.sceneSemantics?.locationArchetype || '',
      locationCluster: scenePlan?.sceneSemantics?.locationCluster || '',
      objectFamily: scenePlan?.sceneSemantics?.objectFamily || '',
      objectBindings: scenePlan?.sceneSemantics?.objectBindings || [],
      actionKernel: scenePlan?.sceneSemantics?.actionKernel || '',
      weatherRole: scenePlan?.sceneSemantics?.weatherRole || '',
      emotionalLanding: scenePlan?.sceneSemantics?.emotionalLanding || '',
      presencePolicy: scenePlan?.sceneSemantics?.presencePolicy || ''
    },
    identityControl: {
      stableTraits: identityProfile?.visualIdentity?.mustStayStable || [],
      allowedVariation: identityProfile?.visualIdentity?.allowedVariation || [],
      requiredIdentityAnchors,
      optionalStyleAnchors: styleAnchorIds,
      faceVisibility: scenePlan.lane === 'selfie' ? 'required' : 'optional_with_character_trace',
      presenceMode: scenePlan?.visual?.presenceMode || (scenePlan.lane === 'selfie' ? 'full_selfie' : 'partial_presence'),
      requiredTraceCues: scenePlan?.visual?.characterTraceCues || []
    },
    visualDirectives: buildVisualDirectives(scenePlan, selectedCaption, identityProfile, config, styleAnchorIds),
    negativeDirectives: buildNegativeDirectives(scenePlan),
    renderHints: {
      platform: 'instagram',
      aspectRatio: '4:5',
      candidateCount: scenePlan.lane === 'selfie' ? 4 : 3,
      narrativePriority: scenePlan.lane === 'selfie' ? 'identity_consistency' : 'scene_authenticity'
    }
  };

  const written = writeRuntimeArtifact(runtimeDir, 'image_brief.json', 'imagebrief', output);
  console.log(`image brief created: ${written.currentPath}`);
  console.log(`image brief archived: ${written.archivedPath}`);
}

main();
