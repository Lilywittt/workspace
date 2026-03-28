function buildDeliveryReadiness(postPackage = {}, generatedImage = {}) {
  const publish = postPackage.publish || {};
  const blockers = Array.isArray(publish.blockers) ? publish.blockers : [];
  const hasCaption = String(postPackage.fullCaptionText || '').trim().length > 0;
  const hasLocalImage = String(generatedImage.localFilePath || '').trim().length > 0;
  const hasImageUrl = String(generatedImage.imageUrl || postPackage?.image?.imageUrl || '').trim().length > 0;
  const readyByPostPackage = String(publish.readiness || '').trim() === 'ready_for_dry_run_or_publish';
  const publishable = readyByPostPackage && hasCaption && hasLocalImage && hasImageUrl && blockers.length === 0;

  return {
    publishable,
    readiness: String(publish.readiness || '').trim() || 'unknown',
    releaseStage: String(publish.releaseStage || '').trim() || 'unknown',
    blockers,
    hasCaption,
    hasLocalImage,
    hasImageUrl
  };
}

function buildPromptToImageDiagnosis({
  generatedImage,
  momentPackage,
  imageRequest,
  imagePath,
  sourcePaths
}) {
  const promptPackage = imageRequest?.promptPackage || {};

  return {
    required: true,
    goal: 'Compare the final rendered image against the exact provider prompt before any optimization or prompt edits.',
    finalImagePath: imagePath || generatedImage?.localFilePath || '',
    provider: generatedImage?.provider || '',
    model: generatedImage?.model || '',
    promptSnapshot: {
      positivePrompt: String(promptPackage?.positivePrompt || '').trim(),
      negativePrompt: String(promptPackage?.negativePrompt || '').trim(),
      shotNotes: Array.isArray(promptPackage?.shotNotes) ? promptPackage.shotNotes : [],
      structuralShot: promptPackage?.structuralShot || null
    },
    groundingSnapshot: {
      selectedMomentSummaryZh: momentPackage?.livedEvent?.summaryZh || '',
      visualMustShow: Array.isArray(momentPackage?.visualEvidence?.mustShow) ? momentPackage.visualEvidence.mustShow : [],
      outfitPromptCuesEn: Array.isArray(momentPackage?.outfit?.promptCuesEn) ? momentPackage.outfit.promptCuesEn : [],
      captureSummaryEn: imageRequest?.reviewSignals?.captureSummaryEn || '',
      shotBlueprintSummaryEn: imageRequest?.reviewSignals?.shotBlueprintSummaryEn || '',
      shotBlueprintPoseFamily: imageRequest?.reviewSignals?.shotBlueprintPoseFamily || '',
      shotHandBudgetEn: imageRequest?.reviewSignals?.shotHandBudgetEn || ''
    },
    traceBackPaths: {
      finalImagePath: imagePath || generatedImage?.localFilePath || '',
      imageRequestPath: sourcePaths?.imageRequestPath || '',
      momentPackagePath: sourcePaths?.momentPackagePath || '',
      scenePlanPath: sourcePaths?.scenePlanPath || '',
      selectedMomentPath: sourcePaths?.selectedMomentPath || '',
      generatedImagePath: sourcePaths?.generatedImagePath || ''
    },
    comparisonChecklist: [
      'What exactly is wrong in the final image, stated as visible evidence rather than a vague impression?',
      'Which exact positive-prompt line, structural shot field, or hand-budget rule matches or conflicts with that visible result?',
      'Does the failure already exist in the selected moment, moment package, or image_request prompt, or was it introduced only by the provider output?',
      'If anatomy, age, outfit, or third-person errors appear, are they caused by prompt ambiguity, cue contamination, or a provider-side rendering failure despite a clean prompt?',
      'What is the smallest upstream mechanism change that would prevent this failure mode without freezing the product into a new rigid template?'
    ],
    rootCauseTaxonomy: [
      'prompt ambiguity or over-compression',
      'upstream cue contamination from a mismatched moment family',
      'structural shot or hand-budget mismatch already present in image_request',
      'provider-side anatomy or composition failure despite a clean prompt',
      'identity or age lock too weak for the selected crop',
      'outfit or background detail over-specification crowding out the main action'
    ]
  };
}

function buildFinalDelivery({
  config,
  deliveryId,
  scenePlan,
  selectedCaption,
  generatedImage,
  momentPackage,
  imageRequest,
  validation,
  postPackage,
  publishResult,
  captionTextPath,
  imagePath,
  sourcePaths
}) {
  const image = postPackage?.image || {};
  const readiness = buildDeliveryReadiness(postPackage, generatedImage);

  return {
    version: config.version || '3.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    deliveryId,
    scenePlanRunId: scenePlan?.runId || postPackage?.scenePlanRunId || null,
    lane: scenePlan?.lane || postPackage?.lane || 'life_record',
    deliveryReadiness: readiness,
    caption: {
      text: selectedCaption?.caption || postPackage?.caption || '',
      hashtags: selectedCaption?.hashtags || postPackage?.hashtags || [],
      fullText: postPackage?.fullCaptionText || '',
      fullTextPath: captionTextPath
    },
    image: {
      provider: generatedImage?.provider || image?.provider || null,
      model: generatedImage?.model || image?.model || null,
      providerEndpoint: generatedImage?.providerRequest?.endpoint || image?.providerEndpoint || null,
      localFilePath: imagePath || null,
      sourceLocalFilePath: generatedImage?.localFilePath || null,
      imageUrl: generatedImage?.imageUrl || image?.imageUrl || '',
      assetFilenameHint: generatedImage?.providerRequest?.assetFilenameHint || image?.assetFilenameHint || null,
      providerRequestId: generatedImage?.providerRequestId || image?.providerRequestId || null,
      altText: generatedImage?.requestSummary?.altText || image?.altText || ''
    },
    publishPayload: {
      caption: postPackage?.fullCaptionText || '',
      imageUrl: generatedImage?.imageUrl || image?.imageUrl || '',
      altText: generatedImage?.requestSummary?.altText || image?.altText || ''
    },
    creativeSignals: {
      selectedMoment: {
        summaryZh: momentPackage?.livedEvent?.summaryZh || scenePlan?.narrative?.premise || '',
        whyShareableZh: momentPackage?.postIntent?.whyShareableZh || '',
        characterPresenceTarget: imageRequest?.reviewSignals?.characterPresenceTarget
          || momentPackage?.postIntent?.characterPresenceTarget
          || ''
      },
      outfit: {
        applied: Boolean(momentPackage?.outfit?.outfitSummaryEn),
        sourceMode: momentPackage?.outfit?.sourceMode || '',
        manualOverrideApplied: Boolean(momentPackage?.outfit?.manualOverrideApplied),
        outfitSummaryEn: momentPackage?.outfit?.outfitSummaryEn || '',
        promptCuesEn: momentPackage?.outfit?.promptCuesEn || [],
        weatherResponseEn: momentPackage?.outfit?.weatherResponseEn || '',
        sceneFitEn: momentPackage?.outfit?.sceneFitEn || ''
      },
      imageDirection: {
        generationMode: imageRequest?.generationMode || '',
        captureSummaryEn: imageRequest?.reviewSignals?.captureSummaryEn || '',
        renderStyleSummaryEn: imageRequest?.reviewSignals?.renderStyleSummaryEn || '',
        unresolvedIdentityReference: Boolean(imageRequest?.reviewSignals?.unresolvedIdentityReference)
      },
      stageSources: validation?.stageSources || {}
    },
    source: {
      momentPackagePath: sourcePaths?.momentPackagePath || '',
      imageRequestPath: sourcePaths?.imageRequestPath || '',
      scenePlanPath: sourcePaths?.scenePlanPath || '',
      selectedMomentPath: sourcePaths?.selectedMomentPath || '',
      validationPath: sourcePaths?.validationPath || '',
      postPackagePath: sourcePaths?.postPackagePath || '',
      generatedImagePath: sourcePaths?.generatedImagePath || '',
      publishResultPath: sourcePaths?.publishResultPath || '',
      lastKnownPublishStatus: String(publishResult?.status || '').trim() || ''
    },
    diagnostics: {
      promptToImage: buildPromptToImageDiagnosis({
        generatedImage,
        momentPackage,
        imageRequest,
        imagePath,
        sourcePaths
      })
    }
  };
}

function buildImageDiagnosisReportText(delivery = {}) {
  const diagnosis = delivery?.diagnostics?.promptToImage || {};
  const promptSnapshot = diagnosis?.promptSnapshot || {};
  const groundingSnapshot = diagnosis?.groundingSnapshot || {};
  const traceBackPaths = diagnosis?.traceBackPaths || {};
  const structuralShotText = promptSnapshot?.structuralShot
    ? JSON.stringify(promptSnapshot.structuralShot, null, 2)
    : 'null';

  return [
    'IG Roleplay V2 Prompt-to-Image Diagnosis',
    'IG Roleplay V2 生图结果与 Prompt 对照诊断',
    '',
    'Purpose:',
    diagnosis?.goal || '',
    '',
    `Final image: ${diagnosis?.finalImagePath || ''}`,
    `Provider: ${diagnosis?.provider || ''}`,
    `Model: ${diagnosis?.model || ''}`,
    `Diagnosis report: ${diagnosis?.reportPath || ''}`,
    '',
    'Compare in this order before any optimization:',
    `1. ${traceBackPaths?.finalImagePath || ''}`,
    `2. ${traceBackPaths?.imageRequestPath || ''}`,
    `3. ${traceBackPaths?.momentPackagePath || ''}`,
    `4. ${traceBackPaths?.scenePlanPath || ''}`,
    `5. ${traceBackPaths?.selectedMomentPath || ''}`,
    '',
    'Mandatory questions:',
    ...((diagnosis?.comparisonChecklist || []).map((item, index) => `${index + 1}. ${item}`)),
    '',
    'Root-cause taxonomy:',
    ...((diagnosis?.rootCauseTaxonomy || []).map(item => `- ${item}`)),
    '',
    'Grounding snapshot:',
    `- Selected moment: ${groundingSnapshot?.selectedMomentSummaryZh || ''}`,
    `- Visual must-show: ${(groundingSnapshot?.visualMustShow || []).join(' | ')}`,
    `- Outfit prompt cues: ${(groundingSnapshot?.outfitPromptCuesEn || []).join(' | ')}`,
    `- Capture summary: ${groundingSnapshot?.captureSummaryEn || ''}`,
    `- Shot blueprint summary: ${groundingSnapshot?.shotBlueprintSummaryEn || ''}`,
    `- Shot pose family: ${groundingSnapshot?.shotBlueprintPoseFamily || ''}`,
    `- Shot hand budget: ${groundingSnapshot?.shotHandBudgetEn || ''}`,
    '',
    'Exact Positive Prompt:',
    promptSnapshot?.positivePrompt || '',
    '',
    'Exact Negative Prompt:',
    promptSnapshot?.negativePrompt || '',
    '',
    'Structural Shot JSON:',
    structuralShotText,
    '',
    'Shot Notes:',
    ...((promptSnapshot?.shotNotes || []).length > 0
      ? promptSnapshot.shotNotes.map(item => `- ${item}`)
      : ['- none'])
  ].join('\n');
}

module.exports = {
  buildDeliveryReadiness,
  buildFinalDelivery,
  buildImageDiagnosisReportText
};
