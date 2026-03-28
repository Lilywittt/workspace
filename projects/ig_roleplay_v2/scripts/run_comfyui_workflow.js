const { parseArgs } = require('./lib/runtime');
const { runImageGenerationCli } = require('./run_image_generation');

async function main(argv = process.argv) {
  const args = parseArgs(argv);
  if (!args.provider) {
    args.provider = 'comfyui-local-anime';
  }
  return runImageGenerationCli([
    argv[0],
    argv[1],
    ...Object.entries(args)
      .flatMap(([key, value]) => {
        if (key === 'flags') {
          return Array.from(value || []).map(flag => `--${flag}`);
        }
        return [`--${key}`, String(value)];
      })
  ]);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  main
};
