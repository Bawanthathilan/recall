import { bestStreak, currentStreak, dayKey, forecast, heatLevel, heatmapGrid } from '@/lib/stats';

// Wed 23 Sep 2026, mid-morning local time.
const today = new Date(2026, 8, 23, 10, 30);

describe('streaks', () => {
  const days = new Set(['2026-09-20', '2026-09-21', '2026-09-22']);

  it('counts back from yesterday when today has no reviews yet', () => {
    expect(currentStreak(days, today)).toBe(3);
  });

  it('includes today once you have studied', () => {
    expect(currentStreak(new Set([...days, '2026-09-23']), today)).toBe(4);
  });

  it('finds the longest run, across month boundaries and in any order', () => {
    expect(bestStreak(['2026-09-01', '2026-08-30', '2026-08-31', '2026-09-10', '2026-09-11'])).toBe(3);
    expect(bestStreak([])).toBe(0);
  });
});

describe('heatLevel', () => {
  it('reserves 0 for no study and scales the rest to the busiest day', () => {
    expect(heatLevel(0, 30)).toBe(0);
    expect(heatLevel(5, 30)).toBe(1);
    expect(heatLevel(15, 30)).toBe(2);
    expect(heatLevel(30, 30)).toBe(3);
  });
});

describe('heatmapGrid', () => {
  const grid = heatmapGrid(new Map([['2026-09-23', 12], ['2026-09-21', 5]]), today);

  it('is 16 weeks of Monday-first columns ending this week', () => {
    expect(grid).toHaveLength(16);
    expect(grid.every((col) => col.length === 7)).toBe(true);
    const lastWeek = grid[15];
    expect(lastWeek[0].key).toBe('2026-09-21'); // Monday
    expect(lastWeek[2]).toMatchObject({ key: '2026-09-23', count: 12, level: 3, future: false });
    expect(lastWeek[0]).toMatchObject({ count: 5, level: 2 });
  });

  it('marks days after today as future', () => {
    expect(grid[15].slice(3).every((c) => c.future && c.count === 0)).toBe(true);
    expect(grid[0][0].key).toBe('2026-06-08');
  });
});

describe('forecast', () => {
  const at = (d: number, h = 9) => new Date(2026, 8, d, h).getTime();

  it('buckets due cards by local day and counts overdue cards as today', () => {
    const days = forecast([at(20), at(23, 23), at(24, 1), at(24, 20), at(29), at(30)], today);
    expect(days.map((d) => d.count)).toEqual([2, 2, 0, 0, 0, 0, 1]);
    expect(days[0].isToday).toBe(true);
    expect(dayKey(days[6].date)).toBe('2026-09-29');
  });
});
