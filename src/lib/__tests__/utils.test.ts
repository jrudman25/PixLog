import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatRelativeTime,
  getDateGroup,
  getInitials,
} from '../utils';

describe('utils.ts', () => {
  beforeEach(() => {
    // Mock system time to be deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T19:20:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDate', () => {
    it('formats a full ISO date correctly to en-US standard', () => {
      const dateStr = '2026-04-13T19:20:00Z';
      const formatted = formatDate(dateStr);
      expect(formatted).toBe('April 13, 2026');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "just now" for dates within 60 seconds', () => {
      const dateStr = new Date('2026-04-13T19:19:30Z').toISOString();
      expect(formatRelativeTime(dateStr)).toBe('just now');
    });

    it('returns minutes for dates within the hour', () => {
      const dateStr = new Date('2026-04-13T19:10:00Z').toISOString();
      expect(formatRelativeTime(dateStr)).toBe('10m ago');
    });

    it('returns hours for dates within the day', () => {
      const dateStr = new Date('2026-04-13T15:20:00Z').toISOString();
      expect(formatRelativeTime(dateStr)).toBe('4h ago');
    });

    it('returns days for dates within the week', () => {
      const dateStr = new Date('2026-04-09T19:20:00Z').toISOString();
      expect(formatRelativeTime(dateStr)).toBe('4d ago');
    });
  });

  describe('getDateGroup', () => {
    it('returns "Today" for current day', () => {
      const dateStr = new Date('2026-04-13T10:00:00Z').toISOString();
      expect(getDateGroup(dateStr)).toBe('Today');
    });

    it('returns "Yesterday" for the previous day', () => {
      const dateStr = new Date('2026-04-12T10:00:00Z').toISOString();
      expect(getDateGroup(dateStr)).toBe('Yesterday');
    });
  });

  describe('getInitials', () => {
    it('extracts two uppercase initials from a full name', () => {
      expect(getInitials('Jordan Rudman')).toBe('JR');
    });

    it('handles single names correctly', () => {
      expect(getInitials('Admin')).toBe('A');
    });
  });
});
