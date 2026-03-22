const fs = require('fs');

function stripFrontmatter(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  if (!raw.startsWith('---')) {
    return raw.trim();
  }

  const closing = raw.indexOf('\n---', 3);
  if (closing === -1) {
    return raw.trim();
  }

  return raw.slice(closing + 4).trim();
}

function loadSkillBody(skillPath) {
  const raw = fs.readFileSync(skillPath, 'utf8');
  return stripFrontmatter(raw);
}

module.exports = {
  loadSkillBody,
  stripFrontmatter
};
