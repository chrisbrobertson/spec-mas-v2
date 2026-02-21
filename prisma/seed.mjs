import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACT_ROOT = resolve(REPO_ROOT, 'artifacts', 'runs');

async function writeArtifact(runId, artifactPath, content) {
  const destination = resolve(ARTIFACT_ROOT, runId, artifactPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, 'utf8');
}

async function seedProjectAndRuns() {
  const project = await prisma.project.upsert({
    where: {
      repoUrl: 'https://github.com/specmas/alpha'
    },
    update: {
      name: 'alpha'
    },
    create: {
      name: 'alpha',
      repoUrl: 'https://github.com/specmas/alpha',
      defaultBranch: 'main'
    }
  });

  await prisma.run.deleteMany({
    where: {
      projectId: project.id
    }
  });

  const completedRun = await prisma.run.create({
    data: {
      id: 'run-1',
      projectId: project.id,
      status: 'completed',
      startedAt: new Date('2026-02-19T00:00:00.000Z'),
      completedAt: new Date('2026-02-19T00:10:00.000Z'),
      initiatedBy: 'seed-script',
      artifactPath: 'artifacts/runs/run-1'
    }
  });

  const runningRun = await prisma.run.create({
    data: {
      id: 'run-2',
      projectId: project.id,
      status: 'running',
      startedAt: new Date('2026-02-20T00:00:00.000Z'),
      initiatedBy: 'seed-script',
      artifactPath: 'artifacts/runs/run-2'
    }
  });

  await prisma.phase.createMany({
    data: [
      {
        id: 'phase-1',
        runId: runningRun.id,
        name: 'Implement',
        status: 'running',
        startedAt: new Date('2026-02-20T00:00:01.000Z')
      },
      {
        id: 'phase-2',
        runId: runningRun.id,
        name: 'Test',
        status: 'pending'
      },
      {
        id: 'phase-3',
        runId: completedRun.id,
        name: 'Implement',
        status: 'completed',
        startedAt: new Date('2026-02-19T00:00:01.000Z'),
        completedAt: new Date('2026-02-19T00:03:00.000Z')
      },
      {
        id: 'phase-4',
        runId: completedRun.id,
        name: 'Test',
        status: 'completed',
        startedAt: new Date('2026-02-19T00:03:01.000Z'),
        completedAt: new Date('2026-02-19T00:07:00.000Z')
      }
    ]
  });

  await prisma.artifact.createMany({
    data: [
      {
        id: 'artifact-1',
        runId: runningRun.id,
        path: 'validation/gate-results.json',
        type: 'json'
      },
      {
        id: 'artifact-2',
        runId: runningRun.id,
        path: 'run-summary.md',
        type: 'md'
      },
      {
        id: 'artifact-3',
        runId: runningRun.id,
        path: 'phases/test/coverage-report.html',
        type: 'html'
      },
      {
        id: 'artifact-4',
        runId: completedRun.id,
        path: 'run-summary.md',
        type: 'md'
      }
    ]
  });

  await writeArtifact('run-2', 'validation/gate-results.json', JSON.stringify({ gates: ['G1', 'G2'], status: 'ok' }));
  await writeArtifact('run-2', 'run-summary.md', '# Run Summary');
  await writeArtifact(
    'run-2',
    'phases/test/coverage-report.html',
    '<html><head><title>Coverage</title></head><body>ok</body></html>'
  );
  await writeArtifact('run-1', 'run-summary.md', '# Run Summary');
}

async function main() {
  await seedProjectAndRuns();
  // eslint-disable-next-line no-console
  console.log('Seed completed successfully.');
}

main()
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
