// Optional read-only browser check. Requires Playwright and the local API.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'http://localhost:3000';
const output = path.resolve(__dirname, '../test-results');
const portals = [
  ['customer', 'Use customer demo', ['/customer/home', '/customer/search', '/customer/store', '/customer/cart', '/customer/orders', '/customer/profile']],
  ['retailer', 'Use retailer demo', ['/retailer', '/retailer/inventory', '/retailer/orders', '/retailer/performance']],
  ['delivery', 'Use partner demo', ['/delivery', '/delivery/orders', '/delivery/current', '/delivery/history', '/delivery/profile']],
];

(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [], failedRequests = [];
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const [role, demo, routes] of portals) {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push({ role, message: error.message }));
      page.on('response', response => {
        if (response.url().includes('/api/') && response.status() >= 400) {
          failedRequests.push({ role, path: new URL(response.url()).pathname, status: response.status() });
        }
      });
      await page.goto(`${base}/login/${role}`);
      await page.getByRole('button', { name: demo, exact: true }).click();
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20000 });
      for (const route of routes) {
        await page.goto(base + route);
        await page.getByRole('main').waitFor();
        await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
        for (const width of [360, 390, 414, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          results.push({ route, width, scrollWidth, overflow: scrollWidth > width });
          if (width === 390 || width === 1440) {
            await page.screenshot({ path: path.join(output, `${route.replaceAll('/', '_')}-${width}.png`), fullPage: true });
          }
        }
      }
      await context.close();
      console.log(`${role}: checked ${routes.length} routes`);
    }
    fs.writeFileSync(path.join(output, 'responsive.json'), JSON.stringify({ results, errors, failedRequests }, null, 2));
    const overflow = results.filter(result => result.overflow);
    console.log(JSON.stringify({ checks: results.length, overflow, errors, failedRequests }, null, 2));
    if (overflow.length || errors.length || failedRequests.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
