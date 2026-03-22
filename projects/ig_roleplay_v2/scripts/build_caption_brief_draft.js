const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { runSkillJsonTask } = require('./lib/creative_llm');
const { buildCreativePersonaInput } = require('./lib/persona_guidance');

function asStringArray(values, limit = 8) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)))
    .slice(0, limit);
}

function normalizeConceptArray(values, limit = 8) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim().replace(/^#+\s*/, '').replace(/\s+/g, ' '))
    .filter(Boolean)))
    .slice(0, limit);
}

function compactText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTaskInput(scenePlan, creativePersona) {
  return {
    scene: {
      lane: scenePlan?.lane || 'life_record',
      premise: compactText(scenePlan?.narrative?.premise || ''),
      microPlot: asStringArray(scenePlan?.narrative?.microPlot || [], 3),
      sensoryFocus: compactText(scenePlan?.narrative?.sensoryFocus || ''),
      tone: asStringArray(scenePlan?.caption?.tone || [], 6),
      locationName: compactText(scenePlan?.freshness?.locationName || ''),
      weatherSignal: compactText(scenePlan?.freshness?.weatherSignal || ''),
      sceneSemantics: {
        sceneProgramId: scenePlan?.sceneSemantics?.sceneProgramId || '',
        locationArchetype: scenePlan?.sceneSemantics?.locationArchetype || '',
        objectBindings: asStringArray(scenePlan?.sceneSemantics?.objectBindings || [], 4),
        actionKernel: scenePlan?.sceneSemantics?.actionKernel || '',
        weatherRole: scenePlan?.sceneSemantics?.weatherRole || '',
        emotionalLanding: scenePlan?.sceneSemantics?.emotionalLanding || ''
      },
      concreteSceneCues: asStringArray(scenePlan?.visual?.concreteSceneCues || [], 6)
    },
    worldState: {
      daypart: scenePlan?.worldState?.timeContext?.daypart || '',
      weekdayMode: scenePlan?.worldState?.timeContext?.weekdayMode || '',
      temperatureBand: scenePlan?.worldState?.environment?.temperatureBand || '',
      mobilityWindow: scenePlan?.worldState?.environment?.mobilityWindow || '',
      needState: asStringArray(scenePlan?.worldState?.characterState?.needState || [], 4)
    },
    creativePersona,
    platform: 'instagram',
    language: 'Chinese caption output required'
  };
}

function buildFallback(scenePlan) {
  return {
    goal: scenePlan?.lane === 'selfie'
      ? 'Write a Chinese Instagram caption that feels close, personal, and emotionally honest.'
      : 'Write a Chinese Instagram caption that feels like a lived city fragment with character presence.',
    audienceFeeling: 'gentle intimacy with one memorable daily-life detail',
    openingMoves: [
      'Open from a small sensory observation instead of a summary.',
      'Let the first line feel like a real post, not a quote or slogan.'
    ],
    mustInclude: [
      'one cause-action-feeling arc',
      'one sensory detail',
      'one daily variable from weather or city life'
    ],
    mustAvoid: [
      'commercial tone',
      'AI self-reference',
      'stiff summary language'
    ],
    voiceNotes: [
      'Keep the tone soft, slightly dramatic, faintly chunibyo, and grounded.',
      'Let one ordinary object or gesture feel briefly symbolic, like a private ritual, without sounding theatrical.',
      'Do not over-explain the mood.'
    ],
    hashtagAngles: [
      'weather',
      'city fragment',
      'daily life'
    ],
    summary: 'Fallback caption brief draft: intimate Chinese social-post voice with one small narrative turn.'
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const currentDir = path.join(runtimeDir, 'current');
  const scenePlan = readJsonRequired(path.join(currentDir, 'scene_plan.json'), 'scene plan');
  const identityProfilePath = resolveRelative(configPath, (config.paths && config.paths.identityProfile) || '../character/identity_profile.json');
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');
  const creativePersona = buildCreativePersonaInput(identityProfile);
  const skillPath = resolveRelative(configPath, '../../../skills/caption-brief-writer/SKILL.md');
  const modelConfigPath = resolveRelative(configPath, './creative_model.json');
  const taskInput = buildTaskInput(scenePlan, creativePersona);

  let draft = null;
  let source = 'skill';
  let status = 'caption_brief_draft_ready';
  let errorMessage = '';

  try {
    draft = await runSkillJsonTask({
      skillPath,
      modelConfigPath,
      taskLabel: 'Write the creative caption brief for the current roleplay scene.',
      outputContract: {
        goal: 'one concise paragraph',
        audienceFeeling: 'one concise phrase',
        openingMoves: ['short bullet'],
        mustInclude: ['short bullet'],
        mustAvoid: ['short bullet'],
        voiceNotes: ['short bullet'],
        hashtagAngles: ['short concept phrase without # symbol'],
        summary: 'one concise summary sentence'
      },
      input: taskInput
    });
  } catch (err) {
    draft = buildFallback(scenePlan);
    source = 'fallback';
    status = 'caption_brief_draft_fallback';
    errorMessage = err.message;
  }

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: scenePlan.runId,
    source,
    status,
    goal: String(draft.goal || '').trim(),
    audienceFeeling: String(draft.audienceFeeling || '').trim(),
    openingMoves: asStringArray(draft.openingMoves, 6),
    mustInclude: asStringArray(draft.mustInclude, 8),
    mustAvoid: asStringArray(draft.mustAvoid, 8),
    voiceNotes: asStringArray(draft.voiceNotes, 8),
    hashtagAngles: normalizeConceptArray(draft.hashtagAngles, 6),
    summary: String(draft.summary || '').trim(),
    errorMessage
  };

  const written = writeRuntimeArtifact(runtimeDir, 'caption_brief_draft.json', 'captionbriefdraft', output);
  console.log(`caption brief draft created: ${written.currentPath}`);
  console.log(`caption brief draft archived: ${written.archivedPath}`);
  console.log(`caption brief draft status: ${output.status}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
