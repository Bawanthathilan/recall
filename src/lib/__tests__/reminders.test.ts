import { dueByDay, planReminders } from '@/lib/reminders';

describe('dueByDay', () => {
  it('adds each day’s new cards to the forecast until a deck runs out', () => {
    // 5 new today (limit 5), 12 new in total → 5 today, 5 tomorrow, 2 the day after, then none.
    const decks = [{ newCount: 5, newTotal: 12, newLimit: 5 }];
    expect(dueByDay([3, 0, 1, 0], decks, 4)).toEqual([8, 5, 3, 0]);
  });
});

describe('planReminders', () => {
  const base = {
    now: new Date(2026, 8, 23, 10, 0), // Wed 10:00
    hour: 19,
    minute: 0,
    studiedToday: false,
    due: [12, 5, 0, 4, 4, 4, 4],
    streak: 5,
    secondsPerCard: 15,
  };

  it('schedules today and the following days at the chosen time, skipping empty days', () => {
    const plan = planReminders(base);
    expect(plan.map((r) => r.date.getDate())).toEqual([23, 24, 26, 27, 28, 29]);
    expect(plan[0].date.getHours()).toBe(19);
  });

  it('uses the real count, time estimate and streak for today', () => {
    expect(planReminders(base)[0]).toMatchObject({
      title: 'Keep your 5-day streak going',
      body: '12 cards are due — about 3 min.',
    });
    expect(planReminders(base)[1].title).toBe('Time for a quick review');
  });

  it('skips today once you have studied, or once the time has passed', () => {
    expect(planReminders({ ...base, studiedToday: true })[0].date.getDate()).toBe(24);
    expect(planReminders({ ...base, now: new Date(2026, 8, 23, 20, 0) })[0].date.getDate()).toBe(24);
  });
});
