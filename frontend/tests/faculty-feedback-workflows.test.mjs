import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inventoryModal = readFileSync(new URL('../src/components/retailer/InventoryOnboardingModal.tsx', import.meta.url), 'utf8');
const retailerService = readFileSync(new URL('../src/services/retailerService.ts', import.meta.url), 'utf8');
const availableOrders = readFileSync(new URL('../src/pages/delivery/AvailableOrdersPage.tsx', import.meta.url), 'utf8');
const deliveryService = readFileSync(new URL('../src/services/deliveryService.ts', import.meta.url), 'utf8');
const currentDelivery = readFileSync(new URL('../src/pages/delivery/CurrentDeliveryPage.tsx', import.meta.url), 'utf8');
const retailerOrders = readFileSync(new URL('../src/pages/retailer/RetailerOrdersPage.tsx', import.meta.url), 'utf8');
const orderConfirmation = readFileSync(new URL('../src/pages/customer/OrderConfirmationPage.tsx', import.meta.url), 'utf8');
const apiClient = readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8');
const routePlaybackService = readFileSync(new URL('../../backend/app/services/route_playback_service.py', import.meta.url), 'utf8');
const deliveryBackendService = readFileSync(new URL('../../backend/app/services/delivery_service.py', import.meta.url), 'utf8');

test('inventory entry exposes bill, product-photo, and explicit adjustment workflows', () => {
  assert.match(inventoryModal, /Upload Bill \/ Handwritten List/);
  assert.match(inventoryModal, /Scan Product Photo/);
  assert.match(inventoryModal, /Add \/ Reduce Stock/);
  assert.match(inventoryModal, /Enter a new product manually/);
});

test('product-photo review requires catalogue selection and previews resulting stock', () => {
  assert.match(inventoryModal, /Select the exact product and pack size/);
  assert.match(inventoryModal, /Current.*expected/s);
  assert.match(inventoryModal, /Confirm Stock Adjustments/);
  assert.match(retailerService, /analyze-product-photo/);
  assert.match(retailerService, /retailer\/inventory\/adjust/);
});

test('inventory adjustment offers direction, reason, loading, and validation states', () => {
  assert.match(inventoryModal, /Adjustment direction/);
  assert.match(inventoryModal, /New stock received/);
  assert.match(inventoryModal, /Damaged product/);
  assert.match(inventoryModal, /Stock cannot go below zero/);
  assert.match(inventoryModal, /isLoading=\{isWorking\}/);
});

test('available delivery requests expose backend-backed accept and decline controls', () => {
  assert.match(availableOrders, />\s*Decline\s*<\/Button>/);
  assert.match(availableOrders, />\s*Accept\s*<\/Button>/);
  assert.match(availableOrders, /declineAvailableOrder/);
  assert.match(deliveryService, /available-orders\/\$\{orderId\}\/decline/);
});

test('retailer and rider opportunity pools are visible in the demo UI', () => {
  assert.match(orderConfirmation, /eligible nearby store/);
  assert.match(retailerOrders, /Shared with \{order\.retailer_pool_size/);
  assert.match(availableOrders, /Shared rider pool/);
  assert.match(availableOrders, /eligible_rider_pool_size/);
});

test('demo accounts keep authentication isolated between browser tabs', () => {
  assert.match(apiClient, /sessionStorage\.getItem\(TOKEN_KEY\)/);
  assert.match(apiClient, /sessionStorage\.setItem\(TOKEN_KEY, token\)/);
  assert.doesNotMatch(apiClient, /return localStorage\.getItem\('d2d_access_token'\)/);
});

test('delivery route playback covers pickup and customer legs with arrival-gated actions', () => {
  assert.match(currentDelivery, /VITE_ENABLE_ROUTE_PLAYBACK === 'true'/);
  assert.match(availableOrders, /updateDeliveryStatus\(claimed\.delivery\.id, "ACCEPTED"\)/);
  assert.match(currentDelivery, /updateDeliveryStatus\(delivery\.id, 'OUT_FOR_DELIVERY'\)/);
  assert.match(currentDelivery, /pickupDwellSeconds = 120/);
  assert.match(currentDelivery, /DeliveryWebSocketClient/);
  assert.doesNotMatch(currentDelivery, /requestAnimationFrame/);
  assert.doesNotMatch(currentDelivery, />Pause</);
  assert.doesNotMatch(currentDelivery, />Stop</);
  assert.match(routePlaybackService, /asyncio\.create_task/);
  assert.match(routePlaybackService, /ROUTE_PLAYBACK_SOURCE = "ROUTE_PLAYBACK"/);
  assert.match(routePlaybackService, /get_route/);
  assert.match(deliveryBackendService, /PICKUP_DWELL_SECONDS/);
});

test('active delivery polling is serialized and telemetry writes are bounded', () => {
  assert.match(currentDelivery, /if \(loadInFlight\.current\) return/);
  assert.match(currentDelivery, /loadInFlight\.current = false/);
  assert.match(currentDelivery, /hasLoadedCurrentDelivery\.current/);
  assert.doesNotMatch(currentDelivery, /deliveryService\.updateLocation/);
});
