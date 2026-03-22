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

function buildFinalDelivery({
  config,
  deliveryId,
  scenePlan,
  selectedCaption,
  generatedImage,
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
    source: {
      postPackagePath: sourcePaths?.postPackagePath || '',
      generatedImagePath: sourcePaths?.generatedImagePath || '',
      publishResultPath: sourcePaths?.publishResultPath || '',
      lastKnownPublishStatus: String(publishResult?.status || '').trim() || ''
    }
  };
}

module.exports = {
  buildDeliveryReadiness,
  buildFinalDelivery
};
