import { describe, expect, it, vi } from 'vitest';
import { AgentGenerationService, type CommandRunner } from '../src/services.js';

describe('agent-generation-service', () => {
  it('executes codex, claude, and gemini through local cli adapters', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const commandRunner: CommandRunner = vi.fn(async (command, args) => {
      calls.push({ command, args });
      return {
        exitCode: 0,
        stdout: `${command}-output`,
        stderr: ''
      };
    });

    const service = new AgentGenerationService({ commandRunner });

    const codex = await service.generate({
      agent: 'codex',
      prompt: 'implement feature'
    });
    const claude = await service.generate({
      agent: 'claude',
      prompt: 'review changes'
    });
    const gemini = await service.generate({
      agent: 'gemini',
      prompt: 'write tests'
    });

    expect(calls.map((call) => call.command)).toEqual(['codex', 'claude', 'gemini']);
    expect(calls[0]?.args[0]).toBe('exec');
    expect(calls[0]?.args.at(-1)).toBe('implement feature');
    expect(calls[1]?.args[0]).toBe('--print');
    expect(calls[1]?.args.at(-1)).toBe('review changes');
    expect(calls[2]?.args[0]).toBe('--prompt');
    expect(calls[2]?.args[1]).toBe('write tests');

    expect(codex).toMatchObject({ agent: 'codex', mode: 'local_cli', output: 'codex-output' });
    expect(claude).toMatchObject({ agent: 'claude', mode: 'local_cli', output: 'claude-output' });
    expect(gemini).toMatchObject({ agent: 'gemini', mode: 'local_cli', output: 'gemini-output' });
  });

  it('fails local cli execution when command returns non-zero exit code', async () => {
    const commandRunner: CommandRunner = vi.fn(async () => ({
      exitCode: 2,
      stdout: '',
      stderr: 'permission denied'
    }));
    const service = new AgentGenerationService({ commandRunner });

    await expect(
      service.generate({
        agent: 'codex',
        prompt: 'run command'
      })
    ).rejects.toThrow('codex exited with code 2: permission denied');
  });

  it('performs remote_api generation with POST and parses JSON output', async () => {
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => {
      return new Response(JSON.stringify({ output: 'remote-success' }), {
        status: 201,
        headers: {
          'content-type': 'application/json'
        }
      });
    });
    const service = new AgentGenerationService({ fetcher });

    const result = await service.generate({
      agent: 'claude',
      prompt: 'summarize this',
      mode: 'remote_api',
      remoteApiUrl: 'https://api.example.com/generate'
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const firstCall = fetcher.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected fetcher to be called');
    }
    const [url, init] = firstCall;
    expect(url).toBe('https://api.example.com/generate');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      agent: 'claude',
      prompt: 'summarize this',
      mode: 'remote_api'
    });
    expect(result).toMatchObject({
      agent: 'claude',
      mode: 'remote_api',
      output: 'remote-success',
      statusCode: 201,
      remoteApiUrl: 'https://api.example.com/generate'
    });
  });

  it('validates remote api inputs and surfaces non-ok responses', async () => {
    const service = new AgentGenerationService({ fetcher: vi.fn() });
    await expect(
      service.generate({
        agent: 'gemini',
        prompt: 'test prompt',
        mode: 'remote_api'
      })
    ).rejects.toThrow('remoteApiUrl is required when mode=remote_api');

    await expect(
      service.generate({
        agent: 'gemini',
        prompt: 'test prompt',
        mode: 'remote_api',
        remoteApiUrl: 'not-a-url'
      })
    ).rejects.toThrow('Invalid remoteApiUrl: not-a-url');

    const failingService = new AgentGenerationService({
      fetcher: vi.fn(async () => new Response('bad request', { status: 400 }))
    });

    await expect(
      failingService.generate({
        agent: 'gemini',
        prompt: 'test prompt',
        mode: 'remote_api',
        remoteApiUrl: 'https://api.example.com/generate'
      })
    ).rejects.toThrow('Remote API request failed (400): bad request');
  });
});
