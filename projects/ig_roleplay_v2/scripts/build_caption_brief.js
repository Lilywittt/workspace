const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const {
  buildPersonaAvoidNotes,
  buildPersonaWritingNotes,
  getCreativeGuidance
} = require('./lib/persona_guidance');

function buildGoal(scenePlan) {
  if (scenePlan.lane === 'selfie') {
    return 'Write a caption that feels like a real close-up moment from the character, not a performance or advertisement.';
  }
  return 'Write a caption that feels like a lived city fragment, with the character present through observation and mood rather than direct exposition.';
}

function uniqueStrings(values) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)));
}

function normalizeConceptStrings(values) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim().replace(/^#+\s*/, '').replace(/\s+/g, ' '))
    .filter(Boolean)));
}

function buildWritingDirectives(scenePlan, identityProfile) {
  const directives = [];
  directives.push('Keep the tone gentle, lightly dramatic, faintly chunibyo, and grounded in daily life.');
  directives.push('Do not sound commercial, promotional, or self-descriptive as an AI.');
  directives.push('Use one small micro-plot: cause -> action -> feeling.');
  directives.push('Include at least one concrete sensory detail.');
  directives.push('Bring in one daily variable from weather or trend, but do not let it dominate the post.');
  directives.push('Let one ordinary object, gesture, or sound feel quietly meaningful, like a private ritual, without turning the post into lore exposition.');
  directives.push(`Use the current scene program as a semantic backbone: ${scenePlan?.sceneSemantics?.sceneProgramId || 'legacy_program'}.`);
  directives.push(`Keep the location archetype and object binding legible: ${scenePlan?.sceneSemantics?.locationArchetype || 'unknown'} / ${(scenePlan?.sceneSemantics?.objectBindings || []).join(', ') || 'none'}.`);

  if (scenePlan.lane === 'selfie') {
    directives.push('Center the emotional texture of the face, mood, or close-range body language.');
  } else {
    directives.push('Center one observed scene, object, or small daily fragment, while preserving character presence indirectly.');
  }

  directives.push(...buildPersonaWritingNotes(identityProfile));

  return directives;
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const identityProfilePath = resolveRelative(configPath, (config.paths && config.paths.identityProfile) || '../character/identity_profile.json');
  const currentDir = path.join(runtimeDir, 'current');
  const scenePlanPath = path.join(currentDir, 'scene_plan.json');
  const captionBriefDraftPath = path.join(currentDir, 'caption_brief_draft.json');

  const scenePlan = readJsonRequired(scenePlanPath, 'scene plan');
  if (!scenePlan || !scenePlan.runId) {
    throw new Error(`scene plan not found or invalid: ${scenePlanPath}`);
  }

  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');
  const captionBriefDraft = readJsonOptional(captionBriefDraftPath, {});
  const creativeGuidance = getCreativeGuidance(identityProfile);
  const baseDirectives = buildWritingDirectives(scenePlan, identityProfile);
  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: scenePlan.runId,
    goal: String(captionBriefDraft.goal || '').trim() || buildGoal(scenePlan),
    audienceFeeling: String(captionBriefDraft.audienceFeeling || '').trim(),
    writingDirectives: uniqueStrings([
      ...baseDirectives,
      ...(captionBriefDraft.voiceNotes || []),
      ...(captionBriefDraft.openingMoves || []),
      ...(captionBriefDraft.mustInclude || [])
    ]),
    contentBlocks: {
      premise: scenePlan?.narrative?.premise || '',
      microPlot: scenePlan?.narrative?.microPlot || [],
      sensoryFocus: scenePlan?.narrative?.sensoryFocus || '',
      freshness: scenePlan?.freshness || {},
      sceneSemantics: scenePlan?.sceneSemantics || {},
      worldState: scenePlan?.worldState || {},
      tone: scenePlan?.caption?.tone || [],
      lane: scenePlan?.lane || 'unknown',
      visualMode: scenePlan?.visual?.mode || 'unknown',
      creativeSummary: String(captionBriefDraft.summary || '').trim(),
      hashtagAngles: normalizeConceptStrings(captionBriefDraft.hashtagAngles || []),
      personaSummaryZh: creativeGuidance.personaSummaryZh
    },
    avoidList: uniqueStrings([
      'commercial tone',
      'marketing language',
      'AI self-reference',
      'flat diary summary',
      'repeating a recent opening line',
      ...buildPersonaAvoidNotes(identityProfile)
    ].concat(captionBriefDraft.mustAvoid || [])),
    delivery: {
      maxChars: scenePlan?.caption?.limits?.targetMaxChars || 180,
      minHashtags: scenePlan?.caption?.limits?.minHashtags || 2,
      maxHashtags: scenePlan?.caption?.limits?.maxHashtags || 5,
      maxEmojis: scenePlan?.caption?.limits?.maxEmojis || 2
    },
    creativeInputs: {
      captionBriefDraftPath,
      sourceStatus: String(captionBriefDraft.status || '').trim() || 'missing'
    }
  };

  const written = writeRuntimeArtifact(runtimeDir, 'caption_brief.json', 'captionbrief', output);
  console.log(`caption brief created: ${written.currentPath}`);
  console.log(`caption brief archived: ${written.archivedPath}`);
}

main();
