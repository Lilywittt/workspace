function joinCaptionAndHashtags(caption, hashtags) {
  const normalized = (hashtags || []).filter(Boolean);
  if (normalized.length === 0) return caption;
  return `${String(caption || '').trim()}\n${normalized.join(' ')}`;
}

function buildReleaseAssessment(image) {
  if (image.source === 'v2_generated_image' && image.imageUrl) {
    return {
      readiness: 'ready_for_dry_run_or_publish',
      stage: 'image_ready',
      blockers: []
    };
  }

  if (image.source === 'v2_generated_image_local') {
    return {
      readiness: 'local_image_ready_public_url_missing',
      stage: 'local_image_ready',
      blockers: ['generated_image_public_url_missing']
    };
  }

  if (image.source === 'v2_generated_image_job') {
    if (image.requestStatus === 'provider_auth_failed') {
      return {
        readiness: 'caption_ready_image_provider_auth_failed',
        stage: 'image_provider_auth_failed',
        blockers: ['generated_image_provider_auth_failed']
      };
    }

    if (image.requestStatus === 'provider_credentials_missing') {
      return {
        readiness: 'caption_ready_image_provider_credentials_missing',
        stage: 'image_provider_credentials_missing',
        blockers: ['generated_image_provider_credentials_missing']
      };
    }

    if (image.requestStatus === 'provider_network_error') {
      return {
        readiness: 'caption_ready_image_provider_network_error',
        stage: 'image_provider_network_error',
        blockers: ['generated_image_provider_network_error']
      };
    }

    if (image.requestStatus === 'provider_request_failed') {
      return {
        readiness: 'caption_ready_image_provider_request_failed',
        stage: 'image_provider_request_failed',
        blockers: ['generated_image_provider_request_failed']
      };
    }

    if (image.requestStatus === 'generation_submitted') {
      return {
        readiness: 'caption_ready_image_generation_in_progress',
        stage: 'waiting_for_generated_image',
        blockers: ['generated_image_pending_remote_result']
      };
    }

    return {
      readiness: 'caption_ready_image_generation_not_started',
      stage: 'image_provider_payload_ready',
      blockers: ['generated_image_not_submitted']
    };
  }

  if (image.source === 'v2_image_request') {
    return {
      readiness: 'caption_ready_image_generation_pending',
      stage: 'image_request_ready',
      blockers: ['generated_image_missing']
    };
  }

  if (image.imageUrl) {
    return {
      readiness: 'ready_for_dry_run_or_publish',
      stage: 'legacy_image_ready',
      blockers: []
    };
  }

  return {
    readiness: 'caption_ready_image_url_missing',
    stage: 'image_missing',
    blockers: ['image_url_missing']
  };
}

function summarizeImageRequest(imageRequest) {
  return {
    source: 'v2_image_request',
    generationMode: imageRequest.generationMode || 'unknown',
    requestStatus: imageRequest.status || 'unknown',
    referenceIds: (imageRequest.references || []).map(ref => ref.id),
    referencePlan: imageRequest.referencePlan || {},
    aspectRatio: imageRequest?.renderPlan?.aspectRatio || '4:5',
    altText: imageRequest?.publishHints?.altText || '',
    imageUrl: '',
    referenceHandling: imageRequest?.referenceHandling || {},
    reviewSignals: imageRequest?.reviewSignals || {},
    note: 'V2 image request is ready, but final image generation has not been executed yet.'
  };
}

function summarizeGeneratedImage(generatedImage) {
  if (generatedImage.localFilePath && !generatedImage.imageUrl) {
    return {
      source: 'v2_generated_image_local',
      provider: generatedImage.provider || 'unknown',
      model: generatedImage.model || null,
      assetId: generatedImage.assetId || null,
      requestStatus: generatedImage.status || 'unknown',
      remoteJobId: generatedImage.remoteJobId || null,
      providerRequestId: generatedImage.providerRequestId || null,
      submissionMode: generatedImage?.providerRequest?.submissionMode || 'executed_sync',
      providerEndpoint: generatedImage?.providerRequest?.endpoint || null,
      assetFilenameHint: generatedImage?.providerRequest?.assetFilenameHint || null,
      altText: generatedImage?.requestSummary?.altText || '',
      referenceHandling: generatedImage?.requestSummary?.referenceHandling || {},
      reviewSignals: generatedImage?.requestSummary?.reviewSignals || generatedImage?.reviewSignals || {},
      localFilePath: generatedImage.localFilePath,
      latestFilePath: generatedImage.latestFilePath || null,
      imageUrl: '',
      note: 'A real image file exists locally, but a public image URL is not available yet.'
    };
  }

  if (generatedImage.imageUrl) {
    return {
      source: 'v2_generated_image',
      provider: generatedImage.provider || 'unknown',
      model: generatedImage.model || null,
      assetId: generatedImage.assetId || null,
      requestStatus: generatedImage.status || 'unknown',
      remoteJobId: generatedImage.remoteJobId || null,
      providerRequestId: generatedImage.providerRequestId || null,
      altText: generatedImage?.requestSummary?.altText || '',
      imageUrl: generatedImage.imageUrl || '',
      providerEndpoint: generatedImage?.providerRequest?.endpoint || null,
      assetFilenameHint: generatedImage?.providerRequest?.assetFilenameHint || null,
      referenceHandling: generatedImage?.requestSummary?.referenceHandling || {},
      reviewSignals: generatedImage?.requestSummary?.reviewSignals || generatedImage?.reviewSignals || {},
      note: 'A final image URL has been registered for the current V2 post package.'
    };
  }

  return {
    source: 'v2_generated_image_job',
    provider: generatedImage.provider || 'unknown',
    model: generatedImage.model || null,
    assetId: generatedImage.assetId || null,
    requestStatus: generatedImage.status || 'unknown',
    remoteJobId: generatedImage.remoteJobId || null,
    providerRequestId: generatedImage.providerRequestId || null,
    submissionMode: generatedImage?.providerRequest?.submissionMode || 'scaffold_only',
    providerEndpoint: generatedImage?.providerRequest?.endpoint || null,
    assetFilenameHint: generatedImage?.providerRequest?.assetFilenameHint || null,
    altText: generatedImage?.requestSummary?.altText || '',
    referenceHandling: generatedImage?.requestSummary?.referenceHandling || {},
    reviewSignals: generatedImage?.requestSummary?.reviewSignals || generatedImage?.reviewSignals || {},
    failureReason: generatedImage.failureReason || '',
    imageUrl: '',
    note: 'The image generation request has been scaffolded or submitted, but the final public image URL is still pending.'
  };
}

function summarizeLegacyImage(selectedImage) {
  return {
    source: 'legacy_selected_image',
    id: selectedImage.id || null,
    style: selectedImage.style || null,
    altText: '',
    imageUrl: selectedImage.image_url || '',
    note: 'Still using legacy image selection path until V2 image generation is implemented.'
  };
}

function buildImageSummary({ generatedImage, imageRequest, selectedImage }) {
  if (generatedImage) return summarizeGeneratedImage(generatedImage);
  if (imageRequest) return summarizeImageRequest(imageRequest);
  return summarizeLegacyImage(selectedImage);
}

function buildReviewWarnings(image, selectedMoment, externalEventPacket) {
  const warnings = [];
  const characterPresenceTarget = image?.reviewSignals?.characterPresenceTarget
    || selectedMoment?.characterPresenceTarget
    || '';
  const referenceHandling = image?.referenceHandling || {};
  if (
    ['clear_character_presence', 'expression_led'].includes(characterPresenceTarget)
    && referenceHandling.deliveryMode === 'metadata_only'
    && Number(referenceHandling.requestedReferenceCount || 0) > 0
  ) {
    warnings.push('identity_reference_metadata_only_manual_review_required');
  }
  if (
    image?.reviewSignals?.unresolvedIdentityReference
    || (referenceHandling.placeholderReferenceIds || []).length > 0
    || (referenceHandling.unresolvedReferenceIds || []).length > 0
  ) {
    warnings.push('identity_anchor_placeholder_or_unregistered');
  }
  if ((externalEventPacket?.activeEventIds || []).length > 0) {
    warnings.push('active_external_world_state_present_review_against_moment');
  }
  return warnings;
}

function buildPostPackage({
  config,
  scenePlan,
  selectedMoment,
  selectedCaption,
  generatedImage,
  imageRequest,
  externalEventPacket,
  selectedImage
}) {
  if (!scenePlan || !selectedCaption) {
    throw new Error('scene_plan.json or selected_caption.json is missing');
  }

  const image = buildImageSummary({ generatedImage, imageRequest, selectedImage });
  const release = buildReleaseAssessment(image);
  const reviewWarnings = buildReviewWarnings(image, selectedMoment, externalEventPacket);
  const releaseChecklist = [
    'caption_selected',
    image.imageUrl ? 'image_ready' : 'image_pending',
    image.altText ? 'alt_text_ready' : 'alt_text_missing'
  ];

  if (image.provider) releaseChecklist.push('image_provider_attached');
  if (image.remoteJobId) releaseChecklist.push('image_job_tracked');
  if (image.providerRequestId) releaseChecklist.push('image_request_tracked');

  return {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: scenePlan.runId,
    lane: scenePlan.lane,
    caption: selectedCaption.caption,
    hashtags: selectedCaption.hashtags,
    fullCaptionText: joinCaptionAndHashtags(selectedCaption.caption, selectedCaption.hashtags),
    captionSource: {
      selectedCandidateId: selectedCaption.selectedCandidateId,
      selectionReason: selectedCaption.selectionReason
    },
    image,
    publish: {
      platform: 'instagram',
      dryRunDefault: true,
      readiness: release.readiness,
      releaseStage: release.stage,
      blockers: release.blockers,
      releaseChecklist,
      reviewWarnings
    },
    reviewContext: {
      selectedMomentSummaryZh: selectedMoment?.eventSummaryZh || '',
      characterPresenceTarget: selectedMoment?.characterPresenceTarget
        || image?.reviewSignals?.characterPresenceTarget
        || imageRequest?.reviewSignals?.characterPresenceTarget
        || '',
      captureSummaryEn: image?.reviewSignals?.captureSummaryEn
        || imageRequest?.reviewSignals?.captureSummaryEn
        || '',
      renderStyleSummaryEn: image?.reviewSignals?.renderStyleSummaryEn
        || imageRequest?.reviewSignals?.renderStyleSummaryEn
        || '',
      activeExternalEventIds: externalEventPacket?.activeEventIds || []
    }
  };
}

module.exports = {
  buildPostPackage
};
