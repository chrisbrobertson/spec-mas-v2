import { buildCli, type BuildCliOptions } from './cli.js';

export async function runCli(argv: string[], options: BuildCliOptions = {}) {
  return buildCli(options).parseAsync(argv, { from: 'user' });
}

export * from './cli.js';
export * from './services.js';
