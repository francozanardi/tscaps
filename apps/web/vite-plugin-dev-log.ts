import type { Plugin } from 'vite';
import { appendFile } from 'node:fs/promises';

const LOG_FILE = '/tmp/tscaps-dev-client-logs.txt';
const ENDPOINT = '/__client_log';

/**
 * Dev-only Vite plugin. Accepts POST requests at `/__client_log`
 * and appends the request body, plus a server-side timestamp, to a
 * file on disk. Pairs with the client-side `DevLogBridge` so a
 * developer can `tail -f` browser console output from any session
 * without reaching for the DevTools of that particular device.
 *
 * Inactive on `vite build` / `vite preview`.
 */
export function devLogCollectorPlugin(): Plugin {
  return {
    name: 'tscaps-dev-log-collector',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(ENDPOINT, async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req as AsyncIterable<Buffer>) chunks.push(chunk);
          const body = Buffer.concat(chunks).toString('utf-8');
          const line = `${new Date().toISOString()} ${body}\n`;
          await appendFile(LOG_FILE, line);
          res.statusCode = 204;
          res.end();
        } catch (err) {
          server.config.logger.error(`[dev-log-collector] write failed: ${(err as Error).message}`);
          res.statusCode = 500;
          res.end();
        }
      });
      server.config.logger.info(`[dev-log-collector] accepting client logs at ${ENDPOINT} → ${LOG_FILE}`);
    },
  };
}
