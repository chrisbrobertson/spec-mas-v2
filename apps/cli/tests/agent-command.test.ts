import { describe, expect, it, vi } from 'vitest';
import {
  AgentGenerationService,
  type AgentGenerationInput,
  type AgentGenerationResult,
  type AgentGenerationServiceLike
} from '../src/services.js';
import { runCliCommand } from './test-utils.js';

function createStubService(result: AgentGenerationResult): {
  service: AgentGenerationServiceLike;
  generate: ReturnType<typeof vi.fn>;
} {
  const generate = vi.fn(async (_input: AgentGenerationInput) => result);
  return {
    service: {
      generate
    },
    generate
  };
}

describe('agent-command', () => {
  it('generates with local_cli mode by default', async () => {
    const { service, generate } = createStubService({
      agent: 'codex',
      mode: 'local_cli',
      output: 'generated',
      command: ['codex', 'exec', 'generated']
    });

    const result = await runCliCommand(
      ['agent', 'generate', '--agent', 'codex', '--prompt', 'create draft', '--format', 'json'],
      {
        agentGenerationService: service
      }
    );

    expect(result.error).toBeUndefined();
    expect(generate).toHaveBeenCalledWith({
      agent: 'codex',
      prompt: 'create draft',
      mode: 'local_cli',
      remoteApiUrl: undefined
    });
    expect(JSON.parse(result.io.output[0])).toEqual({
      agent: 'codex',
      mode: 'local_cli',
      output: 'generated',
      command: ['codex', 'exec', 'generated']
    });
  });

  it('passes remote_api mode and remote-url to the service', async () => {
    const { service, generate } = createStubService({
      agent: 'gemini',
      mode: 'remote_api',
      output: 'remote-generated',
      remoteApiUrl: 'https://api.example.com/generate',
      statusCode: 200
    });

    const result = await runCliCommand(
      [
        'agent',
        'generate',
        '--agent',
        'gemini',
        '--prompt',
        'summarize',
        '--mode',
        'remote_api',
        '--remote-url',
        'https://api.example.com/generate'
      ],
      {
        agentGenerationService: service
      }
    );

    expect(result.error).toBeUndefined();
    expect(generate).toHaveBeenCalledWith({
      agent: 'gemini',
      prompt: 'summarize',
      mode: 'remote_api',
      remoteApiUrl: 'https://api.example.com/generate'
    });
    expect(result.io.output[0]).toContain('mode: remote_api');
    expect(result.io.output[0]).toContain('url: https://api.example.com/generate');
  });

  it('fails remote_api mode without --remote-url', async () => {
    const result = await runCliCommand(
      ['agent', 'generate', '--agent', 'claude', '--prompt', 'summarize', '--mode', 'remote_api'],
      {
        agentGenerationService: new AgentGenerationService({ fetcher: vi.fn() })
      }
    );

    expect(result.error?.message).toBe('remoteApiUrl is required when mode=remote_api');
  });

  it('validates agent and mode options', async () => {
    const invalidAgent = await runCliCommand(['agent', 'generate', '--agent', 'unknown', '--prompt', 'x']);
    expect(invalidAgent.error?.message).toBe('Unsupported agent: unknown');

    const invalidMode = await runCliCommand(
      ['agent', 'generate', '--agent', 'codex', '--prompt', 'x', '--mode', 'invalid'],
      {
        agentGenerationService: {
          generate: vi.fn()
        }
      }
    );
    expect(invalidMode.error?.message).toBe('Unsupported execution mode: invalid');
  });

  it('enforces required options', async () => {
    const missingAgent = await runCliCommand(['agent', 'generate', '--prompt', 'x']);
    expect(missingAgent.error?.message).toContain("required option '--agent <agent>' not specified");

    const missingPrompt = await runCliCommand(['agent', 'generate', '--agent', 'codex']);
    expect(missingPrompt.error?.message).toContain("required option '--prompt <prompt>' not specified");
  });
});
