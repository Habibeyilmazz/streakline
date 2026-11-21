# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
- 174 jest tests for the pure logic in `src/logic/`, run under five time zones (`npm run test:zones`).
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
