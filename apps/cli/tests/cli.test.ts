import { describe, expect, it } from 'vitest';
import { buildCli } from '../src/cli.js';

describe('cli', () => {
  it('has expected command groups', () => {
    const cli = buildCli();
    const names = cli.commands.map((command) => command.name());

    expect(names).toEqual(['project', 'run', 'agent', 'artifact', 'issues']);
  });
});
