import { createServer, type CreateServerOptions } from './server.js';

export interface StartApiOptions extends CreateServerOptions {
  port?: number;
  host?: string;
}

export async function startApi(options: StartApiOptions = {}) {
  const server = createServer(options);
  await server.listen({ host: options.host ?? '0.0.0.0', port: options.port ?? 3100 });
  return server;
}
