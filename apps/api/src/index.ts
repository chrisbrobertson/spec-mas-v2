import { createServer, type CreateServerOptions } from './server.js';
import { runDatabasePreflight } from './dbPreflight.js';

export interface StartApiOptions extends CreateServerOptions {
  port?: number;
  host?: string;
  skipDatabasePreflight?: boolean;
}

export async function startApi(options: StartApiOptions = {}) {
  if (!options.skipDatabasePreflight) {
    await runDatabasePreflight();
  }

  const server = createServer(options);
  await server.listen({ host: options.host ?? '0.0.0.0', port: options.port ?? 3100 });
  return server;
}
