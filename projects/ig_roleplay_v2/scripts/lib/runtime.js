const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { flags: new Set() };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args.flags.add(name);
      continue;
    }
    args[name] = next;
    i += 1;
  }
  return args;
}

function readJsonOptional(filePath, fallback = {}) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function readJsonRequired(filePath, label = 'json file') {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to read required ${label}: ${filePath}. ${err.message}`);
  }
}

function readJson(filePath, fallback = {}) {
  return readJsonOptional(filePath, fallback);
}

function readJsonl(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (err) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resolveRuntimeLayout(runtimeDir) {
  const resolved = path.resolve(runtimeDir);
  const baseName = path.basename(resolved).toLowerCase();
  if (baseName === 'intermediate' || baseName === 'final') {
    const runtimeRootDir = path.dirname(resolved);
    return {
      runtimeRootDir,
      intermediateDir: baseName === 'intermediate' ? resolved : path.join(runtimeRootDir, 'intermediate'),
      finalDir: baseName === 'final' ? resolved : path.join(runtimeRootDir, 'final')
    };
  }

  return {
    runtimeRootDir: resolved,
    intermediateDir: path.join(resolved, 'intermediate'),
    finalDir: path.join(resolved, 'final')
  };
}

function runtimeCurrentDir(runtimeDir) {
  return path.join(resolveRuntimeLayout(runtimeDir).intermediateDir, 'current');
}

function runtimeRunsDir(runtimeDir) {
  return path.join(resolveRuntimeLayout(runtimeDir).intermediateDir, 'runs');
}

function runtimeHistoryDir(runtimeDir) {
  return path.join(resolveRuntimeLayout(runtimeDir).intermediateDir, 'history');
}

function runtimeGeneratedDir(runtimeDir) {
  return path.join(resolveRuntimeLayout(runtimeDir).intermediateDir, 'generated');
}

function runtimeEvaluationsDir(runtimeDir) {
  return path.join(resolveRuntimeLayout(runtimeDir).intermediateDir, 'evaluations');
}

function runtimeFinalCurrentDir(runtimeDir) {
  return path.join(resolveRuntimeLayout(runtimeDir).finalDir, 'current');
}

function runtimeFinalHistoryDir(runtimeDir) {
  return path.join(resolveRuntimeLayout(runtimeDir).finalDir, 'history');
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

function appendJsonl(filePath, obj) {
  fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`, 'utf8');
}

function resolveRelative(baseFile, maybeRelativePath) {
  if (path.isAbsolute(maybeRelativePath)) return maybeRelativePath;
  return path.resolve(path.dirname(baseFile), maybeRelativePath);
}

function buildRunStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function writeRuntimeArtifact(runtimeDir, currentFileName, runPrefix, obj, options = {}) {
  const currentDir = runtimeCurrentDir(runtimeDir);
  const runId = options.runId || `${runPrefix}-${buildRunStamp()}`;
  const runDir = path.join(runtimeRunsDir(runtimeDir), runId);
  ensureDir(currentDir);
  ensureDir(runDir);

  const text = JSON.stringify(obj, null, 2);
  const currentPath = path.join(currentDir, currentFileName);
  const archivedPath = path.join(runDir, currentFileName);
  fs.writeFileSync(currentPath, text, 'utf8');
  fs.writeFileSync(archivedPath, text, 'utf8');

  return { currentPath, archivedPath };
}

module.exports = {
  appendJsonl,
  buildRunStamp,
  ensureDir,
  fileExists,
  parseArgs,
  readJson,
  readJsonOptional,
  readJsonRequired,
  readJsonl,
  resolveRelative,
  resolveRuntimeLayout,
  runtimeCurrentDir,
  runtimeEvaluationsDir,
  runtimeFinalCurrentDir,
  runtimeFinalHistoryDir,
  runtimeGeneratedDir,
  runtimeHistoryDir,
  runtimeRunsDir,
  writeRuntimeArtifact
};
