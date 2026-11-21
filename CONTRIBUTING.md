# Contributing

Thanks for looking. Streakline is small on purpose; please open an issue before a large change.

## Setup

Node 22.13+ or 24.3+.

```sh
npm install
npm run typecheck
npm test            # unit tests
npm run test:zones  # same tests in five time zones
npm run build:web && npm run e2e   # drives the web build with Playwright (npx playwright install chromium once)
```

## Ground rules

- Habit, streak, date and backup rules live in `src/logic/` as pure TypeScript with tests. A change to them needs a test, including the edge cases (time zones, DST, missed days, freezes).
- Prefer the platform and existing dependencies to new packages.
- Imported files and stored data are untrusted: validate them in `src/logic/backup.ts`.
- Keep the README and CHANGELOG honest: describe only what exists and was run.
- If you run the app on a physical phone, say which phone and OS in your issue or PR. That is the part nobody has verified yet.

CI runs typecheck, tests, `expo-doctor`, the web e2e and iOS and Android bundles.
