import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let server;
let reconnectDelayMs;
let MAX_RECONNECT_ATTEMPTS;

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ reconnectDelayMs, MAX_RECONNECT_ATTEMPTS } = await server.ssrLoadModule('/src/services/websocketService.ts'));
});

after(async () => { await server?.close(); });

test('websocket retries are bounded and use capped exponential delays', () => {
  assert.equal(MAX_RECONNECT_ATTEMPTS, 5);
  assert.deepEqual(
    Array.from({ length: MAX_RECONNECT_ATTEMPTS }, (_, attempt) => reconnectDelayMs(attempt)),
    [1000, 2000, 4000, 8000, 15000],
  );
  assert.equal(reconnectDelayMs(10), 15000);
});
