const path = require('path');
const {
  fileExists,
  parseArgs,
  readJsonOptional,
  resolveRelative,
  writeRuntimeArtifact
} = require('./lib/runtime');
const { loadEnvValue } = require('./lib/creative_llm');

function hasChinese(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''));
}

function firstLine(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean) || '';
}

function listLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function addCheck(report, passed, severity, code, message) {
  if (passed) {
    report.passed.push({ code, message });
    return;
  }
  report[severity === 'warning' ? 'warnings' : 'errors'].push({ code, message });
}

function checkSource(report, label, doc, requireSkillSource) {
  const source = String(doc?.source || '').trim() || 'missing';
  const status = String(doc?.status || '').trim() || 'missing';
  const severity = requireSkillSource ? 'error' : 'warning';
  addCheck(report, source !== 'missing', 'error', `${label}_source_present`, `${label} should record its source.`);
  addCheck(report, status !== 'missing', 'error', `${label}_status_present`, `${label} should record its status.`);
  addCheck(
    report,
    !requireSkillSource || source === 'skill',
    severity,
    `${label}_source_skill`,
    requireSkillSource
      ? `${label} should come from the live creative model, not fallback.`
      : `${label} may fall back because no creative API key is available.`
  );
}

function validateCandidateSet(report, label, candidates, maxChars, maxHashtags) {
  addCheck(report, Array.isArray(candidates) && candidates.length >= 3, 'error', `${label}_count`, `${label} should contain at least three candidates.`);
  const openings = new Set();
  for (const candidate of candidates || []) {
    const caption = String(candidate.caption || '').trim();
    const opening = firstLine(caption);
    const hashtags = Array.isArray(candidate.hashtags) ? candidate.hashtags : [];
    openings.add(opening);
    addCheck(report, hasChinese(caption), 'error', `${label}_${candidate.id}_chinese`, `${label} candidate ${candidate.id} should be Chinese.`);
    addCheck(report, Array.from(caption).length <= maxChars, 'error', `${label}_${candidate.id}_length`, `${label} candidate ${candidate.id} should stay within ${maxChars} characters.`);
    addCheck(report, hashtags.length <= maxHashtags, 'error', `${label}_${candidate.id}_hashtags`, `${label} candidate ${candidate.id} should stay within ${maxHashtags} hashtags.`);
  }
  addCheck(report, openings.size >= 3, 'error', `${label}_distinct_openings`, `${label} should keep distinct opening lines.`);
}

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJsonOptional(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const currentDir = path.join(runtimeDir, 'current');
  const creativeModelPath = resolveRelative(configPath, './creative_model.json');
  const creativeModel = readJsonOptional(creativeModelPath, {});
  const apiKeyPresent = creativeModel.envName
    ? Boolean(loadEnvValue(creativeModel.envName))
    : false;

  const continuityReview = readJsonOptional(path.join(currentDir, 'continuity_creative_review.json'), {});
  const noveltyLedger = readJsonOptional(path.join(currentDir, 'novelty_ledger.json'), {});
  const reflectionNotes = readJsonOptional(path.join(currentDir, 'reflection_notes.json'), {});
  const worldStateSnapshot = readJsonOptional(path.join(currentDir, 'world_state_snapshot.json'), {});
  const affordancePool = readJsonOptional(path.join(currentDir, 'affordance_pool.json'), {});
  const worldGraphSnapshot = readJsonOptional(path.join(currentDir, 'world_graph_snapshot.json'), {});
  const activationMap = readJsonOptional(path.join(currentDir, 'activation_map.json'), {});
  const situationHypotheses = readJsonOptional(path.join(currentDir, 'situation_hypotheses_ai.json'), {});
  const validatedSituationHypotheses = readJsonOptional(path.join(currentDir, 'validated_situation_hypotheses.json'), {});
  const semanticRepeatCritic = readJsonOptional(path.join(currentDir, 'semantic_repeat_critic.json'), {});
  const scenePlanCandidates = readJsonOptional(path.join(currentDir, 'scene_plan_candidates.json'), {});
  const selectedSceneCandidate = readJsonOptional(path.join(currentDir, 'selected_scene_candidate.json'), {});
  const scenePlanDraft = readJsonOptional(path.join(currentDir, 'scene_plan_draft.json'), {});
  const programInstance = readJsonOptional(path.join(currentDir, 'program_instance_ai.json'), {});
  const scenePlan = readJsonOptional(path.join(currentDir, 'scene_plan.json'), {});
  const captionBriefDraft = readJsonOptional(path.join(currentDir, 'caption_brief_draft.json'), {});
  const captionBrief = readJsonOptional(path.join(currentDir, 'caption_brief.json'), {});
  const captionCandidatesAi = readJsonOptional(path.join(currentDir, 'caption_candidates_ai.json'), {});
  const captionCandidates = readJsonOptional(path.join(currentDir, 'caption_candidates.json'), {});
  const captionSelectionReview = readJsonOptional(path.join(currentDir, 'caption_selection_review.json'), {});
  const selectedCaption = readJsonOptional(path.join(currentDir, 'selected_caption.json'), {});

  const report = {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    apiKeyPresent,
    errors: [],
    warnings: [],
    passed: []
  };

  const requiredFiles = [
    'continuity_creative_review.json',
    'novelty_ledger.json',
    'reflection_notes.json',
    'world_state_snapshot.json',
    'affordance_pool.json',
    'world_graph_snapshot.json',
    'activation_map.json',
    'situation_hypotheses_ai.json',
    'validated_situation_hypotheses.json',
    'semantic_repeat_critic.json',
    'scene_plan_candidates.json',
    'selected_scene_candidate.json',
    'program_instance_ai.json',
    'scene_plan_draft.json',
    'scene_plan.json',
    'caption_brief_draft.json',
    'caption_brief.json',
    'caption_candidates_ai.json',
    'caption_candidates.json',
    'caption_selection_review.json',
    'selected_caption.json'
  ];

  for (const fileName of requiredFiles) {
    addCheck(
      report,
      fileExists(path.join(currentDir, fileName)),
      'error',
      `${fileName}_exists`,
      `${fileName} should exist in runtime/current.`
    );
  }

  checkSource(report, 'continuity_review', continuityReview, apiKeyPresent);
  addCheck(report, listLength(continuityReview.freshnessTargets) >= 2, 'error', 'continuity_review_freshness', 'Continuity review should provide at least two freshness targets.');
  addCheck(report, listLength(continuityReview.captionAdvice) >= 1, 'error', 'continuity_review_caption_advice', 'Continuity review should provide caption advice.');
  addCheck(report, listLength(continuityReview.imageAdvice) >= 1, 'error', 'continuity_review_image_advice', 'Continuity review should provide image advice.');

  addCheck(report, listLength(noveltyLedger.recentEntries) >= 1, 'warning', 'novelty_ledger_recent_entries', 'Novelty ledger should track at least one recent semantic entry.');
  addCheck(report, noveltyLedger.counts && Object.keys(noveltyLedger.counts).length >= 5, 'error', 'novelty_ledger_counts', 'Novelty ledger should track multiple semantic dimensions.');
  addCheck(report, listLength(reflectionNotes.guidanceNotes) >= 1, 'warning', 'reflection_notes_guidance', 'Reflection notes should offer at least one guidance note.');
  addCheck(report, String(worldStateSnapshot?.timeContext?.daypart || '').trim().length > 0, 'error', 'world_state_daypart', 'World state should expose a typed daypart.');
  addCheck(report, String(worldStateSnapshot?.environment?.mobilityWindow || '').trim().length > 0, 'error', 'world_state_mobility', 'World state should expose a mobility window.');
  addCheck(report, listLength(worldStateSnapshot?.characterState?.needState) >= 1, 'error', 'world_state_need_state', 'World state should expose at least one need-state.');
  addCheck(report, listLength(affordancePool.affordances) >= 3, 'error', 'affordance_pool_count', 'Affordance pool should surface at least three affordances.');
  addCheck(report, listLength(worldGraphSnapshot.placeNodes) >= 3, 'error', 'world_graph_places', 'World graph should expose activated place nodes.');
  addCheck(report, listLength(worldGraphSnapshot.objectNodes) >= 3, 'error', 'world_graph_objects', 'World graph should expose activated object nodes.');
  addCheck(report, listLength(worldGraphSnapshot.programNodes) >= 3, 'error', 'world_graph_programs', 'World graph should expose activated program nodes.');
  addCheck(report, listLength(activationMap.activatedSeeds) >= 3, 'error', 'activation_map_seeds', 'Activation map should provide multiple situation seeds.');
  checkSource(report, 'situation_hypotheses', situationHypotheses, apiKeyPresent);
  addCheck(report, listLength(situationHypotheses.hypotheses) >= 3, 'error', 'situation_hypotheses_count', 'Situation hypotheses should provide multiple structured options.');
  addCheck(report, listLength(validatedSituationHypotheses.acceptedHypotheses) >= 3, 'error', 'validated_situation_hypotheses_count', 'Validated situation hypotheses should keep at least three selectable options.');
  checkSource(report, 'semantic_repeat_critic', semanticRepeatCritic, apiKeyPresent);
  addCheck(report, listLength(semanticRepeatCritic.critiques) >= 3, 'error', 'semantic_repeat_critic_count', 'Semantic repeat critic should cover the situation set.');
  addCheck(report, listLength(scenePlanCandidates.candidates) >= 3, 'error', 'scene_plan_candidates_count', 'Scene plan candidates should contain at least three semantic candidates.');
  addCheck(report, ['code', 'hybrid'].includes(String(scenePlanCandidates.source || '').trim()), 'error', 'scene_plan_candidates_source', 'Scene plan candidates should be produced by a code-owned or hybrid planner.');
  addCheck(report, String(selectedSceneCandidate.selectedCandidateId || '').trim().length > 0, 'error', 'selected_scene_candidate_id', 'Selected scene candidate should record the chosen candidate id.');
  addCheck(
    report,
    new Set((scenePlanCandidates.candidates || []).map(candidate => candidate.candidateId)).has(selectedSceneCandidate.selectedCandidateId),
    'error',
    'selected_scene_candidate_exists',
    'Selected scene candidate should refer to an existing candidate.'
  );
  checkSource(report, 'program_instance', programInstance, apiKeyPresent);
  addCheck(report, listLength(programInstance.actionBeats) === 3, 'error', 'program_instance_action_beats', 'Program instance should define three action beats.');
  addCheck(report, String(programInstance.sceneProgramId || '').trim().length > 0, 'error', 'program_instance_scene_program', 'Program instance should record its scene program id.');

  checkSource(report, 'scene_plan_draft', scenePlanDraft, apiKeyPresent);
  addCheck(report, String(scenePlanDraft.narrativePremise || '').trim().length > 0, 'error', 'scene_plan_draft_premise', 'Scene plan draft should provide a narrative premise.');
  addCheck(report, listLength(scenePlanDraft.microPlot) === 3, 'error', 'scene_plan_draft_micro_plot', 'Scene plan draft should provide a three-step micro-plot.');
  addCheck(report, listLength(scenePlanDraft.sceneNotes) >= 2, 'error', 'scene_plan_draft_scene_notes', 'Scene plan draft should provide scene notes.');

  addCheck(report, String(scenePlan.runId || '').trim().length > 0, 'error', 'scene_plan_run_id', 'Scene plan should have a run id.');
  addCheck(report, String(scenePlan?.creativeDirection?.sourceStatus?.scenePlanDraft || '').trim() !== 'missing', 'error', 'scene_plan_creative_source', 'Scene plan should record creative draft source status.');
  addCheck(report, listLength(scenePlan?.narrative?.microPlot) === 3, 'error', 'scene_plan_micro_plot', 'Scene plan should keep a three-step micro-plot.');
  addCheck(report, listLength(scenePlan?.visual?.sceneNotes) >= 4, 'error', 'scene_plan_scene_notes', 'Scene plan should include layered scene notes.');
  addCheck(report, String(scenePlan?.sceneSemantics?.sceneProgramId || '').trim().length > 0, 'error', 'scene_plan_scene_program', 'Scene plan should expose a scene program id.');
  addCheck(report, String(scenePlan?.sceneSemantics?.hypothesisId || '').trim().length > 0, 'error', 'scene_plan_hypothesis_id', 'Scene plan should expose the selected situation hypothesis id.');
  addCheck(report, String(scenePlan?.sceneSemantics?.locationArchetype || '').trim().length > 0, 'error', 'scene_plan_location_archetype', 'Scene plan should expose a location archetype.');
  addCheck(report, listLength(scenePlan?.sceneSemantics?.objectBindings) >= 1, 'error', 'scene_plan_object_bindings', 'Scene plan should expose object bindings.');
  addCheck(report, String(scenePlan?.sceneSemantics?.weatherRole || '').trim().length > 0, 'error', 'scene_plan_weather_role', 'Scene plan should expose a weather role.');
  addCheck(report, String(scenePlan?.sceneSemantics?.emotionalLanding || '').trim().length > 0, 'error', 'scene_plan_emotional_landing', 'Scene plan should expose an emotional landing.');

  checkSource(report, 'caption_brief_draft', captionBriefDraft, apiKeyPresent);
  addCheck(report, String(captionBriefDraft.goal || '').trim().length > 0, 'error', 'caption_brief_draft_goal', 'Caption brief draft should define a goal.');
  addCheck(report, listLength(captionBriefDraft.openingMoves) >= 2, 'error', 'caption_brief_draft_opening_moves', 'Caption brief draft should provide opening moves.');
  addCheck(report, listLength(captionBriefDraft.mustInclude) >= 3, 'error', 'caption_brief_draft_must_include', 'Caption brief draft should provide must-include guidance.');

  addCheck(report, String(captionBrief.goal || '').trim().length > 0, 'error', 'caption_brief_goal', 'Caption brief should define a goal.');
  addCheck(report, listLength(captionBrief.writingDirectives) >= 6, 'error', 'caption_brief_directives', 'Caption brief should have enough writing directives.');
  addCheck(report, String(captionBrief?.creativeInputs?.sourceStatus || '').trim() !== 'missing', 'error', 'caption_brief_creative_source', 'Caption brief should record creative draft status.');
  addCheck(report, String(captionBrief?.contentBlocks?.sceneSemantics?.sceneProgramId || '').trim().length > 0, 'error', 'caption_brief_scene_semantics', 'Caption brief should carry scene semantics.');

  const maxChars = Number(scenePlan?.caption?.limits?.targetMaxChars || 180);
  const maxHashtags = Number(scenePlan?.caption?.limits?.maxHashtags || 5);
  checkSource(report, 'caption_candidates_ai', captionCandidatesAi, apiKeyPresent);
  validateCandidateSet(report, 'caption_candidates_ai', captionCandidatesAi.candidates || [], maxChars, maxHashtags);

  addCheck(report, String(captionCandidates.source || '').trim().length > 0, 'error', 'caption_candidates_source', 'Validated caption candidates should record their source.');
  addCheck(report, String(captionCandidates.sourceStatus || '').trim().length > 0, 'error', 'caption_candidates_status', 'Validated caption candidates should record their source status.');
  validateCandidateSet(report, 'caption_candidates', captionCandidates.candidates || [], maxChars, maxHashtags);

  checkSource(report, 'caption_selection_review', captionSelectionReview, apiKeyPresent);
  const validIds = new Set((captionCandidates.candidates || []).map(candidate => candidate.id));
  addCheck(report, validIds.has(captionSelectionReview.selectedCandidateId), 'error', 'caption_selection_review_id', 'Selection review should choose an existing candidate id.');
  addCheck(report, listLength(captionSelectionReview.strengths) >= 1, 'error', 'caption_selection_review_strengths', 'Selection review should explain strengths.');

  addCheck(report, validIds.has(selectedCaption.selectedCandidateId), 'error', 'selected_caption_id', 'Selected caption should point to a validated candidate id.');
  addCheck(report, hasChinese(selectedCaption.caption), 'error', 'selected_caption_chinese', 'Selected caption should be Chinese.');
  addCheck(report, listLength(selectedCaption.hashtags) <= maxHashtags, 'error', 'selected_caption_hashtags', 'Selected caption should respect hashtag limits.');
  addCheck(
    report,
    !apiKeyPresent || selectedCaption.creativeReview !== null,
    apiKeyPresent ? 'error' : 'warning',
    'selected_caption_creative_review',
    apiKeyPresent
      ? 'Selected caption should carry creative review metadata when the API is available.'
      : 'Creative review metadata is optional when the API is unavailable.'
  );
  addCheck(report, String(readJsonOptional(path.join(currentDir, 'image_brief.json'), {})?.semanticBindings?.sceneProgramId || '').trim().length > 0, 'error', 'image_brief_semantic_bindings', 'Image brief should expose semantic bindings.');
  addCheck(report, String(readJsonOptional(path.join(currentDir, 'image_request.json'), {})?.sceneSemantics?.sceneProgramId || '').trim().length > 0, 'error', 'image_request_scene_semantics', 'Image request should carry scene semantics.');

  const output = {
    version: report.version,
    createdAt: report.createdAt,
    apiKeyPresent,
    status: report.errors.length === 0 ? 'creative_intelligence_ready' : 'creative_intelligence_gap',
    summary: {
      passedChecks: report.passed.length,
      warningCount: report.warnings.length,
      errorCount: report.errors.length
    },
    errors: report.errors,
    warnings: report.warnings,
    passed: report.passed
  };

  const written = writeRuntimeArtifact(runtimeDir, 'creative_intelligence_validation.json', 'creativevalidation', output);
  console.log(`creative validation created: ${written.currentPath}`);
  console.log(`creative validation archived: ${written.archivedPath}`);
  console.log(JSON.stringify(output, null, 2));

  if (report.errors.length > 0) {
    process.exit(1);
  }
}

main();
