const path = require('path');
const {
  parseArgs,
  readJsonOptional,
  runtimeCurrentDir,
  runtimeFinalCurrentDir,
  writeRuntimeArtifact
} = require('../src/common/runtime');
const { loadAgentConfig, defaultConfigPath } = require('../src/agent/config');

function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : defaultConfigPath();
  const agent = loadAgentConfig(configPath);
  const currentDir = runtimeCurrentDir(agent.runtimeDir);
  const finalCurrentDir = runtimeFinalCurrentDir(agent.runtimeDir);

  const dayContext = readJsonOptional(path.join(currentDir, 'day_context.json'), {});
  const ambientSignalPool = readJsonOptional(path.join(currentDir, 'ambient_signal_pool.json'), {});
  const ambientStimulusPacket = readJsonOptional(path.join(currentDir, 'ambient_stimulus_packet.json'), {});
  const characterRuntime = readJsonOptional(path.join(currentDir, 'character_runtime_snapshot.json'), {});
  const contentIntent = readJsonOptional(path.join(currentDir, 'content_intent.json'), {});
  const captureIntent = readJsonOptional(path.join(currentDir, 'capture_intent.json'), {});
  const outfitIntent = readJsonOptional(path.join(currentDir, 'outfit_intent.json'), {});
  const outfitPlan = readJsonOptional(path.join(currentDir, 'outfit_plan.json'), {});
  const externalEventPacket = readJsonOptional(path.join(currentDir, 'external_event_packet.json'), {});
  const selectedMoment = readJsonOptional(path.join(currentDir, 'selected_moment.json'), {});
  const selectedCaption = readJsonOptional(path.join(currentDir, 'selected_caption.json'), {});
  const imageStyleProfile = readJsonOptional(path.join(currentDir, 'image_style_profile.json'), {});
  const imageIntent = readJsonOptional(path.join(currentDir, 'image_intent.json'), {});
  const imageRequest = readJsonOptional(path.join(currentDir, 'image_request.json'), {});
  const generatedImage = readJsonOptional(path.join(currentDir, 'generated_image.json'), {});
  const postPackage = readJsonOptional(path.join(currentDir, 'post_package.json'), {});
  const publishResult = readJsonOptional(path.join(currentDir, 'publish_result.json'), {});
  const finalDelivery = readJsonOptional(path.join(finalCurrentDir, 'final_delivery.json'), {});
  const validation = readJsonOptional(path.join(currentDir, 'zero_memory_pipeline_validation.json'), {});

  const runId = validation.runId || selectedMoment.runId || postPackage.scenePlanRunId || `summary-${Date.now()}`;
  const summary = {
    version: '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    runId,
    mode: 'zero_memory_agent',
    scenarioId: validation.scenarioId || dayContext.scenarioId || '',
    dayContext: {
      isoDate: dayContext?.date?.isoDate || '',
      routineWindow: dayContext?.time?.routineWindow || '',
      weather: dayContext?.weather?.summary || '',
      currentContext: dayContext?.location?.currentContext || ''
    },
    ambient: {
      poolSize: (ambientSignalPool.items || []).length,
      packetSize: (ambientStimulusPacket.items || []).length,
      categories: ambientStimulusPacket.categoriesRepresented || []
    },
    externalWorldState: {
      activeEventIds: externalEventPacket.activeEventIds || [],
      worldStateNotes: externalEventPacket.worldStateNotes || []
    },
    characterState: {
      mood: characterRuntime?.currentState?.mood || '',
      preferredLane: characterRuntime?.postingTendency?.preferredLane || '',
      whyPostToday: characterRuntime?.postingTendency?.whyPostToday || ''
    },
    contentIntent: {
      lane: contentIntent?.lane || '',
      characterPresenceTarget: contentIntent?.characterPresenceTarget || '',
      sourceMode: contentIntent?.sourceMode || ''
    },
    captureIntent: {
      lane: captureIntent?.lane || '',
      sourceMode: captureIntent?.sourceMode || '',
      summaryEn: captureIntent?.summaryEn || '',
      resolvedTarget: captureIntent?.resolvedTarget || {}
    },
    outfit: {
      sourceMode: outfitIntent?.sourceMode || outfitPlan?.sourceMode || '',
      manualOverrideProvided: Boolean(outfitIntent?.manualOverrideProvided),
      outfitSummaryEn: outfitPlan?.outfitSummaryEn || '',
      weatherResponseEn: outfitPlan?.weatherResponseEn || '',
      sceneFitEn: outfitPlan?.sceneFitEn || ''
    },
    selectedMoment: {
      summaryZh: selectedMoment?.eventSummaryZh || '',
      characterPresenceTarget: selectedMoment?.characterPresenceTarget || contentIntent?.characterPresenceTarget || '',
      selectionMode: selectedMoment?.selectionMode || '',
      selectionReasonZh: selectedMoment?.selectionReasonZh || ''
    },
    caption: {
      text: selectedCaption?.caption || '',
      hashtags: selectedCaption?.hashtags || []
    },
    image: {
      mode: imageIntent?.imageMode || imageRequest?.generationMode || '',
      characterPresenceTarget: imageIntent?.characterPresenceTarget || contentIntent?.characterPresenceTarget || '',
      captureSummaryEn: imageIntent?.captureSummaryEn || imageRequest?.reviewSignals?.captureSummaryEn || captureIntent?.summaryEn || '',
      renderStyleSummaryEn: imageRequest?.reviewSignals?.renderStyleSummaryEn || imageStyleProfile?.styleSummaryEn || '',
      styleProfileId: imageStyleProfile?.profileId || '',
      requestStatus: imageRequest?.status || '',
      generatedStatus: generatedImage?.status || '',
      referencePlan: imageRequest?.referencePlan || {},
      reviewSignals: imageRequest?.reviewSignals || {},
      referenceHandling: generatedImage?.requestSummary?.referenceHandling || imageRequest?.referenceHandling || {},
      localFilePath: generatedImage?.localFilePath || '',
      imageUrl: generatedImage?.imageUrl || ''
    },
    release: {
      postReadiness: postPackage?.publish?.readiness || '',
      publishStatus: publishResult?.status || '',
      blockers: postPackage?.publish?.blockers || []
    },
    finalDelivery: {
      deliveryId: finalDelivery?.deliveryId || '',
      publishable: Boolean(finalDelivery?.deliveryReadiness?.publishable),
      reviewRootDir: finalDelivery?.reviewBundle?.rootDir || '',
      reviewGuidePath: finalDelivery?.reviewBundle?.reviewGuidePath || '',
      finalCaptionPath: finalDelivery?.caption?.fullTextPath || '',
      finalImagePath: finalDelivery?.image?.localFilePath || '',
      finalImageUrl: finalDelivery?.image?.imageUrl || ''
    },
    stageSources: validation.stageSources || {}
  };

  const written = writeRuntimeArtifact(agent.runtimeDir, 'run_summary.json', 'zeromemorysummary', summary, { runId });
  console.log(`zero-memory run summary created: ${written.currentPath}`);
  console.log(`zero-memory run summary archived: ${written.archivedPath}`);
}

main();
