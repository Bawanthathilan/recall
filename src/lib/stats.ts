/**
 * Date maths for the Progress screen and streaks. Pure functions over local
 * calendar days ("YYYY-MM-DD" keys), so they're easy to test.
 *
 * Days are built with `new Date(y, m, d)` and stepped with setDate(), never by
 * adding 24 hours — a day isn't always 24 h long when clocks change (DST).
 */

/** Local calendar day as "YYYY-MM-DD" (matches SQLite's date(…, 'localtime')). */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Consecutive study days ending today — or yesterday, if you haven't studied yet today. */
export function currentStreak(days: Set<string>, today: Date) {
  let cursor = startOfDay(today);
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive study days, ever. */
export function bestStreak(days: Iterable<string>) {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    const [y, m, d] = key.split('-').map(Number);
    run = prev && dayKey(addDays(new Date(y, m - 1, d), -1)) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}

// ─── Heatmap ────────────────────────────────────────────────────────────────

export type HeatCell = { key: string; date: Date; count: number; level: 0 | 1 | 2 | 3; future: boolean };

/**
 * Shade 0–3, relative to your busiest day in view, so light studiers still
 * see contrast. 0 is reserved for "didn't study".
 */
export function heatLevel(count: number, max: number): HeatCell['level'] {
  if (count <= 0 || max <= 0) return 0;
  const r = count / max;
  return r <= 1 / 3 ? 1 : r <= 2 / 3 ? 2 : 3;
}

/**
 * `weeks` columns × 7 rows (Monday at the top), ending with the week that
 * contains `today`. Days after today are flagged `future` and drawn empty.
 */
export function heatmapGrid(counts: Map<string, number>, today: Date, weeks = 16): HeatCell[][] {
  const mondayOffset = (startOfDay(today).getDay() + 6) % 7; // Mon = 0 … Sun = 6
  const thisMonday = addDays(today, -mondayOffset);
  const first = addDays(thisMonday, -7 * (weeks - 1));
  const todayKey = dayKey(today);

  const visible: { key: string; date: Date }[][] = [];
  let max = 0;
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(first, w * 7 + d);
      const key = dayKey(date);
      col.push({ key, date });
      if (key <= todayKey) max = Math.max(max, counts.get(key) ?? 0);
    }
    visible.push(col);
  }
  return visible.map((col) =>
    col.map(({ key, date }) => {
      const future = key > todayKey;
      const count = future ? 0 : (counts.get(key) ?? 0);
      return { key, date, count, level: heatLevel(count, max), future };
    }),
  );
}

// ─── Forecast ───────────────────────────────────────────────────────────────

export type ForecastDay = { key: string; date: Date; count: number; isToday: boolean };

/** Cards due on each of the next `days` days. Overdue cards count toward today. */
export function forecast(dueTimes: number[], today: Date, days = 7): ForecastDay[] {
  const start = startOfDay(today);
  const out: ForecastDay[] = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    return { key: dayKey(date), date, count: 0, isToday: i === 0 };
  });
  const index = new Map(out.map((d, i) => [d.key, i]));
  for (const t of dueTimes) {
    const i = t < start.getTime() ? 0 : index.get(dayKey(new Date(t)));
    if (i !== undefined) out[i].count++;
  }
  return out;
}
