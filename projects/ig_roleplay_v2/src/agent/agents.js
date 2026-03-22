const path = require('path');
const { runSkillJsonTask } = require('../common/creative_llm');
const { compactText } = require('./utils');

function promptPath(promptName) {
  return path.resolve(__dirname, '..', '..', 'pipeline', 'prompts', `${promptName}.md`);
}

async function runJsonAgent({
  promptName,
  taskLabel,
  input,
  outputContract,
  modelConfigPath,
  fallbackFactory,
  validate
}) {
  try {
    const output = await runSkillJsonTask({
      skillPath: promptPath(promptName),
      taskLabel,
      input,
      outputContract,
      modelConfigPath
    });
    const normalized = validate ? validate(output) : output;
    return {
      output: normalized,
      meta: {
        mode: 'llm',
        promptName,
        error: ''
      }
    };
  } catch (error) {
    if (typeof fallbackFactory !== 'function') {
      throw error;
    }
    const fallback = fallbackFactory(input);
    const normalized = validate ? validate(fallback) : fallback;
    return {
      output: normalized,
      meta: {
        mode: 'fallback',
        promptName,
        error: compactText(error?.message || String(error || ''))
      }
    };
  }
}

module.exports = {
  promptPath,
  runJsonAgent
};
