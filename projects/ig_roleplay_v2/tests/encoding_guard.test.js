const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const scanRoots = [
  'src',
  'pipeline',
  'scripts',
  'tests',
  'scenarios',
  'character/editable',
  'vision',
  'config'
];
const textExtensions = new Set(['.js', '.json', '.md', '.ps1', '.py']);
const ignoredSegments = new Set(['runtime', 'node_modules']);
const ignoredFiles = new Set([
  path.join(projectRoot, 'tests', 'encoding_guard.test.js')
]);
const suspiciousMarkers = [
  '鏈€杩',
  '鍙',
  '浠婂',
  '闆ㄥ',
  '鍦ㄨ',
  '绗',
  '鏃堕',
  '瑙掕',
  '鍥炬',
  '鐢熸',
  '鎯呯',
  '涓€',
  '銆?'
];

function listFiles(rootDir) {
  const results = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredSegments.has(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }
      if (textExtensions.has(path.extname(entry.name))) {
        if (ignoredFiles.has(fullPath)) continue;
        results.push(fullPath);
      }
    }
  }
  return results;
}

test('source files do not contain common mojibake marker sequences', () => {
  const findings = [];

  for (const relativeRoot of scanRoots) {
    const absoluteRoot = path.join(projectRoot, relativeRoot);
    if (!fs.existsSync(absoluteRoot)) continue;

    for (const filePath of listFiles(absoluteRoot)) {
      const text = fs.readFileSync(filePath, 'utf8');
      const markers = suspiciousMarkers.filter(marker => text.includes(marker));
      if (markers.length > 0) {
        findings.push(`${path.relative(projectRoot, filePath)} -> ${markers.join(', ')}`);
      }
    }
  }

  assert.deepEqual(findings, []);
});
