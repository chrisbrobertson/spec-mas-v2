import { startApi } from './index.js';
import { resolveApiHost, resolveApiPort, resolveCorsOrigin } from './runtimeConfig.js';

async function run(): Promise<void> {
  const port = resolveApiPort(process.argv.slice(2), process.env.API_PORT ?? process.env.PORT);
  const host = resolveApiHost(process.env.API_HOST);
  const corsOrigin = resolveCorsOrigin(process.env.CORS_ORIGIN);

  const server = await startApi({
    host,
    port,
    corsOrigin
  });

  const address = server.server.address();
  if (typeof address === 'string') {
    // eslint-disable-next-line no-console
    console.log(`Spec-MAS API listening on ${address}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`Spec-MAS API listening on http://${host}:${address?.port ?? port}`);
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
});
