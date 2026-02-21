import { spawn } from 'node:child_process';

const processes = [];
let shuttingDown = false;

function launch(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv
    }
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code === 0) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    console.error(`[dev:full] ${name} exited with ${reason}`);
    shutdown(1);
  });

  processes.push(child);
}

function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of processes) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 0);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

launch('api', 'corepack', ['pnpm', '--filter', '@specmas/api', 'dev'], {
  API_PORT: '3100',
  API_HOST: '0.0.0.0',
  CORS_ORIGIN: 'http://localhost:3000'
});

launch('web', 'corepack', ['pnpm', '--filter', '@specmas/web', 'dev']);
