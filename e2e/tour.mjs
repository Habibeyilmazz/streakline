// Screenshot every tab in light and dark, phone and desktop width, for a design review.
// Usage: npm run build:web && node e2e/tour.mjs <out-dir> [empty]
import { chromium } from 'playwright';
import { fixture } from './fixture.mjs';
import { serve } from './serve.mjs';

const out = process.argv[2];
const empty = process.argv[3] === 'empty';
const TODAY = '2026-11-21';
const server = await serve('dist', 4122);
const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, timezoneId: 'UTC', locale: 'en-GB', colorScheme: scheme });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(`${TODAY}T12:00:00Z`) });
    if (!empty) await page.addInitScript((raw) => localStorage.setItem('streakline/data/v1', raw), JSON.stringify({ ...fixture(TODAY).data, settings: { ...fixture(TODAY).data.settings, theme: 'system' } }));
    await page.goto('http://127.0.0.1:4122/');
    await page.waitForTimeout(800);
    const tabs = await page.getByRole('tab').all();
    for (let i = 0; i < tabs.length; i++) {
      await tabs[i].click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${empty ? 'empty-' : ''}${scheme}-${w}-${i}.png`, fullPage: true });
    }
    await ctx.close();
  }
}
await browser.close();
server.close();
