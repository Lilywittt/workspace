const fs = require('fs');
const path = require('path');

const dataDir = process.env.IG_PIPELINE_DATA_DIR || path.resolve(__dirname, '..', '..', '..', 'data', 'ig_roleplay');
const catalogPath = path.join(dataDir, 'image_catalog.json');
const configPath = process.env.IG_PIPELINE_CONFIG || path.join(dataDir, 'pipeline.config.json');
const signalsPath = path.join(dataDir, 'signals.json');
const outputPath = path.join(dataDir, 'selected_image.json');

function readJson(filePath, fallback = null) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const cleaned = raw.replace(/^\uFEFF/, '');
    return JSON.parse(cleaned);
  } catch (err) {
    return fallback;
  }
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

function normalizeTags(tags = []) {
  return tags.map(t => String(t || '').toLowerCase()).filter(Boolean);
}

function deriveContextTags(signals) {
  const tags = [];
  const weatherSummary = signals?.weather?.summary || '';
  if (weatherSummary.includes('晴')) tags.push('sunny');
  if (weatherSummary.includes('雨')) tags.push('rainy');
  if (weatherSummary.includes('雪')) tags.push('snow');
  if (weatherSummary.includes('雾')) tags.push('fog');

  const trends = Array.isArray(signals?.trends) ? signals.trends : [];
  trends.slice(0, 5).forEach(t => tags.push(String(t).toLowerCase()));

  return tags;
}

function scoreImage(entry, contextTags) {
  const entryTags = normalizeTags(entry.tags || []);
  let score = 0;
  for (const tag of contextTags) {
    if (!tag) continue;
    if (entryTags.includes(tag)) score += 2;
    if (entry.style && tag.includes(entry.style)) score += 1;
  }
  return score;
}

function pickWeighted(candidates) {
  const total = candidates.reduce((sum, c) => sum + c.score + 1, 0);
  let r = Math.random() * total;
  for (const c of candidates) {
    r -= (c.score + 1);
    if (r <= 0) return c.entry;
  }
  return candidates[0].entry;
}

function main() {
  const catalog = readJson(catalogPath, []);
  const signals = readJson(signalsPath, {});
  const config = readJson(configPath, {});
  if (!Array.isArray(catalog) || catalog.length === 0) {
    console.error('image_catalog.json 为空，无法选择图片');
    process.exit(1);
  }

  const stylePref = (process.env.IG_IMAGE_STYLE || config.images?.style_preference || '').toLowerCase();
  let pool = catalog;
  if (stylePref) {
    const filtered = catalog.filter(c => String(c.style || '').toLowerCase() === stylePref);
    if (filtered.length > 0) pool = filtered;
  }

  const contextTags = deriveContextTags(signals);
  const scored = pool.map(entry => ({ entry, score: scoreImage(entry, contextTags) }));
  scored.sort((a, b) => b.score - a.score);

  const selected = pickWeighted(scored);
  const payload = {
    selected_at: new Date().toISOString(),
    image_url: selected.public_url || '',
    id: selected.id || '',
    style: selected.style || '',
    tags: selected.tags || []
  };

  writeJson(outputPath, payload);
  console.log(`image selected: ${payload.id || 'unknown'}`);
}

main();
