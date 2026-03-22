const {
  defaultEndpointFor,
  defaultModelFor,
  deriveSize,
  getProviderSpec,
  requiredEnvFor
} = require('./provider_catalog');

function buildNotes(noteValue) {
  const note = String(noteValue || '').trim();
  return note ? [note] : [];
}

function buildRequestSummary(imageRequest, endpoint) {
  const spec = getProviderSpec((imageRequest?.providerRequest?.provider || imageRequest?.provider || ''), '') || {};
  return {
    generationMode: imageRequest.generationMode || 'unknown',
    endpoint: endpoint || null,
    aspectRatio: imageRequest?.renderPlan?.aspectRatio || '4:5',
    candidateCount: imageRequest?.renderPlan?.candidateCount || 1,
    altText: imageRequest?.publishHints?.altText || '',
    characterPresenceTarget: imageRequest?.reviewSignals?.characterPresenceTarget || '',
    reviewSignals: imageRequest?.reviewSignals || {},
    referenceIds: (imageRequest.references || []).map(ref => ref.id),
    referenceHandling: {
      requestedReferenceCount: (imageRequest.references || []).length,
      unresolvedReferenceIds: imageRequest?.referencePlan?.unresolvedReferenceIds || [],
      placeholderReferenceIds: imageRequest?.referencePlan?.placeholderReferenceIds || [],
      providerCapability: spec?.referenceHandling?.providerCapability || 'unknown',
      hostTransport: spec?.referenceHandling?.hostTransport || 'unknown',
      deliveryMode: spec?.referenceHandling?.deliveryMode || 'unknown'
    },
    promptPackage: imageRequest.promptPackage || {}
  };
}

function buildProviderRequest({ provider, model, imageRequest, scenePlan, endpoint, assetId, remoteJobId, providerRequestId }) {
  const spec = getProviderSpec(provider, model) || {};
  const aspectRatio = imageRequest?.renderPlan?.aspectRatio || '4:5';
  const candidateCount = imageRequest?.renderPlan?.candidateCount || 1;

  return {
    provider,
    endpoint: endpoint || spec.endpoint || defaultEndpointFor(provider),
    submissionMode: remoteJobId || providerRequestId ? 'submitted_or_resumed' : 'scaffold_only',
    requiredEnv: spec.requiredEnv || requiredEnvFor(provider),
    model: spec.model || model,
    assetFilenameHint: assetId || `${scenePlan.runId || 'scene'}-${provider || 'image'}.jpg`,
    requestBody: {
      prompt: imageRequest?.promptPackage?.positivePrompt || '',
      negativePrompt: imageRequest?.promptPackage?.negativePrompt || '',
      size: deriveSize(provider, aspectRatio),
      aspectRatio,
      candidateCount,
      responseFormat: 'public_url'
    },
    responseContract: spec.responseContract || {
      jobIdField: 'job_id',
      requestIdField: 'request_id',
      imageUrlField: 'data[0].url'
    }
  };
}

function buildGeneratedImageArtifact({ config, imageRequest, scenePlan, args }) {
  if (!imageRequest || !scenePlan) {
    throw new Error('image_request.json or scene_plan.json is missing');
  }

  const provider = String(args.provider || 'manual_stub').trim();
  const spec = getProviderSpec(provider, args.model);
  const model = String(args.model || '').trim() || spec?.model || defaultModelFor(provider);
  const imageUrl = String(args['image-url'] || '').trim();
  const assetId = String(args['asset-id'] || '').trim() || null;
  const remoteJobId = String(args['job-id'] || '').trim() || null;
  const providerRequestId = String(args['request-id'] || '').trim() || null;
  const endpoint = String(args.endpoint || '').trim();
  const notes = buildNotes(args.note);

  let status = 'generation_scaffold_ready';
  if (imageUrl) {
    status = 'image_ready';
    notes.push('A final image URL is available for release packaging and publish dry runs.');
  } else if (remoteJobId || providerRequestId) {
    status = 'generation_submitted';
    notes.push('The provider request was submitted, but the final public image URL is not available yet.');
  } else {
    notes.push('Provider payload scaffold created. Submit it to an image backend, then rerun with --job-id or --image-url.');
  }

  return {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: scenePlan.runId,
    sourceRequestCreatedAt: imageRequest.createdAt || null,
    provider,
    model,
    imageUrl,
    assetId,
    remoteJobId,
    providerRequestId,
    requestSummary: buildRequestSummary(imageRequest, endpoint),
    providerRequest: buildProviderRequest({
      provider,
      model,
      imageRequest,
      scenePlan,
      endpoint,
      assetId,
      remoteJobId,
      providerRequestId
    }),
    notes,
    status
  };
}

module.exports = {
  buildGeneratedImageArtifact,
  defaultEndpointFor
};
