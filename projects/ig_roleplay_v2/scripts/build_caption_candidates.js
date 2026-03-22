const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { buildFallbackCandidates: buildSceneGroundedFallbackCandidates } = require('./lib/caption_candidates_support');

function firstLine(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean) || '';
}

function textLength(text) {
  return Array.from(String(text || '')).length;
}

function hasChinese(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''));
}

function normalizeHashtag(tag) {
  const cleaned = String(tag || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '')
    .replace(/[\uFF0C\u3002\uFF01\uFF1F\u3001,.!?]/g, '');
  return cleaned ? `#${cleaned}` : '';
}

function uniqueStrings(values) {
  return Array.from(new Set((values || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)));
}

function normalizeCaption(text) {
  return String(text || '')
    .replace(/\r?\n+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}


function normalizeCandidate(candidate, index, maxHashtags, maxChars) {
  const caption = normalizeCaption(candidate.caption);
  const captionLength = textLength(caption);
  return {
    id: String(candidate.id || `cand_${String(index + 1).padStart(2, '0')}`).trim(),
    angle: String(candidate.angle || 'daily_observation').trim(),
    caption,
    hashtags: uniqueStrings((candidate.hashtags || []).map(normalizeHashtag).filter(Boolean)).slice(0, maxHashtags),
    rationale: String(candidate.rationale || '').trim(),
    captionLength,
    hasChinese: hasChinese(caption),
    fitsLengthLimit: captionLength <= maxChars
  };
}

function buildFallbackCandidates(scenePlan, captionBrief, maxHashtags, maxChars) {
  return buildSceneGroundedFallbackCandidates(scenePlan, captionBrief, maxHashtags)
    .map((candidate, index) => normalizeCandidate(candidate, index, maxHashtags, maxChars));
}

function validateCandidates(candidates, maxChars) {
  const normalized = [];
  const openingSet = new Set();
  for (let i = 0; i < (candidates || []).length; i += 1) {
    const candidate = candidates[i];
    if (!candidate.caption || !candidate.hasChinese || candidate.captionLength > maxChars) continue;
    const opening = firstLine(candidate.caption);
    if (!opening || openingSet.has(opening)) continue;
    openingSet.add(opening);
    normalized.push(candidate);
  }
  return normalized;
}

function buildOutput({
  config,
  scenePlan,
  captionBrief,
  aiDoc
}) {
  const maxHashtags = Number(scenePlan?.caption?.limits?.maxHashtags || 5);
  const maxChars = Number(scenePlan?.caption?.limits?.targetMaxChars || 180);
  const aiCandidates = (aiDoc.candidates || []).map((candidate, index) =>
    normalizeCandidate(candidate, index, maxHashtags, maxChars)
  );
  let candidates = validateCandidates(aiCandidates, maxChars);
  let source = String(aiDoc.source || '').trim() || 'missing';
  let status = String(aiDoc.status || '').trim() || 'missing';

  if (candidates.length < 3) {
    candidates = buildFallbackCandidates(scenePlan, captionBrief, maxHashtags, maxChars);
    source = aiCandidates.length > 0
      ? `fallback_after_${source || 'invalid_ai'}`
      : 'fallback';
    status = aiDoc.status
      ? `${aiDoc.status}_recovered_with_fallback`
      : 'caption_candidates_fallback';
  }

  return {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: scenePlan.runId,
    briefGoal: captionBrief.goal,
    source,
    sourceStatus: status,
    candidates: candidates.map(({ captionLength, hasChinese, fitsLengthLimit, ...candidate }) => candidate)
  };
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const currentDir = path.join(runtimeDir, 'current');
  const scenePlan = readJsonRequired(path.join(currentDir, 'scene_plan.json'), 'scene plan');
  const captionBrief = readJsonRequired(path.join(currentDir, 'caption_brief.json'), 'caption brief');
  const aiDoc = readJsonOptional(path.join(currentDir, 'caption_candidates_ai.json'), {});
  const output = buildOutput({ config, scenePlan, captionBrief, aiDoc });

  const written = writeRuntimeArtifact(runtimeDir, 'caption_candidates.json', 'captioncandidates', output);
  console.log(`caption candidates created: ${written.currentPath}`);
  console.log(`caption candidates archived: ${written.archivedPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildFallbackCandidates,
  buildOutput,
  firstLine,
  normalizeCandidate,
  normalizeHashtag,
  validateCandidates
};
