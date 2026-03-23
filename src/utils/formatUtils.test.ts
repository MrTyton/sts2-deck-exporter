import { describe, it, expect } from 'vitest';
import { pct, formatSeconds, formatTotalTime } from './formatUtils';

describe('pct', () => {
    it('returns em-dash when denominator is zero', () => {
        expect(pct(0, 0)).toBe('—');
        expect(pct(5, 0)).toBe('—');
    });

    it('returns 0% when numerator is zero', () => {
        expect(pct(0, 10)).toBe('0%');
    });

    it('returns 100% when numerator equals denominator', () => {
        expect(pct(10, 10)).toBe('100%');
    });

    it('rounds to nearest integer percentage', () => {
        expect(pct(1, 3)).toBe('33%');
        expect(pct(2, 3)).toBe('67%');
        expect(pct(1, 6)).toBe('17%');
    });

    it('handles partial win rates correctly', () => {
        expect(pct(3, 10)).toBe('30%');
        expect(pct(7, 10)).toBe('70%');
    });
});

describe('formatSeconds', () => {
    it('formats sub-minute durations as seconds only', () => {
        expect(formatSeconds(0)).toBe('0s');
        expect(formatSeconds(45)).toBe('45s');
        expect(formatSeconds(59)).toBe('59s');
    });

    it('formats minute-range durations as "Xm Xs"', () => {
        expect(formatSeconds(60)).toBe('1m 0s');
        expect(formatSeconds(90)).toBe('1m 30s');
        expect(formatSeconds(3599)).toBe('59m 59s');
    });

    it('formats hour-range durations as "Xh Xm Xs"', () => {
        expect(formatSeconds(3600)).toBe('1h 0m 0s');
        expect(formatSeconds(3661)).toBe('1h 1m 1s');
        expect(formatSeconds(7384)).toBe('2h 3m 4s');
    });

    it('handles exactly one hour', () => {
        expect(formatSeconds(3600)).toBe('1h 0m 0s');
    });
});

describe('formatTotalTime', () => {
    it('formats durations under one hour as "Xm"', () => {
        expect(formatTotalTime(0)).toBe('0m');
        expect(formatTotalTime(60)).toBe('1m');
        expect(formatTotalTime(3540)).toBe('59m');
    });

    it('formats durations of one hour or more as "Xh Xm"', () => {
        expect(formatTotalTime(3600)).toBe('1h 0m');
        expect(formatTotalTime(3660)).toBe('1h 1m');
        expect(formatTotalTime(7380)).toBe('2h 3m');
    });

    it('drops seconds (unlike formatSeconds)', () => {
        expect(formatTotalTime(90)).toBe('1m');   // 1m 30s → just "1m"
        expect(formatTotalTime(3661)).toBe('1h 1m'); // 1h 1m 1s → just "1h 1m"
    });
});
