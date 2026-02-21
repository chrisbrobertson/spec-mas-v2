import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      projectId: project.id,
      status: 'completed',
      startedAt: new Date('2026-02-19T00:00:00.000Z'),
      completedAt: new Date('2026-02-19T00:10:00.000Z'),
      initiatedBy: 'seed-script'
    }
  });

  const runningRun = await prisma.run.create({
    data: {
      projectId: project.id,
      status: 'running',
      startedAt: new Date('2026-02-20T00:00:00.000Z'),
      initiatedBy: 'seed-script'
    }
  });

  await prisma.phase.createMany({
    data: [
      {
        runId: runningRun.id,
        name: 'Implement',
        status: 'running',
        startedAt: new Date('2026-02-20T00:00:01.000Z')
      },
      {
        runId: runningRun.id,
        name: 'Test',
        status: 'pending'
      },
      {
        runId: completedRun.id,
        name: 'Implement',
        status: 'completed',
        startedAt: new Date('2026-02-19T00:00:01.000Z'),
        completedAt: new Date('2026-02-19T00:03:00.000Z')
      },
      {
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
        runId: runningRun.id,
        path: 'validation/gate-results.json',
        type: 'json'
      },
      {
        runId: runningRun.id,
        path: 'run-summary.md',
        type: 'md'
      },
      {
        runId: runningRun.id,
        path: 'phases/test/coverage-report.html',
        type: 'html'
      }
    ]
  });
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
