const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { runSkillJsonTask } = require('./lib/creative_llm');
const {
  buildCaptionTaskInput,
  buildFallbackCandidates
} = require('./lib/caption_candidates_support');

function normalizeHashtag(tag) {
  const raw = String(tag || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '')
    .replace(/[\uFF0C\u3002\uFF01\uFF1F\u3001,.!?]/g, '');
  return raw ? `#${raw}` : '';
}

function normalizeCandidates(candidates, maxHashtags = 5) {
  return (candidates || []).map((candidate, index) => ({
    id: String(candidate.id || `ai_cand_${String(index + 1).padStart(2, '0')}`).trim(),
    angle: String(candidate.angle || '').trim() || 'daily_observation',
    caption: String(candidate.caption || '').trim(),
    hashtags: Array.from(new Set((candidate.hashtags || []).map(normalizeHashtag).filter(Boolean))).slice(0, maxHashtags),
    rationale: String(candidate.rationale || '').trim()
  })).filter(item => item.caption);
}

function buildFallback(scenePlan, captionBrief, maxHashtags = 5) {
  return {
    candidates: buildFallbackCandidates(scenePlan, captionBrief, maxHashtags)
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
  const continuitySnapshot = readJsonOptional(path.join(currentDir, 'continuity_snapshot.json'), {});
  const skillPath = resolveRelative(configPath, '../../../skills/caption-candidates-writer/SKILL.md');
  const modelConfigPath = resolveRelative(configPath, './creative_model.json');
  const maxHashtags = Number(scenePlan?.caption?.limits?.maxHashtags || 5);
  const taskInput = buildCaptionTaskInput(scenePlan, captionBrief, continuitySnapshot);

  let draft = null;
  let source = 'skill';
  let status = 'caption_candidates_ai_ready';
  let errorMessage = '';

  try {
    draft = await runSkillJsonTask({
      skillPath,
      modelConfigPath,
      taskLabel: 'Generate multiple Chinese Instagram caption candidates for the current scene and brief.',
      outputContract: {
        candidates: [
          {
            id: 'ai_cand_01',
            angle: 'short angle label',
            caption: 'a full Chinese caption without hashtags merged inside the sentence',
            hashtags: ['tag_without_hash_prefix'],
            rationale: 'one concise reason'
          }
        ]
      },
      input: {
        ...taskInput,
        hardRules: {
          language: 'Chinese',
          candidateCount: 3,
          maxHashtags,
          maxChars: scenePlan?.caption?.limits?.targetMaxChars || 180,
          keepDistinctOpenings: true,
          preferSceneDrivenEnding: true,
          avoidRecycledSignatureEnding: true,
          hashtagFormat: 'Every hashtags entry must be a plain tag word without the # prefix, for example ["日常记录", "生活切片"].',
          jsonFormat: 'Return valid JSON only. Do not include markdown fences, comments, or bare # tokens.'
        }
      }
    });
  } catch (err) {
    draft = buildFallback(scenePlan, captionBrief, maxHashtags);
    source = 'fallback';
    status = 'caption_candidates_ai_fallback';
    errorMessage = err.message;
  }

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: scenePlan.runId,
    source,
    status,
    candidates: normalizeCandidates(draft.candidates, maxHashtags).slice(0, 5),
    errorMessage
  };

  const written = writeRuntimeArtifact(runtimeDir, 'caption_candidates_ai.json', 'captioncandidatesai', output);
  console.log(`caption candidates ai created: ${written.currentPath}`);
  console.log(`caption candidates ai archived: ${written.archivedPath}`);
  console.log(`caption candidates ai status: ${output.status}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  buildFallback,
  normalizeCandidates,
  normalizeHashtag
};
