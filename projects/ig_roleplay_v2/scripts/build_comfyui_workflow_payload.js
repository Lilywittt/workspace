const path = require('path');
const { parseArgs, readJsonRequired } = require('./lib/runtime');
const { loadWorkflowProfile, buildWorkflowRequest } = require('./lib/comfyui_workflow');

function main() {
  const args = parseArgs(process.argv);
  const profilePath = args.profile
    ? path.resolve(args.profile)
    : path.resolve(__dirname, '..', 'config', 'render', 'comfyui_anime_engineering_profile.json');
  const imageRequestPath = args['image-request']
    ? path.resolve(args['image-request'])
    : null;

  if (!imageRequestPath) {
    throw new Error('--image-request is required');
  }

  const workflowProfile = loadWorkflowProfile(profilePath);
  const imageRequest = readJsonRequired(imageRequestPath, 'image request');
  const bundle = buildWorkflowRequest({
    imageRequest,
    workflowProfile,
    requestedModel: args.model || '',
    provider: args.provider || '',
    requestStamp: args['request-stamp'] || ''
  });

  process.stdout.write(`${JSON.stringify({
    profileId: bundle.profileId,
    checkpointName: bundle.checkpointName,
    seed: bundle.seed,
    aspectRatio: bundle.aspectRatio,
    size: bundle.size,
    positivePrompt: bundle.positivePrompt,
    negativePrompt: bundle.negativePrompt,
    filenamePrefix: bundle.filenamePrefix,
    outputNodeIds: bundle.outputNodeIds,
    submitPayload: bundle.submitPayload
  }, null, 2)}\n`);
}

main();
