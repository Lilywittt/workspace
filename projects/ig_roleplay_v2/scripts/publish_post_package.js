const path = require('path');
const { planPublish } = require('./lib/publish_post_package');
const {
  appendJsonl,
  ensureDir,
  parseArgs,
  readJson,
  resolveRelative,
  runtimeCurrentDir,
  runtimeFinalCurrentDir,
  runtimeHistoryDir,
  writeRuntimeArtifact
} = require('./lib/runtime');

async function postForm(url, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(url, { method: 'POST', body });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

function writeArtifacts(runtimeDir, output) {
  const historyDir = runtimeHistoryDir(runtimeDir);
  ensureDir(historyDir);
  const written = writeRuntimeArtifact(runtimeDir, 'publish_result.json', 'publishresult', output);
  appendJsonl(path.join(historyDir, 'publish_history.jsonl'), output);
  return written;
}

async function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.resolve(__dirname, '..', 'config', 'runtime.config.json');

  const config = readJson(configPath, {});
  const runtimeDir = resolveRelative(configPath, (config.paths && config.paths.runtimeDir) || '../runtime');
  const currentDir = runtimeCurrentDir(runtimeDir);
  const finalCurrentDir = runtimeFinalCurrentDir(runtimeDir);
  const finalDelivery = readJson(path.join(finalCurrentDir, 'final_delivery.json'), null);

  if (!finalDelivery) {
    throw new Error('final_delivery.json is missing');
  }

  const planned = planPublish({ config, finalDelivery, args, env: process.env });
  const output = planned.output;

  if (!planned.shouldPublish) {
    const written = writeArtifacts(runtimeDir, output);
    console.log(`publish result created: ${path.join(currentDir, 'publish_result.json')}`);
    console.log(`publish result archived: ${written.archivedPath}`);
    console.log(`publish status: ${output.status}`);
    return;
  }

  const igUserId = process.env.IG_USER_ID;
  const accessToken = process.env.IG_ACCESS_TOKEN;
  const apiBase = process.env.IG_GRAPH_API_BASE || 'https://graph.facebook.com/v19.0';
  const imageUrl = output.imageUrl;

  const mediaEndpoint = `${apiBase}/${igUserId}/media`;
  const publishEndpoint = `${apiBase}/${igUserId}/media_publish`;

  const mediaRes = await postForm(mediaEndpoint, {
    image_url: imageUrl,
    caption: finalDelivery.publishPayload.caption,
    access_token: accessToken
  });

  const publishRes = await postForm(publishEndpoint, {
    creation_id: mediaRes.id,
    access_token: accessToken
  });

  output.status = 'published';
  output.result = {
    containerId: mediaRes.id,
    publishId: publishRes.id || null
  };
  output.notes.push('Publish bridge called the Instagram Graph API successfully.');
  const written = writeArtifacts(runtimeDir, output);
  console.log(`publish result created: ${path.join(currentDir, 'publish_result.json')}`);
  console.log(`publish result archived: ${written.archivedPath}`);
  console.log(`publish status: ${output.status}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
