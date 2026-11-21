// End-to-end check of the exported web build at a phone-sized viewport.
// Usage: npm run build:web && npm run e2e [-- --screenshots]
// With --screenshots the README images in docs/screenshots/ are rewritten.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

import { fixture } from './fixture.mjs';
import { serve } from './serve.mjs';

const PORT = 4121;
const TODAY = '2026-11-21'; // a Saturday; the browser clock is pinned to noon UTC on this day
const shots = process.argv.includes('--screenshots') ? 'docs/screenshots' : null;
const tmp = mkdtempSync(join(tmpdir(), 'streakline-e2e-'));

if (!existsSync('dist/index.html')) {
  console.error('dist/ is missing. Build the web app first: npm run build:web');
  process.exit(1);
}
const server = await serve('dist', PORT);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'UTC', locale: 'en-GB' });
const page = await context.newPage();
await page.clock.install({ time: new Date(`${TODAY}T12:00:00Z`) });

const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`console ${m.type()}: ${m.text()}`));

const button = (name) => page.getByRole('button', { name, exact: typeof name === 'string' });
const tab = (name) => page.getByRole('tab', { name });
const text = (t) => page.getByText(t, { exact: typeof t === 'string' });
const seen = (locator) => locator.first().waitFor({ state: 'visible', timeout: 5000 });
const shot = async (name) => {
  if (!shots) return;
  await page.waitForTimeout(400); // let the sheet slide settle
  await page.screenshot({ path: `${shots}/${name}.png` });
};
let step = '';
const stage = (name) => console.log(`- ${(step = name)}`);

try {
  await page.goto(`http://127.0.0.1:${PORT}/`);

  stage('empty state, validation, first habit');
  await seen(text('Nothing to track yet.'));
  await button('Add a habit').click();
  await button('Add habit').click();
  await seen(text('Give the habit a name.'));
  await page.getByLabel('Name').fill('Drink water');
  await page.getByRole('radio', { name: 'Certain days' }).click();
  for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) await page.getByRole('checkbox', { name: d }).click();
  await button('Add habit').click();
  await seen(text('Pick at least one day.'));
  await page.getByRole('radio', { name: 'Every day' }).click();
  await button('Add habit').click();

  stage('one-tap check-in and persistence across reload');
  const water = page.getByRole('checkbox', { name: 'Drink water, done today' });
  await seen(text('0 of 1 done today'));
  await water.click();
  await seen(text('All 1 done today'));
  assert.equal(await water.getAttribute('aria-checked'), 'true');
  await seen(button(/Drink water.*1 day streak/));
  await page.reload();
  await seen(text('All 1 done today'));
  await water.click();
  await seen(text('0 of 1 done today'));

  stage('import: bad file is refused, good file asks before replacing');
  const bad = join(tmp, 'bad.json');
  const good = join(tmp, 'backup.json');
  writeFileSync(bad, JSON.stringify({ hello: 'world' }));
  writeFileSync(good, JSON.stringify(fixture(TODAY)));
  const pick = async (file) => {
    const chooser = page.waitForEvent('filechooser');
    await button('Import backup').click();
    await (await chooser).setFiles(file);
  };
  await tab('Settings').click();
  await pick(bad);
  await seen(text('Nothing was imported. This is not a Streakline backup file.'));
  await pick(good);
  await seen(text(/The backup holds 5 habits, .* It replaces what is here now: 1 habit, 0 check-ins/));
  await button('Replace my data').click();
  await seen(text('Backup imported.'));

  stage('today: schedules, streaks, streak line');
  await tab('Today').click();
  await seen(text('2 of 4 done today'));
  await seen(text('Not due today')); // Strength training is Mon, Wed, Fri
  await seen(button(/Read 20 pages, Every day, 38 day streak/));
  await seen(button(/Morning run, \d of 3 this week, \d+ week streak/));
  await seen(button(/Strength training, Mon, Wed, Fri, \d+ day streak/));
  await seen(page.getByRole('img', { name: 'Last 14 days: 12 done, 0 missed, 1 frozen' }));
  await shot('today');

  stage('keyboard: Space checks in, the focus ring shows, Escape closes a sheet');
  const read = page.getByRole('checkbox', { name: 'Read 20 pages, done today' });
  await read.focus();
  await page.keyboard.press('Space');
  await seen(text('3 of 4 done today'));
  await page.keyboard.press('Space');
  await seen(text('2 of 4 done today'));
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineColor);
  assert.equal(ring, 'solid rgb(22, 32, 42)'); // the light theme's ink
  await page.keyboard.press('Enter');
  await seen(page.getByLabel('Current streak: 38 days'));
  await page.waitForTimeout(400); // react-native-web ignores Escape until the sheet has finished sliding in
  await page.keyboard.press('Escape');
  await page.getByLabel('Current streak: 38 days').waitFor({ state: 'hidden', timeout: 5000 });
  await page.waitForFunction(() => /^Read 20 pages.*Open details$/.test(document.activeElement.getAttribute('aria-label'))); // focus is back where it was

  await button('Add a habit').click(); // this sheet focuses its Name field, which used to lose the way back
  await seen(page.getByLabel('Name'));
  await button('Close').click();
  await page.getByLabel('Name').waitFor({ state: 'hidden', timeout: 5000 });
  await page.waitForFunction(() => document.activeElement.textContent === 'Add a habit');

  stage('reduced motion: the sheet does not slide');
  const sliding = async () => {
    await button(/Read 20 pages.*Open details/).click();
    await seen(page.getByLabel('Current streak: 38 days'));
    await page.waitForTimeout(400);
    // The slide is a CSS animation that stays on the sheet's wrapper for as long as it is open.
    const animated = await page.evaluate(() => [...document.querySelectorAll('*')].some((e) => getComputedStyle(e).animationName !== 'none'));
    await button('Close').click();
    await page.getByLabel('Current streak: 38 days').waitFor({ state: 'hidden', timeout: 5000 });
    return animated;
  };
  assert.equal(await sliding(), true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await sliding(), false);
  await page.emulateMedia({ reducedMotion: null });

  stage('habit detail: heatmap, backfill, freeze rules');
  await button(/Read 20 pages.*Open details/).click();
  await seen(page.getByLabel('Current streak: 38 days'));
  await seen(page.getByRole('img', { name: /Past year of Read 20 pages: \d+ days done/ }));
  await shot('habit');
  const yesterday = page.getByRole('checkbox', { name: /^Fri 20 Nov/ });
  await yesterday.click(); // undo yesterday: the streak is now broken
  await seen(page.getByLabel('Current streak: 0 days'));
  await seen(page.getByLabel('Best streak: 37 days'));
  await button('Freeze yesterday').click(); // a freeze bridges it, without counting as done
  await seen(page.getByLabel('Current streak: 37 days'));
  await seen(text('Both freezes for this month are used.')); // 9 Nov and 20 Nov
  assert.equal(await button('Freeze today').isDisabled(), true);
  await button('Unfreeze yesterday').click();
  await yesterday.click();
  await seen(page.getByLabel('Current streak: 38 days'));

  stage('edit a habit');
  await button('Edit habit').click();
  await page.getByLabel('Name').fill('Read 25 pages');
  await button('Save changes').click();
  await seen(page.getByRole('heading', { name: 'Read 25 pages' }));
  await button('Edit habit').click();
  await page.getByLabel('Name').fill('Read 20 pages');
  await button('Save changes').click();
  await button('Close').click();

  stage('archive hides a habit but keeps its history; restore brings it back');
  await button(/Practice guitar.*Open details/).click();
  await seen(page.getByLabel('Current streak: 2 days'));
  await button('Archive habit').click();
  await seen(page.getByLabel('Streak when archived: 2 days'));
  await seen(page.getByRole('img', { name: /Past year of Practice guitar: \d+ days done/ }));
  assert.equal(await page.getByRole('checkbox', { name: /^Fri 20 Nov/ }).count(), 0); // no backfill while archived
  await button('Close').click();
  await seen(text('1 of 3 done today'));
  await seen(button('Practice guitar, archived 21 Nov. Open details'));
  await tab('Focus').click();
  await seen(page.getByRole('radio', { name: 'Read 20 pages' }));
  assert.equal(await page.getByRole('radio', { name: 'Practice guitar' }).count(), 0);
  await page.reload();
  await seen(text('1 of 3 done today'));
  await button(/Practice guitar, archived/).click();
  await shot('archived-detail');
  await button('Restore habit').click();
  await seen(page.getByLabel('Current streak: 2 days'));
  await button('Close').click();
  await seen(text('2 of 4 done today'));
  assert.equal(await text('Archived').count(), 0);

  stage('reorder habits: the new order shows on Today and survives a reload');
  const firstHabit = () => page.getByRole('checkbox', { name: /, done today$/ }).first().getAttribute('aria-label');
  assert.equal(await firstHabit(), 'Read 20 pages, done today');
  await button('Reorder').click();
  assert.equal(await button('Move Read 20 pages up').isDisabled(), true);
  for (let i = 0; i < 4; i++) await button('Move No phone after 22:00 up').click();
  assert.equal(await button('Move No phone after 22:00 up').isDisabled(), true);
  await shot('reorder');
  await button('Done').click();
  assert.equal(await firstHabit(), 'No phone after 22:00, done today');
  await page.reload();
  await seen(text('2 of 4 done today'));
  assert.equal(await firstHabit(), 'No phone after 22:00, done today');
  await button('Reorder').click();
  for (let i = 0; i < 4; i++) await button('Move No phone after 22:00 down').click();
  await button('Done').click();
  assert.equal(await firstHabit(), 'Read 20 pages, done today');

  stage('small phone (320 wide), longest allowed name: no control runs off the screen');
  const LONG = 'Read twenty pages of the book club novel'; // 40 characters, the limit
  await page.setViewportSize({ width: 320, height: 640 });
  await button(/Read 20 pages.*Open details/).click();
  await button('Edit habit').click();
  await page.getByLabel('Name').fill(LONG);
  await button('Save changes').click();
  await button('Close').click();
  for (const name of ['Today', 'Focus', 'Review']) {
    await tab(name).click();
    await seen(text(LONG));
    const off = await page.evaluate(() => [...document.querySelectorAll('[role="button"], [role="radio"], [role="checkbox"], [role="tab"]')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).map((e) => e.textContent));
    assert.deepEqual(off, [], `off screen on ${name}`);
  }
  await tab('Today').click();
  await button(/Read twenty.*Open details/).click();
  await button('Edit habit').click();
  await page.getByLabel('Name').fill('Read 20 pages');
  await button('Save changes').click();
  await button('Close').click();
  await page.setViewportSize({ width: 390, height: 844 });

  stage('focus timer: pause holds, finishing logs a session and checks the habit in');
  await tab('Focus').click();
  await seen(text('No sessions yet today'));
  await page.getByRole('radio', { name: 'Read 20 pages' }).click();
  await button('Start 25 minute focus').click();
  await seen(text('Focusing'));
  await page.clock.fastForward('10:00');
  await seen(page.getByRole('timer', { name: /^1[45] minutes/ }));
  await shot('focus');
  await button('Pause').click();
  await seen(text('Paused'));
  const held = await page.getByRole('timer').getAttribute('aria-label');
  await page.clock.fastForward('30:00');
  assert.equal(await page.getByRole('timer').getAttribute('aria-label'), held);
  await button('Resume').click();
  await page.clock.fastForward('15:01');
  await seen(text('Today: 25 min in 1 session'));
  await button('Take a 5 minute break').click();
  await seen(text('Rest your eyes'));
  await button('Stop').click();
  await seen(text('Today: 25 min in 1 session')); // a break logs nothing
  await tab('Today').click();
  await seen(text('3 of 4 done today'));
  await seen(button(/Read 20 pages, Every day, 39 day streak/));

  stage('evening reflection saves and survives a reload');
  await tab('Reflect').click();
  const answers = ['Read on the train instead of scrolling.', 'A late meeting ate the evening.', 'Lay out the running shoes tonight.'];
  const prompts = ['What went well today?', 'What got in the way?', 'What is the one thing for tomorrow?'];
  for (let i = 0; i < 3; i++) await page.getByLabel(prompts[i]).fill(answers[i]);
  await shot('reflect');
  await button('Save reflection').click();
  await seen(button('Saved'));
  await page.reload();
  await tab('Reflect').click();
  for (let i = 0; i < 3; i++) assert.equal(await page.getByLabel(prompts[i]).inputValue(), answers[i]);
  await seen(text('Friday, 20 November'));

  stage('a draft is kept when leaving the tab without saving');
  await page.getByLabel(prompts[0]).fill('Edited but not saved.');
  await tab('Today').click();
  await tab('Reflect').click();
  assert.equal(await page.getByLabel(prompts[0]).inputValue(), 'Edited but not saved.');

  stage('weekly review: honest counts and week navigation');
  await tab('Review').click();
  await seen(text('This week so far'));
  await seen(text('16 to 22 Nov'));
  await seen(text(/^\d+ of \d+ check-ins kept, \d+%\.$/));
  await seen(text(/1 still open/)); // Morning run can still be done this week
  await seen(text('Reflected on 5 of 7 evenings.'));
  await seen(page.getByLabel(/^Read 20 pages: 6 of 6\. Monday done, .*Saturday done, Sunday not tracked/));
  await shot('review');
  assert.equal(await button('Next week').isDisabled(), true);
  await button('Previous week').click();
  await seen(text('Last week'));
  await seen(text('9 to 15 Nov'));
  await seen(page.getByLabel(/^Read 20 pages: 6 of 6\. Monday frozen/)); // frozen day is excused, not done
  await seen(text(/1 frozen/));
  await button('Next week').click();
  await seen(text('This week so far'));

  stage('export downloads a backup that matches what is on screen');
  await tab('Settings').click();
  const download = page.waitForEvent('download');
  await button('Export backup').click();
  const file = await download;
  assert.equal(file.suggestedFilename(), `streakline-backup-${TODAY}.json`);
  const exported = JSON.parse(readFileSync(await file.path(), 'utf8'));
  assert.equal(exported.app, 'streakline');
  assert.equal(exported.data.habits.length, 5);
  assert.ok(exported.data.checkins.read.includes(TODAY));
  const { id: _id, ...lastSession } = exported.data.sessions.at(-1);
  assert.deepEqual(lastSession, { habitId: 'read', day: TODAY, minutes: 25 });
  assert.equal(exported.data.reflections[TODAY].answers[0], 'Edited but not saved.');

  stage('dark theme');
  await page.getByRole('radio', { name: 'Dark' }).click();
  assert.equal(await page.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked'), 'true');
  await tab('Today').click();
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('[role="navigation"]').parentElement).backgroundColor);
  assert.equal(bg, 'rgb(18, 24, 31)');
  await shot('today-dark');

  stage('delete a habit, then erase everything (both need a second tap)');
  await button(/Practice guitar.*Open details/).click();
  await button('Edit habit').click();
  await button('Delete habit').click();
  await button('Tap again to delete for good').click();
  await seen(text('2 of 3 done today'));
  await tab('Settings').click();
  await button('Erase all data').click();
  const armedFill = await button('Tap again to erase everything').evaluate((e) => getComputedStyle(e).backgroundColor);
  assert.equal(armedFill, 'rgb(255, 138, 128)'); // once armed, the button fills with the dark theme's danger colour
  await button('Tap again to erase everything').click();
  await tab('Today').click();
  await seen(text('Nothing to track yet.'));

  stage('midnight: an unsaved reflection goes to the day it was written on');
  await tab('Reflect').click();
  await page.getByLabel(prompts[0]).fill('Written just before midnight.');
  await page.clock.fastForward('12:00:30'); // noon -> past midnight
  await seen(text('Evening reflection, Sunday'));
  assert.equal(await page.getByLabel(prompts[0]).inputValue(), '');
  await seen(text('Saturday, 21 November'));
  await seen(text('Written just before midnight.'));
  await tab('Today').click();
  await seen(text('22 November'));

  stage('damaged stored data: a copy is offered before anything is replaced');
  const damaged = '{"habits":"oops"}';
  await page.evaluate((raw) => localStorage.setItem('streakline/data/v1', raw), damaged);
  await page.reload();
  await seen(text('Your saved data is damaged and could not be opened.'));
  const copy = page.waitForEvent('download');
  await button('Save a copy of the data').click();
  assert.equal(readFileSync(await (await copy).path(), 'utf8'), damaged);
  assert.equal(await page.evaluate(() => localStorage.getItem('streakline/data/v1')), damaged); // still untouched
  await button('Start empty').click();
  await button('Tap again to start empty').click();
  await seen(text('Nothing to track yet.'));
  assert.equal(await page.evaluate(() => localStorage.getItem('streakline/unreadable')), damaged);

  stage('a second tab saves a habit: the first tab shows it and keeps its focus timer');
  await tab('Focus').click();
  await button('Start 25 minute focus').click();
  await button('Pause').click();
  await seen(text('Paused'));
  const other = await context.newPage();
  await other.goto(`http://127.0.0.1:${PORT}/`);
  await other.getByRole('button', { name: 'Add a habit', exact: true }).click();
  await other.getByLabel('Name').fill('Made in tab two');
  await other.getByRole('button', { name: 'Add habit', exact: true }).click();
  await other.getByRole('tab', { name: 'Focus' }).click();
  await seen(other.getByText('Paused')); // the timer from the first tab is loaded
  await other.close();
  await seen(text('Paused')); // adopting the other tab's data did not wipe the timer
  await tab('Today').click();
  await seen(page.getByText('Made in tab two'));
  await tab('Focus').click();
  await button('Stop').click();

  assert.deepEqual(problems, []);
  console.log('e2e passed');
} catch (e) {
  console.error(`e2e FAILED during: ${step}`);
  console.error(e);
  await page.screenshot({ path: join(tmp, 'failure.png') }).catch(() => {});
  console.error(`screenshot: ${join(tmp, 'failure.png')}`);
  if (problems.length) console.error(problems.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
