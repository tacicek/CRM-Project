// Real unauthenticated Chromium smoke. Blocks API requests and every non-GET/HEAD.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const out = __dirname;
const result = {
  observed_at: new Date().toISOString(),
  release_commit: 'c3915408ab7c65394d48fa618237b1900b43a4f2',
  scope: 'Fresh unauthenticated context; no customer API reads or auth mutations',
  readiness: 'HTTP 200 document, DOMContentLoaded, expected /auth redirect, visible password input, loaded entry JS, no page errors or failed assets',
  previous_attempt: 'frontend-browser-first-attempt.json retained: first attempt timed out waiting for networkidle before route assertions',
  scenarios: [],
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const suffix of ['', '/neu']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [], failedAssets = [], blockedApi = [], failedRequests = [], loadedAssets = [];
      const pending = new Map();
      const describe = request => {
        const url = new URL(request.url());
        return { method: request.method(), host: url.host, path: url.pathname, type: request.resourceType() };
      };
      page.on('request', request => pending.set(request, describe(request)));
      page.on('requestfinished', request => pending.delete(request));
      page.on('requestfailed', request => {
        pending.delete(request);
        failedRequests.push({ ...describe(request), error: request.failure()?.errorText });
      });
      page.on('pageerror', error => errors.push(error.message.slice(0, 400)));
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.pathname.startsWith('/assets/') && response.status() >= 400)
          failedAssets.push({ path: url.pathname, status: response.status() });
        if (url.pathname.startsWith('/assets/') && response.status() === 200)
          loadedAssets.push(url.pathname);
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
      const scenario = { requestedRoute, passed: false };
      const started = Date.now();
      try {
        const response = await page.goto('https://crm-hirschen.ch' + requestedRoute, { waitUntil: 'domcontentloaded', timeout: 45000 });
        scenario.documentStatus = response?.status();
        await page.waitForURL(url => url.pathname === '/auth', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 20000 });
        scenario.loginVisible = await page.locator('input[type="password"]').isVisible();
        scenario.entryJsLoaded = loadedAssets.some(asset => /^\/assets\/index-[^/]+\.js$/.test(asset));
        if (scenario.documentStatus !== 200 || !scenario.loginVisible || !scenario.entryJsLoaded)
          throw new Error('Expected document, entry JS, and visible login form did not all load');
        const screenshot = suffix ? 'frontend-unauth-new.png' : 'frontend-unauth-list.png';
        await page.screenshot({ path: path.join(out, screenshot), fullPage: true, timeout: 20000 });
        scenario.screenshot = screenshot;
        if (errors.length || failedAssets.length || failedRequests.some(request => request.path.startsWith('/assets/')))
          throw new Error('Page JavaScript error or failed application asset observed');
        scenario.passed = true;
      } catch (error) {
        scenario.error = error.message;
        throw error;
      } finally {
        Object.assign(scenario, { finalPath: new URL(page.url()).pathname, elapsedMs: Date.now() - started,
          pageErrors: errors, failedAssets, failedRequests, loadedAssets, blockedApi, pendingRequests: [...pending.values()] });
        result.scenarios.push(scenario);
        await context.close();
      }
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
