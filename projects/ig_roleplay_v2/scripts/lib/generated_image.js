const {
  buildGeneratedImageArtifactBase,
  buildProviderRequestBody,
  composePrompt,
  sizeForProvider
} = require('./image_generation');
const { getProviderSpec } = require('./provider_catalog');

function buildGeneratedImageArtifact({ config, imageRequest, scenePlan, args }) {
  if (!imageRequest || !scenePlan) {
    throw new Error('image_request.json or scene_plan.json is missing');
  }

  const provider = String(args.provider || 'manual_stub').trim();
  const providerSpec = getProviderSpec(provider, args.model || '');
  const prompt = composePrompt(imageRequest);
  const requestBody = buildProviderRequestBody({
    providerSpec,
    prompt,
    size: sizeForProvider(providerSpec, imageRequest?.renderPlan?.aspectRatio || '4:5'),
    quality: args.quality || 'medium',
    outputFormat: args['output-format'] || 'png'
  });
  const output = buildGeneratedImageArtifactBase({
    scenePlan,
    imageRequest,
    providerSpec,
    requestBody,
    outputFormat: args['output-format'] || 'png',
    submissionMode: 'scaffold_only'
  });

  const imageUrl = String(args['image-url'] || '').trim();
  const assetId = String(args['asset-id'] || '').trim() || null;
  const remoteJobId = String(args['job-id'] || '').trim() || null;
  const providerRequestId = String(args['request-id'] || '').trim() || null;
  const note = String(args.note || '').trim();

  output.version = config.version || output.version;
  output.imageUrl = imageUrl;
  output.assetId = assetId;
  output.remoteJobId = remoteJobId;
  output.providerRequestId = providerRequestId;
  output.providerRequest.submissionMode = remoteJobId || providerRequestId ? 'submitted_or_resumed' : 'scaffold_only';
  output.providerRequest.assetFilenameHint = assetId || `${scenePlan.runId || 'scene'}-${provider || 'image'}.jpg`;

  if (imageUrl) {
    output.status = 'image_ready';
    output.notes = [
      'A final image URL is available for release packaging and publish dry runs.'
    ];
  } else if (remoteJobId || providerRequestId) {
    output.status = 'generation_submitted';
    output.notes = [
      'The provider request was submitted, but the final public image URL is not available yet.'
    ];
  } else {
    output.status = 'generation_scaffold_ready';
    output.notes = [
      'Provider payload scaffold created. Submit it to an image backend, then rerun with --job-id or --image-url.'
    ];
  }

  if (note) {
    output.notes.push(note);
  }

  return output;
}

module.exports = {
  buildGeneratedImageArtifact
};
