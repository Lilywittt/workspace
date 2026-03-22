const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { runSkillJsonTask } = require('./lib/creative_llm');

function asStringArray(values, limit = 6) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)))
    .slice(0, limit);
}

function buildFallback(candidatesDoc) {
  return {
    selectedCandidateId: candidatesDoc?.candidates?.[0]?.id || '',
    reason: 'Fallback selection review: keep the first validated candidate when the creative reviewer is unavailable.',
    strengths: ['Keeps the pipeline moving with a validated candidate.'],
    risks: ['Creative ranking was not available for this run.']
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
  const captionBrief = readJsonRequired(path.join(currentDir, 'caption_brief.json'), 'caption brief');
  const candidatesDoc = readJsonRequired(path.join(currentDir, 'caption_candidates.json'), 'caption candidates');
  const continuitySnapshot = readJsonOptional(path.join(currentDir, 'continuity_snapshot.json'), {});
  const skillPath = resolveRelative(configPath, '../../../skills/caption-selection-reviewer/SKILL.md');
  const modelConfigPath = resolveRelative(configPath, './creative_model.json');

  let draft = null;
  let source = 'skill';
  let status = 'caption_selection_review_ready';
  let errorMessage = '';

  try {
    draft = await runSkillJsonTask({
      skillPath,
      modelConfigPath,
      taskLabel: 'Review validated caption candidates and recommend the strongest one for publication.',
      outputContract: {
        selectedCandidateId: 'candidate id',
        reason: 'one concise paragraph',
        strengths: ['short bullet'],
        risks: ['short bullet']
      },
      input: {
        scenePlan,
        captionBrief,
        continuitySnapshot,
        candidates: candidatesDoc.candidates || [],
        hardRule: 'Pick from the provided candidate ids only.'
      }
    });
  } catch (err) {
    draft = buildFallback(candidatesDoc);
    source = 'fallback';
    status = 'caption_selection_review_fallback';
    errorMessage = err.message;
  }

  const validIds = new Set((candidatesDoc.candidates || []).map(item => item.id));
  const selectedCandidateId = validIds.has(draft.selectedCandidateId)
    ? draft.selectedCandidateId
    : (candidatesDoc?.candidates?.[0]?.id || '');

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: scenePlan.runId,
    source,
    status,
    selectedCandidateId,
    reason: String(draft.reason || '').trim(),
    strengths: asStringArray(draft.strengths, 6),
    risks: asStringArray(draft.risks, 6),
    errorMessage
  };

  const written = writeRuntimeArtifact(runtimeDir, 'caption_selection_review.json', 'captionselectionreview', output);
  console.log(`caption selection review created: ${written.currentPath}`);
  console.log(`caption selection review archived: ${written.archivedPath}`);
  console.log(`caption selection review status: ${output.status}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
