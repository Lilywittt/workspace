const fs = require('fs');
const path = require('path');
const { loadSkillBody } = require('./skill_loader');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
    env[key] = value;
  }
  return env;
}

function loadCreativeModelConfig(configPath) {
  return readJson(configPath);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadEnvValue(envName) {
  if (process.env[envName]) return process.env[envName];

  const candidates = [
    path.resolve(__dirname, '..', '..', '..', '..', '..', '.env'),
    path.resolve(__dirname, '..', '..', '..', '..', '..', 'data', '.env')
  ];

  for (const candidate of candidates) {
    const envMap = parseEnvFile(candidate);
    if (envMap[envName]) {
      return envMap[envName];
    }
  }

  return '';
}

function extractTextContent(messageContent) {
  if (typeof messageContent === 'string') return messageContent;
  if (Array.isArray(messageContent)) {
    return messageContent
      .map(item => item?.text || '')
      .join('\n')
      .trim();
  }
  return '';
}

function extractFirstJsonBlock(text) {
  const raw = String(text || '').trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const starts = [];
  const objectStart = raw.indexOf('{');
  const arrayStart = raw.indexOf('[');
  if (objectStart !== -1) starts.push(objectStart);
  if (arrayStart !== -1) starts.push(arrayStart);
  if (starts.length === 0) {
    throw new Error('Model response did not contain JSON.');
  }

  let start = Math.min(...starts);
  const openChar = raw[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (ch === '\\') {
      escaping = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === openChar) depth += 1;
    if (ch === closeChar) depth -= 1;
    if (depth === 0) {
      return raw.slice(start, i + 1);
    }
  }

  throw new Error('Model response JSON block was incomplete.');
}

function repairJsonLikeText(text) {
  let repaired = String(text || '').trim();
  if (!repaired) return repaired;

  repaired = repaired
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    .replace(/([,\[]\s*)#\s*"([^"]*)"/g, '$1"#$2"')
    .replace(/([,\[]\s*)(#[^,\]\r\n"]+)(\s*(?=[,\]]))/g, (_, prefix, value, suffix) => `${prefix}"${value.trim()}"${suffix}`);

  repaired = quoteBareHashtagValues(repaired)
    .replace(/,\s*([}\]])/g, '$1');

  return repaired;
}

function quoteBareHashtagValues(text) {
  const source = String(text || '');
  let result = '';
  let inString = false;
  let escaping = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      result += char;
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === '#') {
      let cursor = result.length - 1;
      while (cursor >= 0 && /\s/.test(result[cursor])) {
        cursor -= 1;
      }
      const previous = cursor >= 0 ? result[cursor] : '';
      if (previous === ':' || previous === '[' || previous === ',') {
        let end = index;
        while (end < source.length && !/[,\]\}\r\n]/.test(source[end])) {
          end += 1;
        }
        const rawValue = source.slice(index, end).trim().replace(/\s+/g, ' ');
        if (rawValue) {
          result += JSON.stringify(rawValue);
          index = end - 1;
          continue;
        }
      }
    }

    result += char;
  }

  return result;
}

function parseModelJsonResponse(raw) {
  const jsonBlock = extractFirstJsonBlock(raw);

  try {
    return JSON.parse(jsonBlock);
  } catch (error) {
    const repaired = repairJsonLikeText(jsonBlock);
    if (repaired !== jsonBlock) {
      return JSON.parse(repaired);
    }
    throw error;
  }
}

async function callCreativeChat({ modelConfig, systemPrompt, userPrompt }) {
  const apiKey = loadEnvValue(modelConfig.envName);
  if (!apiKey) {
    throw new Error(`${modelConfig.envName} is missing.`);
  }

  const url = `${modelConfig.baseUrl.replace(/\/$/, '')}${modelConfig.chatCompletionsPath}`;
  const maxAttempts = Number(modelConfig.retryAttempts || 3);
  const baseDelayMs = Number(modelConfig.retryBaseDelayMs || 1200);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelConfig.model,
          temperature: modelConfig.temperature,
          max_tokens: modelConfig.maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        }),
        signal: AbortSignal.timeout(modelConfig.timeoutMs || 120000)
      });

      const text = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message = `Creative model request failed: HTTP ${response.status}: ${text}`;
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (retryable && attempt < maxAttempts) {
          await sleep(baseDelayMs * attempt);
          continue;
        }
        throw new Error(message);
      }

      const content = extractTextContent(payload?.choices?.[0]?.message?.content || '');
      if (!content) {
        throw new Error('Creative model returned empty content.');
      }
      return content;
    } catch (error) {
      const message = String(error?.message || error || '');
      const retryable = /terminated|fetch failed|timeout|network|socket|econnreset|aborted/i.test(message);
      if (!retryable || attempt >= maxAttempts) {
        throw error;
      }
      await sleep(baseDelayMs * attempt);
    }
  }

  throw new Error('Creative model retry loop ended unexpectedly.');
}

async function runSkillJsonTask({
  skillPath,
  taskLabel,
  input,
  outputContract,
  modelConfigPath
}) {
  const modelConfig = loadCreativeModelConfig(modelConfigPath);
  const skillBody = loadSkillBody(skillPath);
  const systemPrompt = [
    skillBody,
    '',
    'Return only valid JSON.',
    'Do not use markdown fences.',
    'Do not explain your reasoning outside the JSON.',
    'Respect the output contract exactly.'
  ].join('\n');

  const userPrompt = [
    `Task: ${taskLabel}`,
    '',
    'Output contract:',
    JSON.stringify(outputContract, null, 2),
    '',
    'Input:',
    JSON.stringify(input, null, 2)
  ].join('\n');

  const maxParseAttempts = Number(modelConfig.parseRetryAttempts || 3);
  const parseRetryDelayMs = Number(modelConfig.parseRetryDelayMs || 900);

  for (let attempt = 1; attempt <= maxParseAttempts; attempt += 1) {
    try {
      const raw = await callCreativeChat({
        modelConfig,
        systemPrompt,
        userPrompt
      });

      return parseModelJsonResponse(raw);
    } catch (error) {
      const message = String(error?.message || error || '');
      const retryable = /did not contain json|json block was incomplete|unexpected end of json input|unexpected token|not valid json/i.test(message);
      if (!retryable || attempt >= maxParseAttempts) {
        throw error;
      }
      await sleep(parseRetryDelayMs * attempt);
    }
  }

  throw new Error('Creative JSON parse retry loop ended unexpectedly.');
}

module.exports = {
  callCreativeChat,
  extractFirstJsonBlock,
  loadCreativeModelConfig,
  loadEnvValue,
  parseModelJsonResponse,
  repairJsonLikeText,
  runSkillJsonTask
};
