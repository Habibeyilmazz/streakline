# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
