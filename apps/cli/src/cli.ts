import { Command } from 'commander';
import {
  AGENT_EXECUTION_MODES,
  SUPPORTED_AGENT_PROVIDERS,
  AgentGenerationService,
  type AgentExecutionMode,
  type AgentGenerationResult,
  type AgentGenerationServiceLike,
  type AgentProvider,
  InMemoryArtifactService,
  InMemoryProjectService,
  InMemoryRunService,
  type ArtifactRunRecord,
  type ProjectRecord,
  type RunRecord
} from './services.js';

export type OutputFormat = 'table' | 'json';

export interface CliIo {
  write(message: string): void;
  writeError(message: string): void;
}

export interface BuildCliOptions {
  io?: CliIo;
  projectService?: InMemoryProjectService;
  runService?: InMemoryRunService;
  artifactService?: InMemoryArtifactService;
  agentGenerationService?: AgentGenerationServiceLike;
}

function createDefaultIo(): CliIo {
  return {
    write(message) {
      process.stdout.write(`${message}\n`);
    },
    writeError(message) {
      process.stderr.write(`${message}\n`);
    }
  };
}

function parseFormat(value: string): OutputFormat {
  return value === 'json' ? 'json' : 'table';
}

function renderProjectTable(projects: ProjectRecord[]): string {
  const lines = ['ID\tKEY\tNAME\tREPO'];
  for (const project of projects) {
    lines.push([project.id, project.key, project.name, project.repoPath].join('\t'));
  }
  return lines.join('\n');
}

function renderProjectDetail(project: ProjectRecord): string {
  return [
    `id: ${project.id}`,
    `key: ${project.key}`,
    `name: ${project.name}`,
    `repo: ${project.repoPath}`
  ].join('\n');
}

function renderRunTable(run: RunRecord): string {
  return [`id: ${run.id}`, `project: ${run.projectId}`, `spec: ${run.specPath}`, `status: ${run.status}`].join('\n');
}

function renderArtifactList(paths: string[]): string {
  return paths.join('\n');
}

function renderAgentGenerationResult(result: AgentGenerationResult): string {
  const lines = [`agent: ${result.agent}`, `mode: ${result.mode}`];
  if (result.command) {
    lines.push(`command: ${result.command.join(' ')}`);
  }
  if (result.remoteApiUrl) {
    lines.push(`url: ${result.remoteApiUrl}`);
  }
  lines.push(`output: ${result.output}`);
  return lines.join('\n');
}

function parseAgentProvider(value: string): AgentProvider {
  if ((SUPPORTED_AGENT_PROVIDERS as readonly string[]).includes(value)) {
    return value as AgentProvider;
  }

  throw new Error(`Unsupported agent: ${value}`);
}

function parseExecutionMode(value: string): AgentExecutionMode {
  if ((AGENT_EXECUTION_MODES as readonly string[]).includes(value)) {
    return value as AgentExecutionMode;
  }

  throw new Error(`Unsupported execution mode: ${value}`);
}

function outputValue(io: CliIo, format: OutputFormat, value: unknown, table: string): void {
  if (format === 'json') {
    io.write(JSON.stringify(value, null, 2));
    return;
  }

  io.write(table);
}

function createDefaultProjectService(): InMemoryProjectService {
  return new InMemoryProjectService();
}

function createDefaultRunService(): InMemoryRunService {
  return new InMemoryRunService();
}

function createDefaultArtifactService(): InMemoryArtifactService {
  const seed: ArtifactRunRecord[] = [
    {
      runId: 'run-0001',
      projectId: 'alpha',
      ageDays: 10,
      files: {
        'run-summary.md': '# Run 1',
        'validation/gate-results.json': '{"G1":"PASS"}'
      }
    },
    {
      runId: 'run-0002',
      projectId: 'alpha',
      ageDays: 40,
      files: {
        'run-summary.md': '# Run 2',
        'validation/gate-results.json': '{"G1":"FAIL"}'
      }
    }
  ];

  return new InMemoryArtifactService(seed);
}

function createDefaultAgentGenerationService(): AgentGenerationServiceLike {
  return new AgentGenerationService();
}

export function buildCli(options: BuildCliOptions = {}) {
  const io = options.io ?? createDefaultIo();
  const projectService = options.projectService ?? createDefaultProjectService();
  const runService = options.runService ?? createDefaultRunService();
  const artifactService = options.artifactService ?? createDefaultArtifactService();
  const agentGenerationService = options.agentGenerationService ?? createDefaultAgentGenerationService();

  const program = new Command();
  program.name('specmas').description('Spec-MAS CLI').exitOverride();

  program.configureOutput({
    writeOut(message) {
      io.write(message.trimEnd());
    },
    writeErr(message) {
      io.writeError(message.trimEnd());
    }
  });

  const project = program.command('project').description('project commands');

  project
    .command('list')
    .description('list projects')
    .option('--format <format>', 'table or json', 'table')
    .action((flags: { format: string }) => {
      const format = parseFormat(flags.format);
      const projects = projectService.list();
      outputValue(io, format, projects, renderProjectTable(projects));
    });

  project
    .command('show')
    .description('show project details')
    .argument('<projectId>')
    .option('--format <format>', 'table or json', 'table')
    .action((projectId: string, flags: { format: string }) => {
      const format = parseFormat(flags.format);
      const projectRecord = projectService.show(projectId);
      outputValue(io, format, projectRecord, renderProjectDetail(projectRecord));
    });

  project
    .command('create')
    .description('create a project')
    .argument('<projectId>')
    .requiredOption('--key <key>')
    .requiredOption('--name <name>')
    .requiredOption('--repo <repoPath>')
    .option('--format <format>', 'table or json', 'table')
    .action(
      (
        projectId: string,
        flags: {
          key: string;
          name: string;
          repo: string;
          format: string;
        }
      ) => {
        const format = parseFormat(flags.format);
        const created = projectService.create({
          id: projectId,
          key: flags.key,
          name: flags.name,
          repoPath: flags.repo
        });

        outputValue(io, format, created, renderProjectDetail(created));
      }
    );

  project
    .command('remove')
    .description('remove a project')
    .argument('<projectId>')
    .option('--format <format>', 'table or json', 'table')
    .action((projectId: string, flags: { format: string }) => {
      const format = parseFormat(flags.format);
      const removed = projectService.remove(projectId);
      outputValue(io, format, { projectId, removed }, `project: ${projectId}\nremoved: ${removed}`);
    });

  const run = program.command('run').description('run commands');

  run
    .command('start')
    .description('start a run')
    .requiredOption('--project <projectId>')
    .requiredOption('--spec <specPath>')
    .option('--run-id <runId>')
    .option('--format <format>', 'table or json', 'table')
    .action(
      (flags: {
        project: string;
        spec: string;
        runId?: string;
        format: string;
      }) => {
        const format = parseFormat(flags.format);
        const started = runService.start({
          projectId: flags.project,
          specPath: flags.spec,
          runId: flags.runId
        });

        outputValue(io, format, started, renderRunTable(started));
      }
    );

  run
    .command('status')
    .description('show run status')
    .argument('<runId>')
    .option('--format <format>', 'table or json', 'table')
    .action((runId: string, flags: { format: string }) => {
      const format = parseFormat(flags.format);
      const runRecord = runService.status(runId);
      outputValue(io, format, runRecord, renderRunTable(runRecord));
    });

  run
    .command('cancel')
    .description('cancel run')
    .argument('<runId>')
    .option('--format <format>', 'table or json', 'table')
    .action((runId: string, flags: { format: string }) => {
      const format = parseFormat(flags.format);
      const cancelled = runService.cancel(runId);
      outputValue(io, format, cancelled, renderRunTable(cancelled));
    });

  const agent = program.command('agent').description('agent commands');

  agent
    .command('generate')
    .description('generate output using a configured agent')
    .requiredOption('--agent <agent>', 'codex, claude, or gemini')
    .requiredOption('--prompt <prompt>')
    .option('--mode <mode>', 'local_cli or remote_api', 'local_cli')
    .option('--remote-url <remoteApiUrl>')
    .option('--format <format>', 'table or json', 'table')
    .action(
      async (flags: {
        agent: string;
        prompt: string;
        mode: string;
        remoteUrl?: string;
        format: string;
      }) => {
        const format = parseFormat(flags.format);
        const result = await agentGenerationService.generate({
          agent: parseAgentProvider(flags.agent),
          prompt: flags.prompt,
          mode: parseExecutionMode(flags.mode),
          remoteApiUrl: flags.remoteUrl
        });

        outputValue(io, format, result, renderAgentGenerationResult(result));
      }
    );

  const artifact = program.command('artifact').description('artifact commands');

  artifact
    .command('list')
    .description('list artifacts')
    .argument('<runId>')
    .option('--format <format>', 'table or json', 'table')
    .action((runId: string, flags: { format: string }) => {
      const format = parseFormat(flags.format);
      const paths = artifactService.list(runId);
      outputValue(io, format, paths, renderArtifactList(paths));
    });

  artifact
    .command('show')
    .description('show artifact')
    .argument('<runId>')
    .argument('<artifactPath>')
    .action((runId: string, artifactPath: string) => {
      io.write(artifactService.show(runId, artifactPath));
    });

  artifact
    .command('download')
    .description('download artifacts')
    .argument('<runId>')
    .argument('[artifactPath]')
    .requiredOption('--output <outputDir>')
    .option('--all', 'download all artifacts')
    .option('--format <format>', 'table or json', 'table')
    .action(
      (
        runId: string,
        artifactPath: string | undefined,
        flags: {
          output: string;
          all?: boolean;
          format: string;
        }
      ) => {
        const result = artifactService.download(runId, {
          artifactPath,
          outputDir: flags.output,
          downloadAll: Boolean(flags.all)
        });

        const format = parseFormat(flags.format);
        outputValue(
          io,
          format,
          result,
          [`output: ${result.outputDir}`, `files: ${result.files.join(', ')}`].join('\n')
        );
      }
    );

  artifact
    .command('diff')
    .description('diff artifacts between runs')
    .argument('<leftRunId>')
    .argument('<rightRunId>')
    .requiredOption('--artifact <artifactPath>')
    .action((leftRunId: string, rightRunId: string, flags: { artifact: string }) => {
      const diff = artifactService.diff(leftRunId, rightRunId, flags.artifact);
      io.write(diff);
    });

  artifact
    .command('open')
    .description('open artifact in browser')
    .argument('<runId>')
    .argument('[artifactPath]')
    .action((runId: string, artifactPath: string | undefined) => {
      io.write(artifactService.open(runId, artifactPath));
    });

  artifact
    .command('clean')
    .description('clean retained artifacts')
    .option('--project <projectId>')
    .option('--older-than <days>', 'days', '30')
    .option('--format <format>', 'table or json', 'table')
    .action((flags: { project?: string; olderThan: string; format: string }) => {
      const olderThanDays = Number(flags.olderThan);
      if (!Number.isInteger(olderThanDays) || olderThanDays < 0) {
        throw new Error('--older-than must be a non-negative integer');
      }

      const result = artifactService.clean({
        projectId: flags.project,
        olderThanDays
      });

      const format = parseFormat(flags.format);
      outputValue(
        io,
        format,
        result,
        `removed-runs: ${result.removedRuns.length > 0 ? result.removedRuns.join(', ') : '(none)'}`
      );
    });

  program.command('issues').description('issues commands');

  return program;
}
