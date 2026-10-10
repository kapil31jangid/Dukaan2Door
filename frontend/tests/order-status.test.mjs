import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let OrderStatusTimeline;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ OrderStatusTimeline } = await server.ssrLoadModule('/src/components/customer/OrderStatusTimeline.tsx'));
});
after(async () => { await server?.close(); });

const render = currentStatus => renderToStaticMarkup(React.createElement(OrderStatusTimeline, { currentStatus }));

test('delivered is completed, not an animated in-progress step', () => {
  const html = render('DELIVERED');
  assert.match(html, /Delivered/);
  assert.doesNotMatch(html, /In progress|animate-pulse/);
  assert.equal((html.match(/lucide-check/g) || []).length, 6);
});

test('out for delivery keeps the current progress indicator', () => {
  const html = render('OUT_FOR_DELIVERY');
  assert.match(html, /In progress/);
  assert.match(html, /Out for Delivery/);
});

for (const status of ['REJECTED', 'CANCELLED']) {
  test(`${status} does not display an active fulfillment timeline`, () => {
    const html = render(status);
    assert.doesNotMatch(html, /In progress|animate-pulse|Ready for Pickup/);
    assert.match(html, /rejected|cancelled/i);
  });
}
