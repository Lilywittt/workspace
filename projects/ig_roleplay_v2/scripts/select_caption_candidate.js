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

function overlapCount(a, b) {
  const bSet = new Set((b || []).map(item => String(item).trim()));
  let count = 0;
  for (const item of a || []) {
    if (bSet.has(String(item).trim())) count += 1;
  }
  return count;
}


function scoreCandidate(candidate, continuity) {
  const recentOpenings = ((continuity.duplicateGuards && continuity.duplicateGuards.recentOpenings) || []).map(item => item.value);
  const recentHashtags = ((continuity.duplicateGuards && continuity.duplicateGuards.frequentHashtags) || []).map(item => item.value);
  const opening = firstLine(candidate.caption);
  let score = 100;

  if (recentOpenings.includes(opening)) {
    score -= 30;
  }

  score -= overlapCount(candidate.hashtags, recentHashtags) * 8;
  score -= Math.max(0, candidate.hashtags.length - 4) * 2;
  return score;
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const currentDir = path.join(runtimeDir, 'current');
  const candidatesPath = path.join(currentDir, 'caption_candidates.json');
  const continuityPath = path.join(currentDir, 'continuity_snapshot.json');
  const selectionReviewPath = path.join(currentDir, 'caption_selection_review.json');

  const candidatesDoc = readJsonRequired(candidatesPath, 'caption candidates');
  if (!candidatesDoc || !Array.isArray(candidatesDoc.candidates) || candidatesDoc.candidates.length === 0) {
    throw new Error(`No caption candidates found: ${candidatesPath}`);
  }

  const continuity = readJsonOptional(continuityPath, {});
  const selectionReview = readJsonOptional(selectionReviewPath, {});
  const preferredId = String(selectionReview.selectedCandidateId || '').trim();
  const scored = candidatesDoc.candidates.map(candidate => ({
    candidate,
    score: scoreCandidate(candidate, continuity) + (candidate.id === preferredId ? 15 : 0)
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const selectionReason = preferredId && best.candidate.id === preferredId
    ? `Selected by creative review plus novelty-aware scoring. score=${best.score}. review=${selectionReview.reason || 'preferred candidate'}`
    : `Selected by novelty-aware scoring. score=${best.score}`;

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: candidatesDoc.scenePlanRunId || null,
    selectedCandidateId: best.candidate.id,
    selectionReason,
    caption: best.candidate.caption,
    hashtags: best.candidate.hashtags,
    candidateAngle: best.candidate.angle,
    candidateRationale: best.candidate.rationale,
    creativeReview: preferredId
      ? {
          selectedCandidateId: preferredId,
          reason: String(selectionReview.reason || '').trim(),
          strengths: selectionReview.strengths || [],
          risks: selectionReview.risks || []
        }
      : null
  };

  const written = writeRuntimeArtifact(runtimeDir, 'selected_caption.json', 'selectedcaption', output);
  console.log(`selected caption created: ${written.currentPath}`);
  console.log(`selected caption archived: ${written.archivedPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  firstLine,
  overlapCount,
  scoreCandidate
};
