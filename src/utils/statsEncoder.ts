import { idToNum, numToId, charToNum, numToChar } from './encoderDict';
import { BitWriter, BitReader } from './bitstream';
import { getCharacterName } from './characterMapper';
import type { StatsSnapshot, StatsTableRow, StatsTopCard, StatsTopRelic } from './statsImageExport';
import type { CardData } from '../types';

// ── Version ───────────────────────────────────────────────────────────────────
const STATS_VERSION   = 0;
const BITS_VERSION    = 3;

// ── Field widths ──────────────────────────────────────────────────────────────
const BITS_RUN_COUNT  = 16; // up to 65 535 runs
const BITS_ASC_LEVEL  = 5;  // 0–31
const BITS_FLOOR      = 6;  // 0 = null sentinel; 1–63 = actual floor value
const BITS_TIME_SHORT = 16; // up to 65 535 s (~18 h)  — avgTime, fastestWin
const BITS_TIME_LONG  = 17; // up to 131 071 s (~36 h) — longestRunTime
const BITS_CHAR_ID    = 4;  // 0–15 (6 known characters + unknown sentinel 15)
const BITS_LIST_COUNT = 4;  // 0–15 items per list
const BITS_CARD_ID    = 11; // matches deckEncoder
const BITS_RELIC_ID   = 11; // matches deckEncoder
const BITS_COUNT_16   = 16; // appearance / win counters

// ── Base64url helpers ─────────────────────────────────────────────────────────
function toBase64Url(arr: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < arr.byteLength; i++) binary += String.fromCharCode(arr[i]);
    const b64 = (typeof btoa !== 'undefined') ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromBase64Url(s: string): Uint8Array {
    let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const binary = (typeof atob !== 'undefined') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// ── Character name helpers ────────────────────────────────────────────────────
function charNameToNum(name: string): number {
    const key = name.toLowerCase().replace(/^the\s+/, '');
    const n = charToNum[key];
    return n !== undefined ? n : 15; // 15 = unknown sentinel (fits in 4 bits)
}

function numToCharName(n: number): string {
    const raw = numToChar[n];
    return raw ? (getCharacterName(raw) ?? raw) : 'Unknown';
}

// ── Nullable helpers ──────────────────────────────────────────────────────────

/** BITS_FLOOR bits: 0 = null, 1–63 = actual floor value. */
function wFloor(w: BitWriter, v: number | null): void {
    w.write(v === null ? 0 : Math.min(63, Math.max(1, Math.round(v))), BITS_FLOOR);
}
function rFloor(r: BitReader): number | null {
    const v = r.read(BITS_FLOOR);
    return v === 0 ? null : v;
}

/** 1-bit flag + 5-bit ascension level (0–31). */
function wNullableAsc(w: BitWriter, v: number | null): void {
    if (v === null) { w.writeBool(false); return; }
    w.writeBool(true);
    w.write(Math.min(31, Math.max(0, v)), BITS_ASC_LEVEL);
}
function rNullableAsc(r: BitReader): number | null {
    return r.readBool() ? r.read(BITS_ASC_LEVEL) : null;
}

/** 1-bit flag + 16-bit seconds (0–65 535). */
function wNullable16(w: BitWriter, v: number | null): void {
    if (v === null) { w.writeBool(false); return; }
    w.writeBool(true);
    w.write(Math.min(65535, Math.max(0, Math.round(v))), BITS_TIME_SHORT);
}
function rNullable16(r: BitReader): number | null {
    return r.readBool() ? r.read(BITS_TIME_SHORT) : null;
}

/** 1-bit flag + 17-bit seconds (0–131 071). */
function wNullable17(w: BitWriter, v: number | null): void {
    if (v === null) { w.writeBool(false); return; }
    w.writeBool(true);
    w.write(Math.min(131071, Math.max(0, Math.round(v))), BITS_TIME_LONG);
}
function rNullable17(r: BitReader): number | null {
    return r.readBool() ? r.read(BITS_TIME_LONG) : null;
}

/** 1-bit flag + 32-bit seconds (written as two 16-bit halves to avoid JS sign issues). */
function wNullable32(w: BitWriter, v: number | null): void {
    if (v === null) { w.writeBool(false); return; }
    w.writeBool(true);
    const n = Math.min(0xFFFFFFFF, Math.max(0, Math.round(v)));
    w.write((n >>> 16) & 0xFFFF, 16);
    w.write(n & 0xFFFF, 16);
}
function rNullable32(r: BitReader): number | null {
    if (!r.readBool()) return null;
    const hi = r.read(16);
    const lo = r.read(16);
    return hi * 65536 + lo;
}

// ── Breakdown row helpers ─────────────────────────────────────────────────────
function wCharRow(w: BitWriter, row: StatsTableRow): void {
    w.write(charNameToNum(row.label), BITS_CHAR_ID);
    w.write(Math.min(65535, row.runs),      BITS_RUN_COUNT);
    w.write(Math.min(65535, row.wins),      BITS_RUN_COUNT);
    w.write(Math.min(65535, row.losses),    BITS_RUN_COUNT);
    w.write(Math.min(65535, row.abandoned), BITS_RUN_COUNT);
    wFloor(w, row.avgFloor);
}
function rCharRow(r: BitReader): StatsTableRow {
    const label     = numToCharName(r.read(BITS_CHAR_ID));
    const runs      = r.read(BITS_RUN_COUNT);
    const wins      = r.read(BITS_RUN_COUNT);
    const losses    = r.read(BITS_RUN_COUNT);
    const abandoned = r.read(BITS_RUN_COUNT);
    const avgFloor  = rFloor(r);
    return { label, runs, wins, losses, abandoned, avgFloor };
}

function wAscRow(w: BitWriter, row: StatsTableRow): void {
    const asc = parseInt(row.label.replace(/^A/, ''), 10) || 0;
    w.write(Math.min(31, asc), BITS_ASC_LEVEL);
    w.write(Math.min(65535, row.runs),      BITS_RUN_COUNT);
    w.write(Math.min(65535, row.wins),      BITS_RUN_COUNT);
    w.write(Math.min(65535, row.losses),    BITS_RUN_COUNT);
    w.write(Math.min(65535, row.abandoned), BITS_RUN_COUNT);
    wFloor(w, row.avgFloor);
}
function rAscRow(r: BitReader): StatsTableRow {
    const asc       = r.read(BITS_ASC_LEVEL);
    const runs      = r.read(BITS_RUN_COUNT);
    const wins      = r.read(BITS_RUN_COUNT);
    const losses    = r.read(BITS_RUN_COUNT);
    const abandoned = r.read(BITS_RUN_COUNT);
    const avgFloor  = rFloor(r);
    return { label: `A${asc}`, runs, wins, losses, abandoned, avgFloor };
}

// ── Card / relic entry helpers ────────────────────────────────────────────────
function wCard(w: BitWriter, e: StatsTopCard): void {
    w.write(idToNum[e.id.toLowerCase()] ?? 0, BITS_CARD_ID);
    w.write(Math.min(65535, e.appearances), BITS_COUNT_16);
    w.write(Math.min(65535, e.wins),        BITS_COUNT_16);
}
function rCard(r: BitReader): StatsTopCard {
    const id          = numToId[r.read(BITS_CARD_ID)] || 'unknown';
    const appearances = r.read(BITS_COUNT_16);
    const wins        = r.read(BITS_COUNT_16);
    // Minimal CardData — enough for portrait rendering and tooltips
    const card: CardData = { id, count: 1, upgraded: false, upgrades: 0, enchantment: null };
    return { id, card, appearances, wins };
}

function wRelic(w: BitWriter, e: StatsTopRelic): void {
    w.write(idToNum[e.id.toLowerCase()] ?? 0, BITS_RELIC_ID);
    w.write(Math.min(65535, e.appearances), BITS_COUNT_16);
    w.write(Math.min(65535, e.wins),        BITS_COUNT_16);
}
function rRelic(r: BitReader): StatsTopRelic {
    const id          = numToId[r.read(BITS_RELIC_ID)] || 'unknown';
    const appearances = r.read(BITS_COUNT_16);
    const wins        = r.read(BITS_COUNT_16);
    return { id, appearances, wins };
}

// ── Compression helpers (native browser CompressionStream / deflate-raw) ──────

async function compressBytes(data: Uint8Array): Promise<Uint8Array> {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    writer.write(ab);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
}

async function decompressBytes(data: Uint8Array): Promise<Uint8Array> {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    writer.write(ab);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function encodeStats(snapshot: StatsSnapshot): Promise<string> {
    const w = new BitWriter();
    w.write(STATS_VERSION, BITS_VERSION);

    // Summary counters
    w.write(Math.min(65535, snapshot.totalRuns), BITS_RUN_COUNT);
    w.write(Math.min(65535, snapshot.wins),      BITS_RUN_COUNT);
    w.write(Math.min(65535, snapshot.losses),    BITS_RUN_COUNT);
    w.write(Math.min(65535, snapshot.abandoned), BITS_RUN_COUNT);

    // Nullable scalars
    wNullableAsc(w, snapshot.highestAscVictory);
    wNullable17(w,  snapshot.longestRunTime);
    wFloor(w,       snapshot.avgFloor);
    wFloor(w,       snapshot.avgWinFloor);
    wFloor(w,       snapshot.avgDefeatFloor);
    wNullable16(w,  snapshot.avgTime);
    wNullable16(w,  snapshot.fastestWin);
    wNullable32(w,  snapshot.totalTimeSeconds);

    // Breakdown rows
    const charRows = snapshot.charRows.slice(0, 15);
    w.write(charRows.length, BITS_LIST_COUNT);
    for (const row of charRows) wCharRow(w, row);

    const ascRows = snapshot.ascRows.slice(0, 15);
    w.write(ascRows.length, BITS_LIST_COUNT);
    for (const row of ascRows) wAscRow(w, row);

    // Card lists
    const topWinCards = snapshot.topWinCards.slice(0, 15);
    w.write(topWinCards.length, BITS_LIST_COUNT);
    for (const e of topWinCards) wCard(w, e);

    const topAllCards = snapshot.topAllCards.slice(0, 15);
    w.write(topAllCards.length, BITS_LIST_COUNT);
    for (const e of topAllCards) wCard(w, e);

    const topCardsByChar = snapshot.topCardsByChar.slice(0, 15);
    w.write(topCardsByChar.length, BITS_LIST_COUNT);
    for (const { charName, cards } of topCardsByChar) {
        w.write(charNameToNum(charName), BITS_CHAR_ID);
        const cc = cards.slice(0, 15);
        w.write(cc.length, BITS_LIST_COUNT);
        for (const e of cc) wCard(w, e);
    }

    // Relic lists
    const topWinRelics = snapshot.topWinRelics.slice(0, 15);
    w.write(topWinRelics.length, BITS_LIST_COUNT);
    for (const e of topWinRelics) wRelic(w, e);

    const topAllRelics = snapshot.topAllRelics.slice(0, 15);
    w.write(topAllRelics.length, BITS_LIST_COUNT);
    for (const e of topAllRelics) wRelic(w, e);

    const compressed = await compressBytes(w.getUint8Array());
    return toBase64Url(compressed);
}

export async function decodeStats(str: string): Promise<StatsSnapshot | null> {
    try {
        const decompressed = await decompressBytes(fromBase64Url(str));
        const r = new BitReader(decompressed);
        const version = r.read(BITS_VERSION);
        if (version > STATS_VERSION) {
            console.warn('Unsupported stats snapshot version:', version);
        }

        // Summary counters
        const totalRuns = r.read(BITS_RUN_COUNT);
        const wins      = r.read(BITS_RUN_COUNT);
        const losses    = r.read(BITS_RUN_COUNT);
        const abandoned = r.read(BITS_RUN_COUNT);

        // Nullable scalars
        const highestAscVictory = rNullableAsc(r);
        const longestRunTime    = rNullable17(r);
        const avgFloor          = rFloor(r);
        const avgWinFloor       = rFloor(r);
        const avgDefeatFloor    = rFloor(r);
        const avgTime           = rNullable16(r);
        const fastestWin        = rNullable16(r);
        const totalTimeSeconds  = rNullable32(r);

        // Breakdown rows
        const numCharRows = r.read(BITS_LIST_COUNT);
        const charRows: StatsTableRow[] = [];
        for (let i = 0; i < numCharRows; i++) charRows.push(rCharRow(r));

        const numAscRows = r.read(BITS_LIST_COUNT);
        const ascRows: StatsTableRow[] = [];
        for (let i = 0; i < numAscRows; i++) ascRows.push(rAscRow(r));

        // Card lists
        const numWinCards = r.read(BITS_LIST_COUNT);
        const topWinCards: StatsTopCard[] = [];
        for (let i = 0; i < numWinCards; i++) topWinCards.push(rCard(r));

        const numAllCards = r.read(BITS_LIST_COUNT);
        const topAllCards: StatsTopCard[] = [];
        for (let i = 0; i < numAllCards; i++) topAllCards.push(rCard(r));

        const numCharGroups = r.read(BITS_LIST_COUNT);
        const topCardsByChar: Array<{ charName: string; cards: StatsTopCard[] }> = [];
        for (let i = 0; i < numCharGroups; i++) {
            const charName = numToCharName(r.read(BITS_CHAR_ID));
            const numCards = r.read(BITS_LIST_COUNT);
            const cards: StatsTopCard[] = [];
            for (let j = 0; j < numCards; j++) cards.push(rCard(r));
            topCardsByChar.push({ charName, cards });
        }

        // Relic lists
        const numWinRelics = r.read(BITS_LIST_COUNT);
        const topWinRelics: StatsTopRelic[] = [];
        for (let i = 0; i < numWinRelics; i++) topWinRelics.push(rRelic(r));

        const numAllRelics = r.read(BITS_LIST_COUNT);
        const topAllRelics: StatsTopRelic[] = [];
        for (let i = 0; i < numAllRelics; i++) topAllRelics.push(rRelic(r));

        return {
            totalRuns, wins, losses, abandoned,
            highestAscVictory, longestRunTime,
            avgFloor, avgWinFloor, avgDefeatFloor,
            avgTime, fastestWin, totalTimeSeconds,
            charRows, ascRows,
            topWinCards, topAllCards, topCardsByChar,
            topWinRelics, topAllRelics,
        };
    } catch (err) {
        console.error('Failed to decode stats snapshot', err);
        return null;
    }
}
