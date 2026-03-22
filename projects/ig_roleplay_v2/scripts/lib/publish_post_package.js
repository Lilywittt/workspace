function createInitialPublishResult({ config, finalDelivery, dryRun, imageUrl }) {
  return {
    version: config.version || '2.0.0-alpha.1',
    createdAt: new Date().toISOString(),
    scenePlanRunId: finalDelivery.scenePlanRunId || null,
    platform: 'instagram',
    dryRun,
    status: 'initialized',
    imageSource: finalDelivery?.image?.provider || 'final_delivery',
    imageUrl,
    altText: finalDelivery?.publishPayload?.altText || finalDelivery?.image?.altText || '',
    releaseStage: finalDelivery?.deliveryReadiness?.releaseStage || 'unknown',
    captionChars: String(finalDelivery?.publishPayload?.caption || '').length,
    publishTarget: {
      graphApiBase: 'https://graph.facebook.com/v19.0',
      mode: dryRun ? 'dry_run' : 'live_publish',
      provider: finalDelivery?.image?.provider || null,
      providerEndpoint: finalDelivery?.image?.providerEndpoint || null
    },
    result: null,
    notes: []
  };
}

function planPublish({ config, finalDelivery, args, env }) {
  if (!finalDelivery) {
    throw new Error('final_delivery.json is missing');
  }

  const publishEnabled = env.IG_PUBLISH_ENABLED === 'true';
  const forceLive = args.flags.has('force-live');
  const dryRun = args.flags.has('dry-run') || !publishEnabled || !forceLive;
  const imageUrl = String(args['image-url'] || finalDelivery?.publishPayload?.imageUrl || finalDelivery?.image?.imageUrl || '').trim();
  const output = createInitialPublishResult({ config, finalDelivery, dryRun, imageUrl });
  output.publishTarget.graphApiBase = env.IG_GRAPH_API_BASE || output.publishTarget.graphApiBase;
  const readiness = String(finalDelivery?.deliveryReadiness?.readiness || '').trim();
  const blockers = Array.isArray(finalDelivery?.deliveryReadiness?.blockers) ? finalDelivery.deliveryReadiness.blockers : [];
  if (!finalDelivery?.deliveryReadiness?.publishable) {
    output.status = dryRun ? 'dry_run_blocked_final_delivery_not_publishable' : 'blocked_final_delivery_not_publishable';
    output.notes.push('The final delivery manifest is not publishable yet.');
    if (readiness) {
      output.notes.push(`Final delivery readiness is ${readiness}.`);
    }
    if (blockers.length > 0) {
      output.notes.push(`Final delivery blockers: ${blockers.join(', ')}`);
    }
    return { output, shouldPublish: false };
  }

  if (readiness && readiness !== 'ready_for_dry_run_or_publish') {
    output.status = dryRun ? 'dry_run_blocked_release_not_ready' : 'blocked_release_not_ready';
    output.notes.push(`Final delivery readiness is ${readiness}.`);
    if (blockers.length > 0) {
      output.notes.push(`Release blockers: ${blockers.join(', ')}`);
    }
    return { output, shouldPublish: false };
  }

  if (!imageUrl) {
    output.status = dryRun ? 'dry_run_blocked_missing_image_url' : 'blocked_missing_image_url';
    output.notes.push('No final image URL was provided, so the publish bridge refused to treat this package as ready.');
    return { output, shouldPublish: false };
  }

  if (dryRun) {
    output.status = 'dry_run_ready';
    output.notes.push('Dry run only: the package is structurally ready for a real publish attempt.');
    return { output, shouldPublish: false };
  }

  if (!env.IG_USER_ID || !env.IG_ACCESS_TOKEN) {
    output.status = 'blocked_missing_credentials';
    output.notes.push('IG_USER_ID or IG_ACCESS_TOKEN is missing.');
    return { output, shouldPublish: false };
  }

  return { output, shouldPublish: true };
}

module.exports = {
  planPublish
};
