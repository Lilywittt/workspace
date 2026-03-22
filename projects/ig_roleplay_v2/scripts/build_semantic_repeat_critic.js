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
const { repeatRiskLabel } = require('./lib/world_graph');

function asStringArray(values, limit = 4) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)))
    .slice(0, limit);
}

function buildFallbackCritiques(validatedHypotheses, graphConfig) {
  const critiques = (validatedHypotheses?.acceptedHypotheses || []).map(hypothesis => {
    const score = Number(hypothesis?.validation?.repeatRiskScore || 0);
    const label = repeatRiskLabel(score, graphConfig);
    return {
      hypothesisId: hypothesis.hypothesisId,
      keepOrCut: label === 'high' ? 'revise' : 'keep',
      repeatRiskLabel: label,
      repeatRiskScore: score,
      hiddenSimilarity: asStringArray([
        label !== 'low' ? `This still leans toward the ${hypothesis.locationCluster || hypothesis.locationArchetype} basin.` : '',
        score >= 45 ? `Program ${hypothesis.sceneProgramId} has visible recent repetition pressure.` : ''
      ], 3),
      freshnessWins: asStringArray([
        hypothesis.noveltyClaim,
        `${hypothesis.objectFamily} changes the material center of the scene.`
      ], 3),
      suggestedAdjustment: label === 'high'
        ? 'Change either the social surface, object family, or emotional landing before selecting this.'
        : 'Keep the structure, but preserve the object-level specificity.'
    };
  });

  return {
    critiques,
    summary: critiques.some(item => item.repeatRiskLabel === 'high')
      ? 'Some hypotheses still hide repeated structure under new wording.'
      : 'The hypothesis set is structurally healthier than the recent repeated basin.'
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const identityProfilePath = resolveRelative(configPath, (config.paths && config.paths.identityProfile) || '../character/identity_profile.json');
  const currentDir = path.join(runtimeDir, 'current');

  const graphConfig = readJsonRequired(resolveRelative(configPath, './world_graph.json'), 'world graph config');
  const validatedHypotheses = readJsonRequired(path.join(currentDir, 'validated_situation_hypotheses.json'), 'validated situation hypotheses');
  const noveltyLedger = readJsonOptional(path.join(currentDir, 'novelty_ledger.json'), {});
  const reflectionNotes = readJsonOptional(path.join(currentDir, 'reflection_notes.json'), {});
  const continuityCreativeReview = readJsonOptional(path.join(currentDir, 'continuity_creative_review.json'), {});
  const identityProfile = readJsonRequired(identityProfilePath, 'identity profile');
  const creativePersona = buildCreativePersonaInput(identityProfile);
  const skillPath = resolveRelative(configPath, '../../../skills/semantic-repeat-critic/SKILL.md');
  const modelConfigPath = resolveRelative(configPath, './creative_model.json');

  let critique = null;
  let source = 'skill';
  let status = 'semantic_repeat_critic_ready';
  let errorMessage = '';

  try {
    const draft = await runSkillJsonTask({
      skillPath,
      modelConfigPath,
      taskLabel: 'Critique the situation hypotheses for hidden structural repetition before final scene planning.',
      outputContract: {
        critiques: [
          {
            hypothesisId: 'existing hypothesis id',
            keepOrCut: 'keep or revise or cut',
            repeatRiskLabel: 'low or medium or high',
            repeatRiskScore: 0,
            hiddenSimilarity: ['short bullet'],
            freshnessWins: ['short bullet'],
            suggestedAdjustment: 'one short sentence'
          }
        ],
        summary: 'one short sentence'
      },
      input: {
        validatedSituationHypotheses: validatedHypotheses,
        noveltyLedger,
        reflectionNotes,
        continuityCreativeReview,
        creativePersona,
        instructions: {
          coreTask: 'Flag hypotheses that are only surface-level rewrites of the same basin, even if words changed.',
          hardBoundary: 'Only use existing hypothesisId values.'
        }
      }
    });
    critique = {
      critiques: Array.isArray(draft?.critiques)
        ? draft.critiques.map(item => ({
            hypothesisId: String(item?.hypothesisId || '').trim(),
            keepOrCut: String(item?.keepOrCut || '').trim() || 'keep',
            repeatRiskLabel: String(item?.repeatRiskLabel || '').trim() || 'low',
            repeatRiskScore: Number(item?.repeatRiskScore || 0),
            hiddenSimilarity: asStringArray(item?.hiddenSimilarity, 3),
            freshnessWins: asStringArray(item?.freshnessWins, 3),
            suggestedAdjustment: String(item?.suggestedAdjustment || '').trim()
          }))
        : [],
      summary: String(draft?.summary || '').trim()
    };
    if (critique.critiques.length === 0) {
      throw new Error('Semantic critic returned zero critiques.');
    }
  } catch (err) {
    critique = buildFallbackCritiques(validatedHypotheses, graphConfig);
    source = 'fallback';
    status = 'semantic_repeat_critic_fallback';
    errorMessage = err.message;
  }

  const fallbackById = new Map(
    buildFallbackCritiques(validatedHypotheses, graphConfig)
      .critiques
      .map(item => [item.hypothesisId, item])
  );
  const mergedCritiques = [];
  const seenIds = new Set();
  for (const hypothesis of validatedHypotheses?.acceptedHypotheses || []) {
    const fromSkill = (critique?.critiques || []).find(item => item.hypothesisId === hypothesis.hypothesisId);
    const chosen = fromSkill || fallbackById.get(hypothesis.hypothesisId);
    if (chosen && !seenIds.has(chosen.hypothesisId)) {
      mergedCritiques.push(chosen);
      seenIds.add(chosen.hypothesisId);
    }
  }
  for (const item of critique?.critiques || []) {
    if (!seenIds.has(item.hypothesisId)) {
      mergedCritiques.push(item);
      seenIds.add(item.hypothesisId);
    }
  }
  critique.critiques = mergedCritiques;

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    source,
    status,
    summary: critique.summary,
    critiques: critique.critiques,
    errorMessage
  };

  const written = writeRuntimeArtifact(runtimeDir, 'semantic_repeat_critic.json', 'semanticcritic', output);
  console.log(`semantic repeat critic created: ${written.currentPath}`);
  console.log(`semantic repeat critic archived: ${written.archivedPath}`);
  console.log(`semantic repeat critic status: ${output.status}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
