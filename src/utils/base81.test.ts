import { describe, it, expect } from 'vitest';
import { toBase81, fromBase81, BASE81_ALPHABET } from './base81';

describe('base81 codec', () => {
    it('alphabet has exactly 81 characters, all unique', () => {
        expect(BASE81_ALPHABET.length).toBe(81);
        expect(new Set(BASE81_ALPHABET).size).toBe(81);
    });

    it('round-trips an empty array', () => {
        expect(fromBase81(toBase81(new Uint8Array(0)))).toEqual(new Uint8Array(0));
    });

    it('round-trips a single zero byte', () => {
        const input = new Uint8Array([0]);
        expect(fromBase81(toBase81(input))).toEqual(input);
    });

    it('round-trips arbitrary bytes without leading zeros', () => {
        const input = new Uint8Array([1, 127, 200, 0, 42, 255]);
        expect(fromBase81(toBase81(input))).toEqual(input);
    });

    it('preserves leading zero bytes', () => {
        const input = new Uint8Array([0, 0, 5, 255]);
        const encoded = toBase81(input);
        expect(encoded.startsWith('A')).toBe(true); // 'A' = 0 in the alphabet
        expect(fromBase81(encoded)).toEqual(input);
    });

    it('round-trips [0, 81] (tests leading-zero + non-trivial value)', () => {
        const input = new Uint8Array([0, 81]);
        expect(fromBase81(toBase81(input))).toEqual(input);
    });

    it('produces only alphabet characters', () => {
        const input = new Uint8Array(256).map((_, i) => i);
        const encoded = toBase81(input);
        for (const c of encoded) {
            expect(BASE81_ALPHABET.includes(c)).toBe(true);
        }
    });

    it('output is strictly shorter than base64url for 100+ byte inputs', () => {
        const input = new Uint8Array(200).map(() => Math.floor(Math.random() * 256));
        const base81len = toBase81(input).length;
        const base64len = Math.ceil(input.length * 4 / 3);
        expect(base81len).toBeLessThan(base64len);
    });

    it('throws on invalid alphabet character', () => {
        expect(() => fromBase81('\x00')).toThrow();
        expect(() => fromBase81('#')).toThrow();
        expect(() => fromBase81('%')).toThrow();
    });
});
