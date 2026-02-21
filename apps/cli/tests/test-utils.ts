import { buildCli, type BuildCliOptions, type CliIo } from '../src/cli.js';

export interface MemoryIo extends CliIo {
  readonly output: string[];
  readonly errors: string[];
}

type RunCliCommandOptions = Omit<BuildCliOptions, 'io'> & {
  io?: MemoryIo;
};

export function createMemoryIo(): MemoryIo {
  const output: string[] = [];
  const errors: string[] = [];

  return {
    output,
    errors,
    write(message) {
      output.push(message);
    },
    writeError(message) {
      errors.push(message);
    }
  };
}

export async function runCliCommand(argv: string[], options: RunCliCommandOptions = {}) {
  const io = options.io ?? createMemoryIo();

  try {
    const cli = buildCli({ ...options, io });
    await cli.parseAsync(argv, { from: 'user' });
    return {
      io,
      error: undefined as Error | undefined
    };
  } catch (error) {
    return {
      io,
      error: error as Error
    };
  }
}
