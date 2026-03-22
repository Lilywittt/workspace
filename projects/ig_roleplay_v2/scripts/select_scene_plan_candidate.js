const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  readJsonRequired,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { selectScenePlanCandidate } = require('./lib/scene_programs');

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const currentDir = path.join(runtimeDir, 'current');
  const candidateSet = readJsonRequired(path.join(currentDir, 'scene_plan_candidates.json'), 'scene plan candidates');
  const selection = selectScenePlanCandidate(candidateSet.candidates || []);
  const selected = selection.selected;

  if (!selected) {
    throw new Error('No scene plan candidates available for selection.');
  }

  const output = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    source: 'code',
    status: 'selected_scene_candidate_ready',
    selectedCandidateId: selected.candidateId,
    selectionReason: `Selected ${selected.sceneProgramId} because it balanced novelty ${selected.scores.novelty}, feasibility ${selected.scores.feasibility}, and persona fit ${selected.scores.personaFit}.`,
    selectedCandidate: selected,
    rankedCandidates: selection.ranked.map(candidate => ({
      candidateId: candidate.candidateId,
      sceneProgramId: candidate.sceneProgramId,
      totalScore: candidate.scores.total,
      locationArchetype: candidate.locationArchetype,
      objectFamily: candidate.objectFamily,
      weatherRole: candidate.weatherRole,
      emotionalLanding: candidate.emotionalLanding
    }))
  };

  const written = writeRuntimeArtifact(runtimeDir, 'selected_scene_candidate.json', 'selectedscenecandidate', output);
  console.log(`selected scene candidate created: ${written.currentPath}`);
  console.log(`selected scene candidate archived: ${written.archivedPath}`);
}

main();
