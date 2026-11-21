// Run axe-core on every tab and the habit sheet (open and paused), light and dark.
// Usage: npm run build:web && node e2e/axe.mjs <path-to-axe.min.js>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fixture } from './fixture.mjs';
import { serve } from './serve.mjs';

const axe = readFileSync(process.argv[2], 'utf8');
const TODAY = '2026-11-21';
const server = await serve('dist', 4122);
const browser = await chromium.launch();
let bad = 0;
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'UTC', locale: 'en-GB', colorScheme: scheme });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(`${TODAY}T12:00:00Z`) });
  await page.addInitScript((raw) => localStorage.setItem('streakline/data/v1', raw), JSON.stringify({ ...fixture(TODAY).data, settings: { ...fixture(TODAY).data.settings, theme: 'system' } }));
  await page.goto('http://127.0.0.1:4122/');
  await page.waitForTimeout(800);
  const check = async (name) => {
    await page.evaluate(axe);
    const r = await page.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
    for (const v of r.violations) { bad++; console.log(`${scheme} ${name}: ${v.id} (${v.impact}) ${v.nodes.length}x ${v.nodes[0].target}`); }
    console.log(`${scheme} ${name}: ${r.violations.length} violations`);
  };
  const tabs = await page.getByRole('tab').all();
  for (let i = 0; i < tabs.length; i++) { await tabs[i].click(); await page.waitForTimeout(300); await check(`tab ${i}`); }
  await tabs[0].click();
  await page.getByRole('button', { name: /Practice guitar.*Open details/ }).click();
  await page.waitForTimeout(500);
  await check('sheet');
  await page.getByRole('button', { name: 'Pause a week', exact: true }).click();
  await page.getByText(/comes back by itself/).waitFor();
  await page.waitForTimeout(400);
  await check('sheet paused');
  await ctx.close();
}
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
