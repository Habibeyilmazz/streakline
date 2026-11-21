# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Reliability pass (round 13)

- Fixed: the Today streak line drew paused days (archived, then restored) as a blank gap. `dayStatus` now returns `'paused'` for them (it used to return `'none'`); the line draws a dotted mark, the legend has a "Paused" entry and the spoken summary counts them. Existing tests that expected `'none'` for paused days were updated; the heatmaps and review treat `'paused'` as before (left out of counts).
- Fixed: `e2e/serve.mjs` crashed on a malformed `%` escape in the URL; it now answers 400. Checked by the e2e run.
- Probed, no bug: a backup holding every day from 1970 to 2199 for three habits (streak, freeze check, week review, year heatmap) computes in about 130 ms. Unit suite passes in the five time zones and on a 200 KB stack; e2e passes.
- Still true: never run on a phone or Hermes; security-review skill not run (needs a git working directory); no "pause until" date.

### Pause a habit (round 12, feature)

Picked by using the app as a newcomer: a week away or ill cost every streak. A freeze covers one day (two a month); archiving hid the habit but restoring it read every archived day as missed. "Pause" was the gap a habit tracker user hits first, and the README listed it as a known limit.

- Added: restoring an archived habit excuses the days it was archived. They are stored on the habit as `pauses` (`{ from, to }`, inclusive). Paused days bridge a streak like frozen days without counting; an "N times a week" week asks only for its unpaused days and a fully paused week is skipped; the weekly review and both heatmaps leave them out. A paused day can still be backfilled (the check-in counts) but not frozen. The last-7-days row labels such days "paused".
- UI: the Archive button's hint and the archived habit's text now say this ("Away or ill for a while? Archive it now and restore it when you are back"). `archived-detail.png` retaken.
- Data: `validateData` accepts `pauses` (sorted, overlapping or touching ones joined, at most 1000 per habit, `from <= to`); the reducer merges the same way, so it never saves what the validator refuses. Old data loads unchanged; `BACKUP_VERSION` stays 1. `habit/restore` now takes the restore `day`. The editor keeps `pauses` (it spreads the habit) when you save changes.
- Tests: 13 new unit tests (streak bridging for daily, weekdays and weekly; review; validation; reducer merge; backfill and freeze on paused days), restore added with a day to the fuzz test, an e2e stage on its own clock (archive, three days pass, restore, the streak is still 2 days and the pause is stored).
- Reported gaps checked: the e2e `serve.mjs` bad-`%` crash is test-only on 127.0.0.1 and left alone; the security-review skill still needs a git working directory and was not run (this change only adds a validated field). Still never run on a phone or Hermes.
- Not done on purpose: a "pause until" date that restores by itself (needs a scheduled resume); the Today 14-day streak line still draws paused days as a gap.

### Security pass (round 11)

Reviewed by hand again: the security-review skill could not run (it needs the session's working directory to be a git repository, and this agent's is not). Trust boundaries are unchanged since round 3: an imported backup file, the app's own storage, and on the web another tab's storage event, all through `validateData` / `validateTimer`.

- Fixed: `streak()` found a habit's first day with `Math.min(createdOn, ...checkIns)`. A valid backup can hold about 84,000 check-in days per habit (every day from 1970 to 2199). Spreading that many arguments overflowed a 200 KB stack (`node --stack-size=200`: `RangeError`), so the app could crash on a phone, whose JS stack is smaller than Node's, after importing such a file, and keep crashing because the data was saved. It is now a loop. Regression tests for daily and weekly streaks over the full range; they fail on the old code under the small stack. Not checked on a real phone or on Hermes itself.
- Added: `npm run test:small-stack` (the unit tests on a 200 KB stack), also run in CI.
- Checked, no change: `npm audit` 0 vulnerabilities; git history has no secrets and only the noreply identity; CI keeps `contents: read`, SHA-pinned actions and no stored checkout token; the validator still refuses prototype keys and impossible dates; no `eval`, `innerHTML`, `Linking` or network calls; habit names are the only data in notifications.
- Left alone, as in round 3: `e2e/serve.mjs` (test-only, 127.0.0.1) stops on a malformed `%` escape; Android `allowBackup` stays on.
- Still true: never run on a phone; no demo GIF; no drag and drop; Lighthouse not run.

### Design pass (round 10)

Looked at every tab of the web build in light and dark at 390 and 1280 px, with the synthetic fixture and with no data, plus the habit sheet, the editor and the keyboard focus ring (`node e2e/tour.mjs <dir> [empty]` reproduces the tab screenshots). The screens already held up from round 2: consistent type scale, eyebrow over every title, empty states with one clear action, a visible focus ring in both themes, the sheet's slide turned off under reduced motion, tabular digits on the timer. No restyling was done, so the README screenshots are unchanged (the e2e `--screenshots` run rewrote them byte for byte).

- Fixed (a reported gap): reminders beyond the 60 a phone keeps were dropped silently. `habitsOverReminderLimit` names the habits that lose some or all of their reminders; Settings lists them and the habit's editor says so, in the danger colour. Unit test added. Not seen on screen: both warnings only render where notifications are supported (the phone app), which was not run.
- Changed: the Haptics switch is hidden on the web build, where it did nothing.
- Added: `e2e/tour.mjs`, screenshots of every tab for design review.
- Still true: never run on a phone; no demo GIF; no drag and drop (up/down buttons); security-review skill and Lighthouse not run.

### First-run review (round 9)

Cloned the repository fresh and followed the README literally on Node 22: `npm install`, `npx expo start` (Expo Go manifest, iOS and Android dev bundles served), `npm run web` (app loads at 390x844, no console errors), and every command under Development. All of it worked; nothing in the quickstart needed fixing.

- Fixed (web build, a reported gap reproduced first): two tabs finishing the same focus timer logged it twice (25 min showed as 50 min in 2 sessions). The reducer now names a session after its timer's end instant and only clears the timer if that session is already logged, so `timer/finish` no longer takes a `sessionId`. Unit test, plus an e2e stage that runs two tabs on one fake clock (it fails without the fix).
- README: test count corrected (224 logic and theme tests, plus 7 for notifications), the known limit about double-logging removed, the fresh-clone check now names the Android bundle too.
- Reviewed by reading the logic, store and screens: no other bug found worth a change. Left alone: `reminderPlan` silently drops reminders beyond 60 (the iOS limit), which only matters with many weekday habits that all have reminders.
- Still true: never run on a phone; no demo GIF; no drag and drop; the security-review skill was not run (this change adds no trust boundary); Lighthouse not run.

### Performance and accessibility pass (round 8)

Measured first (web build, headless Chromium at 390x844, this laptop; `node e2e/perf.mjs` reproduces it, `axe-core` 4.10 was run by hand on every tab and the habit sheet in light and dark).

- Performance: nothing worth fixing. Bundle 546 KB (161 KB gzip) in one JS file plus two 91 KB fonts. With 40 habits, 5 years of check-ins and 3,652 focus sessions (0.9 MB of JSON) the app is interactive in about 130 ms (57 ms empty), a tab switch takes 50-120 ms, one check-in tap 60-100 ms. No change made. `depcheck` and `ts-prune` found no unused dependency or export (`notificationsSupported` is a false positive: platform-specific file).
- Accessibility: axe reported one best-practice finding on every screen (tab bar outside any landmark). The tab bar is now inside a `navigation` landmark labelled "Sections"; axe now reports 0 violations on all screens, both themes. (The e2e dark-theme check now reads the landmark's parent.)
- Fixed (web build, a real bug from the reported gaps): a tab adopting data saved by another tab also cleared its own running focus timer (the same action is used by import, which must clear it). New actions `data/adopt` (keeps the timer) and `timer/adopt`. A timer started, paused or stopped in one tab is now picked up by the others. Unit test and e2e stage added; README known-limit updated. Not covered: two tabs finishing the same timer in the same instant can log two sessions.
- Still true: never run on a phone; no demo GIF; drag and drop not added (up/down buttons stay). Security-review skill not retried: the only new input is a storage event, parsed with the existing validators.

### Reorder habits (round 7, feature)

Picked by using the app: habits were listed in the order they were created, with no way to change it, and "Reorder habits" was on the roadmap.

- Added: a Reorder button next to "Add a habit" on Today (shown with two or more active habits). It lists the active habits with move-up and move-down buttons (44 px, labelled "Move <name> up/down", disabled at the ends) and a Done button. Today, the Focus habit list and the weekly review follow the new order; the order is saved and survives a reload.
- Logic: new reducer action `habit/move` (`by: -1 | 1`) swaps a habit with its nearest active neighbour; archived habits keep their place and are skipped. The order is the order of the `habits` array, so the data and backup format are unchanged (`BACKUP_VERSION` stays 1).
- Tests: a reducer test (swap, ends, unknown id, archived habits), `habit/move` added to the random-action fuzz test, an e2e stage (move to the top, reload, move back). New README screenshot `reorder.png`; `today.png` and `today-dark.png` retaken (the new button row).
- Not done on purpose: drag and drop (long-press drag needs a gesture library; up/down buttons are accessible and enough for a short list).
- Reported gaps checked: the focus timer is still not shared between web tabs (a web-only limit, documented; a phone runs one instance). Still never run on a phone. No demo GIF. The security-review skill was not retried: this change adds no trust boundary (no new stored field, nothing imported).

### Launch pass (round 6)

- Fixed (web build): two browser tabs overwrote each other's data, last write wins. A tab now adopts data saved by another tab (`storage` event, validated first). A running focus timer is still not shared between tabs. New e2e stage.
- README: one-line pitch, an honest comparison with Loop Habit Tracker, Habitica and Streaks and when to use them instead, known limit for tabs, contributing section. Added CONTRIBUTING.md and issue templates.
- Not done: still never run on a phone; the security-review skill was not retried. Restoring archived habits counting archived days as missed remains documented behaviour, not a bug. No demo GIF: the existing screenshots come from the real app.

### Reliability pass (round 5, tests)

Tried to break the logic with odd input; most of it held.

- Fixed: a backup file saved with a UTF-8 byte-order mark (some Windows editors add one) was refused as "not valid JSON". `parseBackup` now strips it.
- Added: a seeded random-action test (60 sequences of 60 reducer actions, including archive, restore, freezes, timers and a check-in dated after today). After every action the data must pass `validateData` unchanged, streaks must be sane, and the review and heatmap must not throw. It found nothing; it guards the "never save what cannot be loaded" rule. Also a unicode round-trip test for backups.
- Checked, no change: reported gap "restoring counts archived days as missed" is the documented behaviour (README, on screen), not a bug; a pause feature would be new work. `expo-doctor` and CI are re-run below.
- Not covered: two browser tabs open on the web build overwrite each other's data (last write wins); a phone runs one instance. Still never run on a phone.

### Archive a habit (round 4, feature)

Picked by using the app as a newcomer: the only way to stop tracking a habit was to delete it with all its check-ins, or to keep it and collect "missed" days forever.

- Added: "Archive habit" in a habit's details. From that day on the habit is off Today, the focus timer's habit list, reminders, the weekly review and the all-habits heatmap; its check-ins, freezes, focus time, best streak and heatmap stay. The current streak is frozen at what it was ("Streak when archived").
- Added: archived habits are listed at the bottom of Today; opening one shows its history and a "Restore habit" button. Restoring re-reads the archived days as missed (stated on screen and in the README).
- Data: a habit may carry `archivedOn` (a day key). `validateData` accepts it, treats `null` or missing as active, and refuses a bad date; old backups load unchanged, so `BACKUP_VERSION` stays 1. The reducer refuses check-ins on or after the archive date, including a focus session's auto check-in, so it never saves what the validator would refuse.
- Tests: 17 new unit tests (status, streaks, freeze rule, review, heatmap, reminders, reducer, backup) and an e2e stage (archive, Focus list, reload, restore). New README screenshot `archived-detail.png`.
- Not done on purpose: a "pause" that excuses a stretch of days, reordering habits, quiet reminders once a habit is done. These remain on the roadmap.
- Still never run on a phone.

### Security pass (round 3)

The app has no network, accounts or backend, so its trust boundaries are an imported backup file and its own device storage. Reviewed by hand (the security-review skill could not run in this session); each fix has a regression test.

- Fixed: a stored focus timer with fractional minutes or an out-of-range end time (1970 or 2200 and later) passed `validateTimer`. Finishing it wrote a session `validateData` refuses, so on the next launch all data went to the recovery screen. `validateTimer` now applies the same rules.
- Fixed: the 20 MB import limit was only checked when the file picker reported a size. `parseBackup` now refuses longer text itself (`MAX_BACKUP_CHARS`).
- CI: actions pinned to commit SHAs, `persist-credentials: false` on checkout, `expo-doctor` pinned to 1.21.8 instead of the latest version fetched by `npx`. `permissions: contents: read` was already set.
- Dependencies: `npm audit` reported 20 moderate advisories, all in build and test tools (minimatch through `@expo/fingerprint`, glob through jest). npm `overrides` move them to minimatch 11.0.9 and glob 14.0.6, and `npm audit` now reports 0. Tests, coverage, expo-doctor, the web and native exports and e2e all pass on the new versions. Drop the overrides once expo and jest ship fixed versions.
- Checked with no change needed: git history has no secrets and only the noreply identity. The import validator refuses `__proto__` and other prototype keys (there is an existing test) and checks every field. The source has no `dangerouslySetInnerHTML`, `eval` or network calls. Notifications show habit names only, never reflection text.
- Left alone: the test-only static server `e2e/serve.mjs` (bound to 127.0.0.1) stops with an error on a malformed `%` escape in a URL. Android `allowBackup` keeps the Expo default (on), so the data can go into the user's own device backup.

### Design pass (round 2)

Looked at every screen in the web build at 390 px and 1280 px, light and dark, empty and filled, plus the keyboard focus ring in dark mode. Most of it already held up; only these changed:

- Settings has the same muted eyebrow over its title as every other screen (it now carries the version).
- Focus: with no sessions today, "No sessions yet today" is quiet muted text instead of a section heading.
- Committed the previous round's unfinished accessibility edits after e2e passed with them: a `main` landmark, headings default to level 1 (habit name in the sheet is level 2), the sheet dialog is named by its title, the year heatmap can take keyboard focus and scroll with the arrow keys.
- README screenshots retaken from the running web build.
- Left as is, on purpose: the Review legend shows "Done" in the ink colour rather than a habit colour, since the cells use each habit's own colour.

Found by cloning the repository fresh, following the README literally, and reviewing the code.

### Fixed

- Settings kept saying "Notifications are turned off for this app" after the very first Allow: the permission was read when a reminder was set, which is before the system prompt is answered, and not again. It is now re-read after every notification sync (`onNotificationsSynced`).
- The Android notification channel is created before the permission request, the order Expo documents for Android 13+.
- The half-hour-offset test (Kolkata) never ran, locally or in CI: the test compared against `Intl`'s resolved zone, and ICU reports `TZ=Asia/Kolkata` as `Asia/Calcutta`. Zone tests now compare `process.env.TZ`.
- `npm install` in a fresh clone rewrote `package-lock.json` (it was out of step with `package.json`).
- `npm run e2e` without a build crashed with a stack trace; it now says to run `npm run build:web`.

### Changed

- Reminder times accept `7:30` and `7.30` and are stored as `07:30` (`normalizeTime`).
- The web build loads `src/notifications.web.ts`, an empty stand-in, instead of `expo-notifications`: no warning in the browser console, and the bundle went from 618 KB to 550 KB.
- The end-to-end test fails on console warnings as well as errors.
- README: exact Node versions, the Expo Go push warning, why `npm test` shows five skipped tests, build before e2e.

### Added

- `src/notifications.test.ts`: seven tests of the calls made to `expo-notifications` (mocked), 197 tests in total.

### Notes for the next person

- Still never run on a phone or simulator. Everything in the 0.1.0 device list below still applies, and the permission fix above was reasoned from the code and checked only against a mock.
- `src/notifications.web.ts` must export the same names as `src/notifications.ts`; its `typeof Native.x` annotations make `tsc` catch a changed signature, but not a missing export.
- No prefix of a valid reminder time is itself valid (there is a test), which is what lets the Settings field save as you type. Keep that property if `normalizeTime` is loosened (accepting `730` would break it: `210` is a prefix of `2100`).
- Small inconsistency left alone: in the first, short week of an "N times a week" habit the streak and the review ask for fewer than N, but the Today row still says "of N this week".
- Reviewed and found fine, so do not redo: stored-data validation vs what the reducer can create, timer restore after restart, freeze rules, review counts.

## [0.1.0] - 2026-11-21

First version. Expo SDK 58, React Native 0.88, TypeScript.

### Added

- Habits with three schedule kinds: every day, certain weekdays, N times a week.
- Today screen with one-tap check-in, a 14-day streak line and the current streak per habit.
- Streaks (current and best) with freezes: today or yesterday, two per habit per calendar month.
- Habit detail: year heatmap, last-7-days backfill, freeze controls, edit and delete.
- Focus timer tied to a habit, based on an end timestamp so it survives backgrounding and restarts; optional auto check-in when a session ends; break timer.
- Evening reflection with three prompts and a list of earlier entries.
- Weekly review: kept / missed / open / frozen counts, per-habit week strips, focus minutes, reflections, previous-week comparison, all-habits year heatmap.
- Local notifications through expo-notifications: per-habit reminder, reflection reminder, timer end.
- JSON export and import with strict validation; import asks before replacing.
- Recovery screen when stored data fails validation: save a copy of the raw data before starting empty.
- Light / dark / system theme, haptics, accessibility roles and labels.
- 173 jest tests for the pure logic in `src/logic/`, run under five time zones (`npm run test:zones`).
- Playwright end-to-end script (`e2e/run.mjs`) against the exported web build; it also produces the README screenshots.
- GitHub Actions CI: typecheck, tests, expo-doctor, web build, iOS/Android bundle, end-to-end.

### Notes for the next person

- Never run on a device or simulator (none was available). Device-only code paths: `src/notifications.ts`, `src/haptics.ts`, the native branches of `src/files.ts`, safe-area and keyboard handling in `src/ui.tsx`. Test these first.
- Use `aria-checked` / `aria-selected` / `aria-disabled`, not `accessibilityState`: react-native-web 0.21 does not map `accessibilityState` to the DOM, and the e2e test relies on those attributes.
- All state changes go through `src/logic/reducer.ts`; time and ids are passed in with the action so it stays pure and testable.
- Storage is a single JSON value under `streakline/data/v1`. Stored data and imported files share one validator (`validateData` in `src/logic/backup.ts`); extend it when the data shape changes and bump `BACKUP_VERSION` for breaking changes.
- Whatever `validateData` refuses, the reducer must refuse to create (habit and session limits live in `src/logic/types.ts`); otherwise the app can save a state it cannot load.
- A second-opinion review (Codex CLI, read-only) was run on 0.1.0; its nine findings are fixed or listed under Known limits in the README.
- The e2e test pins the browser clock to 2026-11-21 12:00 UTC and builds its fixture relative to that day (`e2e/fixture.mjs`), so its numbers are deterministic.
