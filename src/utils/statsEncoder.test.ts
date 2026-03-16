import { describe, it, expect } from 'vitest';
import { encodeStats, decodeStats } from './statsEncoder';
import { compressBytes } from './compression';
import { BitWriter } from './bitstream';
import { idToNum } from './encoderDict';
import type { StatsSnapshot } from './statsImageExport';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<StatsSnapshot> = {}): StatsSnapshot {
    return {
        totalRuns: 10,
        wins: 6,
        losses: 3,
        abandoned: 1,
        longestRunTime: 5400,
        avgFloor: 42,
        avgWinFloor: 51,
        avgDefeatFloor: 30,
        avgTime: 3000,
        fastestWin: 2100,
        totalTimeSeconds: 30000,
        highestAscVictory: 20,
        charRows: [],
        ascRows: [],
        topWinCards: [],
        topAllCards: [],
        topCardsByChar: [],
        topWinRelics: [],
        topAllRelics: [],
        ...overrides,
    };
}

// ─── Round-trip tests ─────────────────────────────────────────────────────────

describe('statsEncoder – encode / decode round-trip', () => {
    it('encodes and returns a non-empty string', async () => {
        const encoded = await encodeStats(makeSnapshot());
        expect(typeof encoded).toBe('string');
        expect(encoded.length).toBeGreaterThan(0);
    });

    it('decodes back to matching summary counters', async () => {
        const snap = makeSnapshot({ totalRuns: 50, wins: 30, losses: 15, abandoned: 5 });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded).not.toBeNull();
        expect(decoded!.totalRuns).toBe(50);
        expect(decoded!.wins).toBe(30);
        expect(decoded!.losses).toBe(15);
        expect(decoded!.abandoned).toBe(5);
    });

    it('preserves highestAscVictory', async () => {
        const snap = makeSnapshot({ highestAscVictory: 20 });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded!.highestAscVictory).toBe(20);
    });

    it('preserves avgFloor, avgWinFloor, avgDefeatFloor', async () => {
        const snap = makeSnapshot({ avgFloor: 45, avgWinFloor: 51, avgDefeatFloor: 33 });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded!.avgFloor).toBe(45);
        expect(decoded!.avgWinFloor).toBe(51);
        expect(decoded!.avgDefeatFloor).toBe(33);
    });

    it('preserves time fields', async () => {
        const snap = makeSnapshot({ avgTime: 3600, fastestWin: 2400, longestRunTime: 7200, totalTimeSeconds: 108000 });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded!.avgTime).toBe(3600);
        expect(decoded!.fastestWin).toBe(2400);
        expect(decoded!.longestRunTime).toBe(7200);
        expect(decoded!.totalTimeSeconds).toBe(108000);
    });

    it('preserves character breakdown rows', async () => {
        const snap = makeSnapshot({
            charRows: [
                { label: 'The Ironclad', runs: 8, wins: 5, losses: 2, abandoned: 1, avgFloor: 48 },
            ],
        });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded!.charRows).toHaveLength(1);
        const row = decoded!.charRows[0];
        expect(row.label).toBe('The Ironclad');
        expect(row.runs).toBe(8);
        expect(row.wins).toBe(5);
        expect(row.losses).toBe(2);
        expect(row.abandoned).toBe(1);
        expect(row.avgFloor).toBe(48);
    });

    it('preserves ascension breakdown rows', async () => {
        const snap = makeSnapshot({
            ascRows: [
                { label: 'A20', runs: 4, wins: 2, losses: 1, abandoned: 1, avgFloor: 40 },
            ],
        });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded!.ascRows).toHaveLength(1);
        const row = decoded!.ascRows[0];
        expect(row.label).toBe('A20');
        expect(row.runs).toBe(4);
    });

    it('preserves top-win card entries', async () => {
        const snap = makeSnapshot({
            topWinCards: [{
                id: 'bash',
                card: { id: 'bash', count: 1, upgraded: false, upgrades: 0, enchantment: null },
                appearances: 6,
                wins: 5,
            }],
        });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded!.topWinCards).toHaveLength(1);
        const entry = decoded!.topWinCards[0];
        expect(entry.id).toBe('bash');
        expect(entry.appearances).toBe(6);
        expect(entry.wins).toBe(5);
    });

    it('preserves top-win relic entries', async () => {
        const snap = makeSnapshot({
            topWinRelics: [{ id: 'war_hammer', appearances: 4, wins: 3 }],
        });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded!.topWinRelics).toHaveLength(1);
        expect(decoded!.topWinRelics[0].id).toBe('war_hammer');
        expect(decoded!.topWinRelics[0].appearances).toBe(4);
        expect(decoded!.topWinRelics[0].wins).toBe(3);
    });

    it('preserves topCardsByChar entries', async () => {
        const snap = makeSnapshot({
            topCardsByChar: [{
                charName: 'The Ironclad',
                cards: [{
                    id: 'bash',
                    card: { id: 'bash', count: 1, upgraded: false, upgrades: 0, enchantment: null },
                    appearances: 5,
                    wins: 4,
                }],
            }],
        });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded!.topCardsByChar).toHaveLength(1);
        expect(decoded!.topCardsByChar[0].charName).toBe('The Ironclad');
        expect(decoded!.topCardsByChar[0].cards).toHaveLength(1);
        expect(decoded!.topCardsByChar[0].cards[0].id).toBe('bash');
    });
});

// ─── Null / edge-case handling ────────────────────────────────────────────────

describe('statsEncoder – null optional fields', () => {
    it('round-trips all nullable fields as null', async () => {
        const snap = makeSnapshot({
            longestRunTime: null,
            avgFloor: null,
            avgWinFloor: null,
            avgDefeatFloor: null,
            avgTime: null,
            fastestWin: null,
            totalTimeSeconds: null,
            highestAscVictory: null,
        });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded).not.toBeNull();
        expect(decoded!.longestRunTime).toBeNull();
        expect(decoded!.avgFloor).toBeNull();
        expect(decoded!.avgWinFloor).toBeNull();
        expect(decoded!.avgDefeatFloor).toBeNull();
        expect(decoded!.avgTime).toBeNull();
        expect(decoded!.fastestWin).toBeNull();
        expect(decoded!.totalTimeSeconds).toBeNull();
        expect(decoded!.highestAscVictory).toBeNull();
    });

    it('round-trips empty list fields', async () => {
        const snap = makeSnapshot({
            charRows: [],
            ascRows: [],
            topWinCards: [],
            topAllCards: [],
            topCardsByChar: [],
            topWinRelics: [],
            topAllRelics: [],
        });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded!.charRows).toHaveLength(0);
        expect(decoded!.ascRows).toHaveLength(0);
        expect(decoded!.topWinCards).toHaveLength(0);
    });

    it('clamps list lengths to 10 entries maximum (V1)', async () => {
        const cards = Array.from({ length: 20 }, (_, i) => ({
            id: 'bash', card: { id: 'bash', count: 1, upgraded: false, upgrades: 0, enchantment: null },
            appearances: i + 1, wins: i,
        }));
        const snap = makeSnapshot({ topAllCards: cards });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded!.topAllCards.length).toBeLessThanOrEqual(10);
    });

    it('V1: counts at the 12-bit ceiling (4095) survive round-trip', async () => {
        const snap = makeSnapshot({
            topWinCards: [{
                id: 'bash',
                card: { id: 'bash', count: 1, upgraded: false, upgrades: 0, enchantment: null },
                appearances: 9999, // clamped to 4095
                wins: 4095,
            }],
        });
        const decoded = await decodeStats(await encodeStats(snap));
        expect(decoded).not.toBeNull();
        expect(decoded!.topWinCards[0].appearances).toBe(4095);
        expect(decoded!.topWinCards[0].wins).toBe(4095);
    });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('statsEncoder – decodeStats error handling', () => {
    it('returns null for completely invalid input', async () => {
        const result = await decodeStats('!!!invalid!!!');
        expect(result).toBeNull();
    });

    it('returns null for empty string', async () => {
        const result = await decodeStats('');
        expect(result).toBeNull();
    });

    it('returns null for garbage base64url', async () => {
        const result = await decodeStats('AAAAAAAAAA');
        expect(result).toBeNull();
    });
});

// ─── V0 backward compat ───────────────────────────────────────────────────────

describe('statsEncoder – V0 backward compatibility', () => {
    it('decodes a manually-constructed V0 payload (16-bit counts) correctly', async () => {
        // Build a V0-style bitstream directly (STATS_VERSION=0, 16-bit appearance/win counts)
        const w = new BitWriter();
        w.write(0, 3);   // STATS_VERSION = 0
        w.write(5, 16);  // totalRuns
        w.write(3, 16);  // wins
        w.write(2, 16);  // losses
        w.write(0, 16);  // abandoned
        w.writeBool(false); // highestAscVictory = null
        w.writeBool(false); // longestRunTime = null
        w.write(0, 6);   // avgFloor = null (0 sentinel)
        w.write(0, 6);   // avgWinFloor = null
        w.write(0, 6);   // avgDefeatFloor = null
        w.writeBool(false); // avgTime = null
        w.writeBool(false); // fastestWin = null
        w.writeBool(false); // totalTimeSeconds = null
        w.write(0, 4);   // charRows: 0 entries
        w.write(0, 4);   // ascRows: 0 entries
        // topWinCards: 1 entry with 16-bit counts (V0 style)
        w.write(1, 4);
        w.write(idToNum['bash'] ?? 0, 11); // card id
        w.write(5000, 16); // appearances — would overflow 12 bits, proves V0 path
        w.write(3000, 16); // wins
        w.write(0, 4);   // topAllCards: 0
        w.write(0, 4);   // topCardsByChar: 0
        w.write(0, 4);   // topWinRelics: 0
        w.write(0, 4);   // topAllRelics: 0

        const compressed = await compressBytes(w.getUint8Array());
        // Build base64url from compressed bytes
        let binary = '';
        for (let i = 0; i < compressed.byteLength; i++) binary += String.fromCharCode(compressed[i]);
        const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        const decoded = await decodeStats(b64);
        expect(decoded).not.toBeNull();
        expect(decoded!.totalRuns).toBe(5);
        expect(decoded!.wins).toBe(3);
        expect(decoded!.topWinCards).toHaveLength(1);
        expect(decoded!.topWinCards[0].id).toBe('bash');
        // V0 decoder reads 16-bit counts, so the full value is preserved
        expect(decoded!.topWinCards[0].appearances).toBe(5000);
        expect(decoded!.topWinCards[0].wins).toBe(3000);
    });
});
