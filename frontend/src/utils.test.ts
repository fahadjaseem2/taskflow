import { describe, it, expect } from 'vitest';
import { initials, ticketPrefix, isOverdue } from './utils';

describe('initials', () => {
  it('returns the first letter of up to two words', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Cher')).toBe('C');
    expect(initials('Mary Jane Watson')).toBe('MJ');
  });
});

describe('ticketPrefix', () => {
  it('builds an uppercase prefix from a project name', () => {
    expect(ticketPrefix('Website Redesign')).toBe('WR');
    expect(ticketPrefix('Mobile App Launch Plan')).toBe('MAL');
  });

  it('falls back to TF for an empty name', () => {
    expect(ticketPrefix('')).toBe('TF');
  });
});

describe('isOverdue', () => {
  it('returns false for a null due date', () => {
    expect(isOverdue(null, 'todo')).toBe(false);
  });

  it('returns false for a done task even if the date has passed', () => {
    expect(isOverdue('2020-01-01', 'done')).toBe(false);
  });

  it('returns true for a past due date on an incomplete task', () => {
    expect(isOverdue('2020-01-01', 'todo')).toBe(true);
  });

  it('returns false for a future due date', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(isOverdue(future.toISOString(), 'todo')).toBe(false);
  });
});
