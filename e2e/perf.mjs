// Rough performance numbers for the exported web build (dist/) on a large
// synthetic data set: 40 habits, 5 years of check-ins, ~3000 focus sessions.
// Usage: npm run build:web && node e2e/perf.mjs   (numbers vary by machine)
import { chromium } from 'playwright';
import { readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { serve } from './serve.mjs';

const PORT = 4122;
const DAY = 86_400_000;
const TODAY = '2026-11-21';
const key = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const t = Date.parse(`${TODAY}T00:00:00Z`) / DAY;
let seed = 3;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const HABITS = 40, YEARS = 5;
const habits = [], checkins = {}, freezes = {};
for (let i = 0; i < HABITS; i++) {
  const id = `h${i}`;
  habits.push({ id, name: `Habit ${i + 1}`, color: i % 6, schedule: i % 3 ? { kind: 'daily' } : { kind: 'weekly', times: 3 }, createdOn: key(t - 365 * YEARS), reminder: null });
  checkins[id] = [];
  freezes[id] = [];
  for (let n = t - 365 * YEARS; n <= t; n++) if (rand() < 0.75) checkins[id].push(key(n));
}
const sessions = [];
for (let n = t - 365 * YEARS; n <= t; n++) for (let s = 0; s < 2; s++) sessions.push({ id: `s${n}${s}`, habitId: `h${(n + s) % HABITS}`, day: key(n), minutes: 25 });
const data = { habits, checkins, freezes, sessions, reflections: {}, settings: { theme: 'light', haptics: true, focusMinutes: 25, breakMinutes: 5, autoCheckIn: true, reflectionReminder: null } };
const raw = JSON.stringify(data);

const dir = 'dist/_expo/static/js/web';
const js = readdirSync(dir).find((f) => f.endsWith('.js'));
const buf = readFileSync(`${dir}/${js}`);
console.log(`bundle: ${(buf.length / 1024).toFixed(0)} KB, gzip ${(gzipSync(buf).length / 1024).toFixed(0)} KB`);
console.log(`large data: ${habits.length} habits, ${sessions.length} sessions, ${(raw.length / 1024 / 1024).toFixed(1)} MB JSON`);

const server = await serve('dist', PORT);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'UTC' });
const page = await ctx.newPage();
await page.clock.install({ time: new Date(`${TODAY}T12:00:00Z`) });
const url = `http://127.0.0.1:${PORT}/`;

async function load(label, seedRaw) {
  const p = await ctx.newPage();
  await p.addInitScript((r) => r && localStorage.setItem('streakline/data/v1', r), seedRaw);
  const t0 = Date.now();
  await p.goto(url);
  await p.getByRole('tab', { name: 'Today' }).first().waitFor();
  const ms = Date.now() - t0;
  const fcp = await p.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null);
  console.log(`${label}: interactive ${ms} ms, first contentful paint ${fcp && Math.round(fcp)} ms`);
  return p;
}
await (await load('empty app', null)).close();
const big = await load('large data', raw);
for (const name of ['Review', 'Focus', 'Settings', 'Today']) {
  const t0 = Date.now();
  await big.getByRole('tab', { name }).click();
  await big.waitForTimeout(0);
  await big.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  console.log(`large data: open ${name} ${Date.now() - t0} ms`);
}
const frames = () => big.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
let t0 = Date.now();
await big.getByRole('checkbox', { name: 'Habit 2, done today' }).click();
await frames();
console.log(`large data: one check-in tap ${Date.now() - t0} ms`);
t0 = Date.now();
await big.getByRole('button', { name: /^Habit 1,.*Open details/ }).click();
await frames();
console.log(`large data: open a habit's details ${Date.now() - t0} ms`);
await browser.close();
server.close();
