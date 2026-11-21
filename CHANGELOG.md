# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
