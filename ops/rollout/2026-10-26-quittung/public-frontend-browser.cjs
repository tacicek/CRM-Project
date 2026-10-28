// Real unauthenticated Chromium smoke. Blocks API requests and every non-GET/HEAD.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const out = __dirname;
const result = {
  observed_at: new Date().toISOString(),
  release_commit: '3008c18344de51f12d6aaba8673d5cd97ec72115',
  scope: 'Fresh unauthenticated context; no customer API reads or auth mutations',
  scenarios: [],
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const suffix of ['', '/neu']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [], failedAssets = [], blockedApi = [];
      page.on('pageerror', error => errors.push(error.message.slice(0, 400)));
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.pathname.startsWith('/assets/') && response.status() >= 400)
          failedAssets.push({ path: url.pathname, status: response.status() });
      });
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method()) || /^\/(rest|auth|functions|storage|realtime)\//.test(url.pathname)) {
          blockedApi.push({ method: request.method(), path: url.pathname });
          return route.abort('blockedbyclient');
        }
        return route.continue();
      });
      const requestedRoute = '/firma/quittungen' + suffix;
      await page.goto('https://crm-hirschen.ch' + requestedRoute, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForURL(url => url.pathname === '/auth', { timeout: 15000 });
      const loginVisible = await page.locator('input[type="password"]').isVisible();
      if (!loginVisible || errors.length || failedAssets.length) throw new Error(JSON.stringify({ requestedRoute, loginVisible, errors, failedAssets }));
      const screenshot = suffix ? 'frontend-unauth-new.png' : 'frontend-unauth-list.png';
      await page.screenshot({ path: path.join(out, screenshot), fullPage: true });
      result.scenarios.push({ requestedRoute, finalPath: new URL(page.url()).pathname, loginVisible,
        pageErrors: errors, failedAssets, blockedApi, screenshot, passed: true });
      await context.close();
    }
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.error = error.message;
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out, 'frontend-browser-smoke.json'), JSON.stringify(result, null, 2) + '\n');
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
})();
