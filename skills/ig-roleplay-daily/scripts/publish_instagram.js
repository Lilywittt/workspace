const fs = require('fs');
const path = require('path');

const dataDir = process.env.IG_PIPELINE_DATA_DIR || path.resolve(__dirname, '..', '..', '..', 'data', 'ig_roleplay');
const configPath = process.env.IG_PIPELINE_CONFIG || path.join(dataDir, 'pipeline.config.json');
const selectedImagePath = path.join(dataDir, 'selected_image.json');
const signalsPath = path.join(dataDir, 'signals.json');
const postedPath = path.join(dataDir, 'posted.jsonl');

function readJson(filePath, fallback = {}) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const cleaned = raw.replace(/^\uFEFF/, '');
    return JSON.parse(cleaned);
  } catch (err) {
    return fallback;
  }
}

function appendJsonl(filePath, obj) {
  fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`, 'utf8');
}

function parseArgs(argv) {
  const args = { flags: new Set() };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--')) {
      const name = key.replace(/^--/, '');
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args.flags.add(name);
      } else {
        args[name] = next;
        i++;
      }
    }
  }
  return args;
}

async function postForm(url, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(url, { method: 'POST', body });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  const args = parseArgs(process.argv);
  const config = readJson(configPath, {});

  let caption = args['caption'] || '';
  const captionFile = args['caption-file'];
  if (captionFile) {
    caption = fs.readFileSync(captionFile, 'utf8').trim();
  }
  if (!caption) {
    console.error('caption 为空，无法发布');
    process.exit(1);
  }

  const selectedImage = readJson(selectedImagePath, {});
  let imageUrl = args['image-url'] || args['imageUrl'] || config.instagram?.default_image_url || selectedImage.image_url || '';

  const publishEnabled = (process.env.IG_PUBLISH_ENABLED === 'true') || config.instagram?.publish === true;
  const dryRun = args.flags.has('dry-run') || !publishEnabled;

  const record = {
    at: new Date().toISOString(),
    caption,
    image_url: imageUrl,
    image_id: selectedImage.id || null,
    image_style: selectedImage.style || null,
    dry_run: dryRun,
    publish_result: null,
    signals: readJson(signalsPath, {})
  };

  if (dryRun) {
    appendJsonl(postedPath, record);
    console.log('DRY RUN: caption recorded to posted.jsonl');
    return;
  }

  const igUserId = process.env.IG_USER_ID;
  const accessToken = process.env.IG_ACCESS_TOKEN;
  const apiBase = process.env.IG_GRAPH_API_BASE || 'https://graph.facebook.com/v19.0';

  if (!igUserId || !accessToken) {
    console.error('缺少 IG_USER_ID 或 IG_ACCESS_TOKEN，无法发布');
    process.exit(1);
  }
  if (!imageUrl) {
    console.error('缺少 image_url，无法发布。请在 image_catalog.json 或 config 中提供 public_url');
    process.exit(1);
  }

  const mediaEndpoint = `${apiBase}/${igUserId}/media`;
  const publishEndpoint = `${apiBase}/${igUserId}/media_publish`;

  const mediaRes = await postForm(mediaEndpoint, {
    image_url: imageUrl,
    caption,
    access_token: accessToken
  });

  const publishRes = await postForm(publishEndpoint, {
    creation_id: mediaRes.id,
    access_token: accessToken
  });

  record.publish_result = {
    container_id: mediaRes.id,
    publish_id: publishRes.id || null
  };

  appendJsonl(postedPath, record);
  console.log('PUBLISHED: ', record.publish_result);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
