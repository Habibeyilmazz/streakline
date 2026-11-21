// Builds a synthetic backup file relative to a given day, for end-to-end
// tests and README screenshots. Nothing here is real data.
const DAY = 86_400_000;
const key = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const num = (k) => Date.parse(`${k}T00:00:00Z`) / DAY;

export function fixture(today) {
  const t = num(today);
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const weekdayOf = (n) => (((n + 4) % 7) + 7) % 7; // 0 = Sunday

  const range = (from, to, keep) => {
    const out = [];
    for (let n = from; n <= to; n++) if (keep(n)) out.push(key(n));
    return out;
  };

  const habits = [
    { id: 'read', name: 'Read 20 pages', color: 0, schedule: { kind: 'daily' }, createdOn: key(t - 320), reminder: '21:30' },
    { id: 'run', name: 'Morning run', color: 1, schedule: { kind: 'weekly', times: 3 }, createdOn: key(t - 200), reminder: null },
    { id: 'gym', name: 'Strength training', color: 3, schedule: { kind: 'weekdays', days: [1, 3, 5] }, createdOn: key(t - 150), reminder: '18:00' },
    { id: 'guitar', name: 'Practice guitar', color: 2, schedule: { kind: 'daily' }, createdOn: key(t - 90), reminder: null },
    { id: 'phone', name: 'No phone after 22:00', color: 4, schedule: { kind: 'daily' }, createdOn: key(t - 45), reminder: null },
  ];

  const checkins = {
    // Patchy early on, then a long run with one frozen day inside it; today still open.
    read: [...range(t - 320, t - 41, () => rand() < 0.72), ...range(t - 39, t - 1, (n) => n !== t - 12)],
    run: range(t - 200, t - 1, (n) => [2, 4, 6].includes(weekdayOf(n)) && rand() < 0.85),
    gym: range(t - 150, t - 1, (n) => [1, 3, 5].includes(weekdayOf(n)) && (n > t - 30 || rand() < 0.8)),
    // Missed two days ago, back on it since.
    guitar: [...range(t - 90, t - 3, () => rand() < 0.6), key(t - 1), key(t)],
    phone: range(t - 45, t, (n) => n > t - 9 || rand() < 0.5),
  };
  const freezes = { read: [key(t - 12)], run: [], gym: [], guitar: [], phone: [] };

  const sessions = [];
  for (let n = t - 60; n <= t - 1; n++) {
    if (rand() < 0.55) sessions.push({ id: `s${n}a`, habitId: 'read', day: key(n), minutes: 25 });
    if (rand() < 0.35) sessions.push({ id: `s${n}b`, habitId: 'guitar', day: key(n), minutes: rand() < 0.5 ? 25 : 45 });
    if (rand() < 0.15) sessions.push({ id: `s${n}c`, habitId: null, day: key(n), minutes: 60 });
  }

  const notes = [
    ['Finished the chapter before breakfast.', 'Checked messages first thing and lost half an hour.', 'Phone stays in the hallway overnight.'],
    ['Ran the long loop without stopping.', 'Stayed up too late, so the morning was slow.', 'Lights out by eleven.'],
    ['Got the chord change clean at full tempo.', 'Skipped the warm-up and it showed.', 'Ten minutes of scales before anything else.'],
    ['Three focus sessions back to back.', 'Too many tabs open.', 'Write the first paragraph before opening the inbox.'],
  ];
  const reflections = {};
  [1, 2, 4, 5, 8, 9, 11].forEach((back, i) => (reflections[key(t - back)] = { answers: notes[i % notes.length] }));

  return {
    app: 'streakline',
    version: 1,
    exportedAt: `${today}T08:00:00.000Z`,
    data: {
      habits,
      checkins,
      freezes,
      sessions,
      reflections,
      settings: { theme: 'light', haptics: true, focusMinutes: 25, breakMinutes: 5, autoCheckIn: true, reflectionReminder: '21:00' },
    },
  };
}
