import { daysUntil, examPace, monthGrid } from '@/lib/exam';

const today = new Date(2026, 8, 23, 18, 45); // Wed 23 Sep 2026, evening

describe('daysUntil', () => {
  it('counts calendar days regardless of the time of day', () => {
    expect(daysUntil('2026-09-23', today)).toBe(0);
    expect(daysUntil('2026-09-24', today)).toBe(1);
    expect(daysUntil('2026-10-05', today)).toBe(12);
    expect(daysUntil('2026-09-20', today)).toBe(-3);
  });

  it('is not thrown off by a clock change', () => {
    // Europe/US clocks change around late Oct / early Nov; 60 days spans one either way.
    expect(daysUntil('2026-11-22', today)).toBe(60);
  });
});

describe('examPace', () => {
  it('is on track when the daily rate learns everything with days to spare', () => {
    const p = examPace({ daysLeft: 12, newRemaining: 100, newPerDay: 20 });
    expect(p.status).toBe('on-track');
    expect(p.label).toBe('Exam in 12 days · on track');
    expect(p.detail).toContain('7 days before the exam'); // 5 days to learn, 12 left
  });

  it('is behind when the rate leaves no time to review, and suggests a rate', () => {
    const p = examPace({ daysLeft: 12, newRemaining: 300, newPerDay: 20 });
    expect(p.status).toBe('behind');
    // Ready day = 12 − 3 buffer = 9 days → 300 / 9 = 34 a day.
    expect(p.suggestedPerDay).toBe(34);
    expect(p.detail).toContain('120 cards will still be unlearned');
    // Following the suggestion makes it on track.
    expect(examPace({ daysLeft: 12, newRemaining: 300, newPerDay: 34 }).status).toBe('on-track');
  });

  it('shrinks the review buffer for close exams', () => {
    const p = examPace({ daysLeft: 2, newRemaining: 50, newPerDay: 20 });
    expect(p).toMatchObject({ status: 'behind', suggestedPerDay: 25, label: 'Exam in 2 days · behind' });
  });

  it('handles tomorrow, today, past and fully learned decks', () => {
    expect(examPace({ daysLeft: 1, newRemaining: 5, newPerDay: 20 }).label).toBe('Exam tomorrow · on track');
    expect(examPace({ daysLeft: 0, newRemaining: 5, newPerDay: 20 }).status).toBe('today');
    expect(examPace({ daysLeft: -2, newRemaining: 5, newPerDay: 20 }).status).toBe('past');
    expect(examPace({ daysLeft: 30, newRemaining: 0, newPerDay: 20 }).status).toBe('learned');
  });
});

describe('monthGrid', () => {
  it('lays a month out in Monday-first weeks', () => {
    const weeks = monthGrid(2026, 8); // September 2026 starts on a Tuesday
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1]?.getDate()).toBe(1);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});
