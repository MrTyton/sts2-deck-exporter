import type { CardData } from '../types';
import { formatCardName, getCardPortraitId } from './cardUtils';
import { formatEncounterName } from './encounterDict';

// ── Canvas / colour constants ───────────────────────────────────────────────────────────────────
const W   = 1920;
const PAD = 60;

// Two-column layout
const COL_GAP = 40;
const COL_W   = Math.floor((W - PAD * 2 - COL_GAP) / 2);  // 880
const COL1_X  = PAD;                   // 60  — left: breakdown + encounter tables
const COL2_X  = PAD + COL_W + COL_GAP; // 980 — right: cards + relics

const C_BG     = '#0d0f12';
const C_GOLD   = '#d6b251';
const C_TEXT   = '#ebecf0';
const C_MUTED  = '#90929c';
const C_GREEN  = '#4aad52';
const C_RED    = '#e05252';
const C_SURF   = 'rgba(255,255,255,0.06)';
const C_BORDER = 'rgba(255,255,255,0.10)';
const C_DIV    = 'rgba(255,255,255,0.07)';

// ── Image loader (cached) ─────────────────────────────────────────────────────
const imgCache = new Map<string, HTMLImageElement | null>();
function loadImg(src: string): Promise<HTMLImageElement | null> {
    if (imgCache.has(src)) return Promise.resolve(imgCache.get(src) ?? null);
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload  = () => { imgCache.set(src, img);   resolve(img);   };
        img.onerror = () => { imgCache.set(src, null);  resolve(null);  };
        img.src = src;
    });
}

// ── Exported types ────────────────────────────────────────────────────────────
export interface StatsTableRow {
    label: string;
    runs: number;
    wins: number;
    losses: number;
    abandoned: number;
    avgFloor: number | null;
}

export interface StatsTopCard {
    id: string;
    card: CardData;
    appearances: number;
    wins: number;
}

export interface StatsTopRelic {
    id: string;
    appearances: number;
    wins: number;
}

export interface EncounterStat {
    id: string;
    encounters: number;
    beaten: number;
    diedTo: number;
}

export interface StatsSnapshot {
    totalRuns: number;
    wins: number;
    losses: number;
    abandoned: number;
    longestRunTime: number | null;
    avgFloor: number | null;
    avgWinFloor: number | null;
    avgDefeatFloor: number | null;
    avgTime: number | null;
    fastestWin: number | null;
    totalTimeSeconds: number | null;
    highestAscVictory: number | null;
    charRows: StatsTableRow[];
    ascRows: StatsTableRow[];
    topWinCards: StatsTopCard[];
    topAllCards: StatsTopCard[];
    topCardsByChar: Array<{ charName: string; cards: StatsTopCard[] }>;
    topWinRelics: StatsTopRelic[];
    topAllRelics: StatsTopRelic[];
    /** Boss encounter stats. */
    bossStats?: EncounterStat[];
    /** Elite encounter stats. */
    eliteStats?: EncounterStat[];
    /** Per-character boss stats. */
    bossByCharStats?: Array<{ charName: string; rows: EncounterStat[] }>;
    /** Per-character elite stats. */
    elitesByCharStats?: Array<{ charName: string; rows: EncounterStat[] }>;
    /** True when at least one co-op run fell back to the host's character because the local player could not be identified. */
    multiplayerFallback?: boolean;
}

// ── Formatting helpers ────────────────────────────────────────────────────────
function fmtSeconds(s: number): string {
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

function fmtTotal(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function pct(n: number, d: number): string {
    return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
}

// ── Character icon helpers ────────────────────────────────────────────────────
const CHARACTER_ICONS: Record<string, string> = {
    'The Ironclad':    'char_select_ironclad.webp',
    'The Silent':      'char_select_silent.webp',
    'The Defect':      'char_select_defect.webp',
    'The Necrobinder': 'char_select_necrobinder.webp',
    'The Regent':      'char_select_regent.webp',
};
function charIconUrl(name: string): string | null {
    const file = CHARACTER_ICONS[name];
    return file ? `${import.meta.env.BASE_URL}assets/characters/${file}` : null;
}

// ── Low-level draw helpers ────────────────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
            fill?: string, stroke?: string, strokeW = 1) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill)   { ctx.fillStyle   = fill;   ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeW; ctx.stroke(); }
}

function hline(ctx: CanvasRenderingContext2D, y: number, x0: number, x1: number, color = C_DIV) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
}

// ── Metric box ────────────────────────────────────────────────────────────────
const BOX_H   = 88;
const BOX_GAP = 16;

function drawMetricBox(ctx: CanvasRenderingContext2D,
                       x: number, y: number, w: number,
                       label: string, value: string, sub?: string) {
    rr(ctx, x, y, w, BOX_H, 10, C_SURF, C_BORDER);

    ctx.fillStyle = C_MUTED;
    ctx.font = '600 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label.toUpperCase(), x + 14, y + 20);

    ctx.fillStyle = C_GOLD;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(value, x + 14, y + 57);

    if (sub) {
        ctx.fillStyle = C_MUTED;
        ctx.font = '12px sans-serif';
        ctx.fillText(sub, x + 14, y + 75);
    }
}

// ── Section heading ───────────────────────────────────────────────────────────
/** Draws a gold section heading + subtle underline; returns y after the block. */
function drawHeading(ctx: CanvasRenderingContext2D, text: string, y: number,
                     colX: number, colW: number,
                     fontSize = 20, withLine = true): number {
    ctx.fillStyle = C_GOLD;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(text, colX, y + fontSize);
    if (withLine) {
        ctx.strokeStyle = 'rgba(214,178,81,0.20)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colX, y + fontSize + 5);
        ctx.lineTo(colX + colW, y + fontSize + 5);
        ctx.stroke();
    }
    return y + fontSize + (withLine ? 5 : 0) + 14;
}

// ── Breakdown table ───────────────────────────────────────────────────────────
function makeTCOL(colW: number) {
    return {
        labelEnd:  Math.round(colW * 0.35),
        runsEnd:   Math.round(colW * 0.47),
        winsEnd:   Math.round(colW * 0.58),
        lossesEnd: Math.round(colW * 0.69),
        abandEnd:  Math.round(colW * 0.80),
        pctEnd:    Math.round(colW * 0.89),
        floorEnd:  Math.round(colW * 1.00),
    };
}
const ROW_H = 40;

async function drawTable(ctx: CanvasRenderingContext2D,
                         title: string,
                         rows: StatsTableRow[],
                         y: number,
                         colX: number,
                         colW: number): Promise<number> {
    y = drawHeading(ctx, title, y, colX, colW);
    const TC = makeTCOL(colW);

    const iconMap = new Map<string, HTMLImageElement | null>();
    if (title === 'By Character') {
        await Promise.all(rows.map(async row => {
            const url = charIconUrl(row.label);
            if (url) iconMap.set(row.label, await loadImg(url));
        }));
    }

    rr(ctx, colX, y, colW, ROW_H, 0, 'rgba(255,255,255,0.04)');
    const HEADERS = ['', 'Runs', 'Wins', 'Losses', 'Aband.', 'Win%', 'Avg Floor'];
    const RIGHTS  = [TC.labelEnd, TC.runsEnd, TC.winsEnd, TC.lossesEnd,
                     TC.abandEnd, TC.pctEnd, TC.floorEnd];

    ctx.font = '600 12px sans-serif';
    ctx.fillStyle = C_MUTED;
    HEADERS.forEach((h, i) => {
        ctx.textAlign = i === 0 ? 'left' : 'right';
        const x = i === 0 ? colX + 10 : colX + RIGHTS[i] - 2;
        ctx.fillText(h.toUpperCase(), x, y + 26);
    });
    y += ROW_H;

    rows.forEach((row, idx) => {
        if (idx % 2 === 1) rr(ctx, colX, y, colW, ROW_H, 0, 'rgba(255,255,255,0.025)');
        hline(ctx, y, colX, colX + colW);
        const cy = y + 26;

        const icon    = iconMap.get(row.label) ?? null;
        const iconSz  = 24;
        const iconGap = 6;
        if (icon) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(colX + 10, y + (ROW_H - iconSz) / 2, iconSz, iconSz, 3);
            ctx.clip();
            ctx.drawImage(icon, colX + 10, y + (ROW_H - iconSz) / 2, iconSz, iconSz);
            ctx.restore();
        }
        const textX     = icon ? colX + 10 + iconSz + iconGap : colX + 10;
        const maxLabelW = TC.labelEnd - (icon ? iconSz + iconGap + 20 : 20);

        ctx.font      = '600 15px sans-serif';
        ctx.fillStyle = C_TEXT;
        ctx.textAlign = 'left';
        ctx.fillText(clip(ctx, row.label, maxLabelW), textX, cy);

        ctx.font = '15px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = C_TEXT;   ctx.fillText(String(row.runs),      colX + TC.runsEnd   - 2, cy);
        ctx.fillStyle = C_GREEN;  ctx.fillText(String(row.wins),      colX + TC.winsEnd   - 2, cy);
        ctx.fillStyle = C_RED;    ctx.fillText(String(row.losses),    colX + TC.lossesEnd - 2, cy);
        ctx.fillStyle = C_MUTED;  ctx.fillText(String(row.abandoned), colX + TC.abandEnd  - 2, cy);

        const wp = pct(row.wins, row.runs);
        ctx.fillStyle = (row.wins / row.runs >= 0.5) ? C_GREEN : C_TEXT;
        ctx.fillText(wp, colX + TC.pctEnd - 2, cy);

        ctx.fillStyle = C_TEXT;
        ctx.fillText(row.avgFloor != null ? String(row.avgFloor) : '—',
                     colX + TC.floorEnd - 2, cy);
        y += ROW_H;
    });

    hline(ctx, y, colX, colX + colW);
    ctx.textAlign = 'left';
    return y + 34;
}

// ── Encounter table (boss / elite) ────────────────────────────────────────────
function makeECOL(colW: number) {
    return {
        nameEnd:   Math.round(colW * 0.38),
        foughtEnd: Math.round(colW * 0.55),
        beatenEnd: Math.round(colW * 0.70),
        diedEnd:   Math.round(colW * 0.84),
        pctEnd:    Math.round(colW * 1.00),
    };
}

async function drawEncounterTable(ctx: CanvasRenderingContext2D,
                                  title: string,
                                  rows: EncounterStat[],
                                  y: number,
                                  colX: number,
                                  colW: number,
                                  iconType: 'boss' | 'elite',
                                  subIconUrl?: string): Promise<number> {
    if (subIconUrl) {
        // Sub-heading: character icon + name in smaller style (matches drawCardRow sub-heading)
        const icon    = await loadImg(subIconUrl);
        const fontSize = 16;
        const iconSz   = 20;
        const iconGap  = 8;
        if (icon) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(colX, y, iconSz, iconSz, 3);
            ctx.clip();
            ctx.drawImage(icon, colX, y, iconSz, iconSz);
            ctx.restore();
        }
        ctx.fillStyle = C_GOLD;
        ctx.font      = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(title, colX + (icon ? iconSz + iconGap : 0), y + fontSize);
        y += fontSize + 14;
    } else {
        y = drawHeading(ctx, title, y, colX, colW);
    }
    const EC = makeECOL(colW);

    const iconMap = new Map<string, HTMLImageElement | null>();
    if (iconType === 'boss') {
        await Promise.all(rows.map(async row => {
            const img = await loadImg(`${import.meta.env.BASE_URL}assets/bosses/${row.id}.webp`);
            iconMap.set(row.id, img);
        }));
    }

    // Header
    rr(ctx, colX, y, colW, ROW_H, 0, 'rgba(255,255,255,0.04)');
    ctx.font = '600 12px sans-serif';
    ctx.fillStyle = C_MUTED;
    (['', 'Fought', 'Beaten', 'Died To', 'Beat%'] as const).forEach((h, i) => {
        const rights = [EC.nameEnd, EC.foughtEnd, EC.beatenEnd, EC.diedEnd, EC.pctEnd];
        ctx.textAlign = i === 0 ? 'left' : 'right';
        ctx.fillText(h.toUpperCase(), i === 0 ? colX + 10 : colX + rights[i] - 2, y + 26);
    });
    y += ROW_H;

    rows.forEach((row, idx) => {
        if (idx % 2 === 1) rr(ctx, colX, y, colW, ROW_H, 0, 'rgba(255,255,255,0.025)');
        hline(ctx, y, colX, colX + colW);
        const cy = y + 26;
        const iconSz = ROW_H - 8;

        const icon = iconMap.get(row.id) ?? null;
        if (icon) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(colX + 10, y + 4, iconSz, iconSz, 3);
            ctx.clip();
            ctx.drawImage(icon, colX + 10, y + 4, iconSz, iconSz);
            ctx.restore();
        }
        const iconGap  = icon ? iconSz + 8 : 0;
        const textX    = colX + 10 + iconGap;
        const maxNameW = EC.nameEnd - iconGap - 20;

        ctx.font      = '600 15px sans-serif';
        ctx.fillStyle = C_TEXT;
        ctx.textAlign = 'left';
        ctx.fillText(clip(ctx, formatEncounterName(row.id), maxNameW), textX, cy);

        ctx.font = '15px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = C_TEXT;  ctx.fillText(String(row.encounters), colX + EC.foughtEnd - 2, cy);
        ctx.fillStyle = C_GREEN; ctx.fillText(String(row.beaten),     colX + EC.beatenEnd - 2, cy);
        ctx.fillStyle = row.diedTo > 0 ? C_RED : C_MUTED;
        ctx.fillText(String(row.diedTo), colX + EC.diedEnd - 2, cy);
        const bp = pct(row.beaten, row.encounters);
        ctx.fillStyle = row.beaten / row.encounters >= 0.5 ? C_GREEN : C_TEXT;
        ctx.fillText(bp, colX + EC.pctEnd - 2, cy);

        y += ROW_H;
    });

    hline(ctx, y, colX, colX + colW);
    ctx.textAlign = 'left';
    return y + 34;
}

// ── Card portrait row ─────────────────────────────────────────────────────────
const CARD_SZ = 80;

async function drawCardRow(ctx: CanvasRenderingContext2D,
                            cards: StatsTopCard[],
                            countType: 'wins' | 'appearances',
                            title: string,
                            isSubTitle: boolean,
                            y: number,
                            colX: number,
                            colW: number,
                            iconUrl?: string): Promise<number> {
    const CARD_GAP = Math.max(8, cards.length > 1
        ? Math.floor((colW - cards.length * CARD_SZ) / (cards.length - 1))
        : 0);

    if (isSubTitle && iconUrl) {
        const icon     = await loadImg(iconUrl);
        const fontSize = 16;
        const iconSz   = 20;
        const iconGap  = 8;
        if (icon) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(colX, y, iconSz, iconSz, 3);
            ctx.clip();
            ctx.drawImage(icon, colX, y, iconSz, iconSz);
            ctx.restore();
        }
        ctx.fillStyle = C_GOLD;
        ctx.font      = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(title, colX + (icon ? iconSz + iconGap : 0), y + fontSize);
        y += fontSize + 14;
    } else {
        y = drawHeading(ctx, title, y, colX, colW, isSubTitle ? 16 : 20, !isSubTitle);
    }

    const imgs = await Promise.all(
        cards.map(c => loadImg(`${import.meta.env.BASE_URL}assets/portraits/${getCardPortraitId(c.card)}.webp`))
    );

    const totalW = cards.length * CARD_SZ + (cards.length - 1) * CARD_GAP;
    const startX = colX + Math.floor((colW - totalW) / 2);
    const NAME_H = 17;

    cards.forEach((tc, i) => {
        const img = imgs[i];
        const cx  = startX + i * (CARD_SZ + CARD_GAP);
        const cy  = y;

        if (img) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(cx, cy, CARD_SZ, CARD_SZ, 6);
            ctx.clip();
            ctx.drawImage(img, cx, cy, CARD_SZ, CARD_SZ);
            ctx.restore();
        } else {
            rr(ctx, cx, cy, CARD_SZ, CARD_SZ, 6, '#191c24');
        }
        rr(ctx, cx, cy, CARD_SZ, CARD_SZ, 6, undefined, C_BORDER);

        const count    = countType === 'wins' ? tc.wins : tc.appearances;
        const badgeTxt = `${count}×`;
        ctx.font = 'bold 11px sans-serif';
        const bw = ctx.measureText(badgeTxt).width + 8;
        const bh = 15;
        const bx = cx + CARD_SZ - bw - 3;
        const by = cy + 3;
        rr(ctx, bx, by, bw, bh, 7, 'rgba(0,0,0,0.85)', 'rgba(214,178,81,0.4)');
        ctx.fillStyle = C_GOLD;
        ctx.textAlign = 'center';
        ctx.fillText(badgeTxt, bx + bw / 2, by + 11);

        ctx.font      = '600 11px sans-serif';
        ctx.fillStyle = C_TEXT;
        ctx.fillText(clip(ctx, formatCardName(tc.id), CARD_SZ), cx + CARD_SZ / 2, cy + CARD_SZ + NAME_H);
        ctx.textAlign = 'left';
    });

    return y + CARD_SZ + NAME_H + 28;
}

// ── Relic row ─────────────────────────────────────────────────────────────────
const RELIC_SZ = 56;

async function drawRelicRow(ctx: CanvasRenderingContext2D,
                             relics: StatsTopRelic[],
                             countType: 'wins' | 'appearances',
                             title: string,
                             y: number,
                             colX: number,
                             colW: number): Promise<number> {
    y = drawHeading(ctx, title, y, colX, colW);

    const gap    = relics.length > 1
        ? Math.min(50, Math.floor((colW - relics.length * RELIC_SZ) / (relics.length - 1)))
        : 0;
    const totalW = relics.length * RELIC_SZ + (relics.length - 1) * gap;
    const startX = colX + Math.floor((colW - totalW) / 2);

    const imgs = await Promise.all(
        relics.map(r => loadImg(`${import.meta.env.BASE_URL}assets/relics/${r.id}.webp`))
    );

    relics.forEach((tr, i) => {
        const img = imgs[i];
        const rx  = startX + i * (RELIC_SZ + gap);
        const ry  = y;

        rr(ctx, rx, ry, RELIC_SZ, RELIC_SZ, 6, 'rgba(0,0,0,0.4)', C_BORDER);
        if (img) ctx.drawImage(img, rx + 4, ry + 4, RELIC_SZ - 8, RELIC_SZ - 8);

        const count    = countType === 'wins' ? tr.wins : tr.appearances;
        const badgeTxt = `${count}×`;
        ctx.font = 'bold 10px sans-serif';
        const bw = ctx.measureText(badgeTxt).width + 6;
        const bh = 14;
        const bx = rx + RELIC_SZ - bw + 2;
        const by = ry + RELIC_SZ - bh + 2;
        rr(ctx, bx, by, bw, bh, 4, 'rgba(0,0,0,0.9)', 'rgba(214,178,81,0.35)');
        ctx.fillStyle = C_GOLD;
        ctx.textAlign = 'center';
        ctx.fillText(badgeTxt, bx + bw / 2, by + 10);
        ctx.textAlign = 'left';
    });

    return y + RELIC_SZ + 28;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateStatsImage(stats: StatsSnapshot): Promise<HTMLCanvasElement> {
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width  = W;
    tmpCanvas.height = 16000;
    const ctx = tmpCanvas.getContext('2d')!;

    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, W, tmpCanvas.height);

    // ── Full-width header ─────────────────────────────────────────────────────
    let headerY = PAD;
    ctx.fillStyle = C_GOLD;
    ctx.font      = 'bold 54px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Run Statistics', PAD, headerY + 54);
    headerY += 68;

    ctx.fillStyle = C_MUTED;
    ctx.font      = '22px sans-serif';
    ctx.fillText(`${stats.totalRuns} run${stats.totalRuns !== 1 ? 's' : ''}`, PAD, headerY + 22);
    headerY += 22 + 36;

    // ── Metric tiles (full width, up to 6 per row) ────────────────────────────
    type Metric = { label: string; value: string; sub?: string };
    const metrics: Metric[] = [
        { label: 'Total Runs',   value: String(stats.totalRuns) },
        { label: 'Victories',    value: String(stats.wins),   sub: pct(stats.wins, stats.totalRuns) + ' win rate' },
        { label: 'Defeats',      value: String(stats.losses) },
        { label: 'Abandoned',    value: String(stats.abandoned) },
    ];
    if (stats.highestAscVictory !== null)
        metrics.push({ label: 'Best Ascension',   value: `A${stats.highestAscVictory}`, sub: 'highest cleared' });
    if (stats.longestRunTime !== null)
        metrics.push({ label: 'Longest Run',       value: fmtSeconds(stats.longestRunTime), sub: 'single run' });
    if (stats.avgFloor !== null)
        metrics.push({ label: 'Avg Floor',         value: String(stats.avgFloor), sub: 'all runs' });
    if (stats.avgDefeatFloor !== null)
        metrics.push({ label: 'Avg Floor',         value: String(stats.avgDefeatFloor), sub: 'at defeat' });
    if (stats.avgWinFloor !== null)
        metrics.push({ label: 'Avg Floor',         value: String(stats.avgWinFloor), sub: 'victories only' });
    if (stats.avgTime !== null)
        metrics.push({ label: 'Avg Run Time',      value: fmtSeconds(stats.avgTime) });
    if (stats.fastestWin !== null)
        metrics.push({ label: 'Fastest Victory',   value: fmtSeconds(stats.fastestWin) });
    if (stats.totalTimeSeconds !== null)
        metrics.push({ label: 'Total Time',        value: fmtTotal(stats.totalTimeSeconds), sub: 'across all runs' });

    const FULL_AW   = W - PAD * 2;
    const BOX_COLS  = Math.min(metrics.length, 6);
    const BOX_W     = Math.floor((FULL_AW - (BOX_COLS - 1) * BOX_GAP) / BOX_COLS);
    const metricRows = Math.ceil(metrics.length / BOX_COLS);
    metrics.forEach((m, i) => {
        const col = i % BOX_COLS;
        const row = Math.floor(i / BOX_COLS);
        drawMetricBox(ctx, PAD + col * (BOX_W + BOX_GAP), headerY + row * (BOX_H + BOX_GAP), BOX_W, m.label, m.value, m.sub);
    });
    headerY += metricRows * BOX_H + (metricRows - 1) * BOX_GAP + 44;

    // Full-width divider before columns
    ctx.strokeStyle = C_DIV;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, headerY);
    ctx.lineTo(W - PAD, headerY);
    ctx.stroke();
    headerY += 32;

    // ── Two-column body ────────────────────────────────────────────────────────
    // Left: breakdown tables + overall boss/elite
    // Right: cards + relics
    let col1Y = headerY;
    let col2Y = headerY;

    // ── LEFT: Character breakdown ─────────────────────────────────────────────
    if (stats.charRows.length > 0) {
        col1Y = await drawTable(ctx, 'By Character', stats.charRows, col1Y, COL1_X, COL_W);
    }

    // ── LEFT: Ascension breakdown ─────────────────────────────────────────────
    if (stats.ascRows.length > 1) {
        col1Y = await drawTable(ctx, 'By Ascension', stats.ascRows, col1Y, COL1_X, COL_W);
    }

    // ── LEFT: Boss Record ─────────────────────────────────────────────────────
    if (stats.bossStats && stats.bossStats.length > 0) {
        col1Y = await drawEncounterTable(ctx, 'Boss Record', stats.bossStats, col1Y, COL1_X, COL_W, 'boss');
    }

    // ── LEFT: Elite Encounters ────────────────────────────────────────────────
    if (stats.eliteStats && stats.eliteStats.length > 0) {
        col1Y = await drawEncounterTable(ctx, 'Elite Encounters', stats.eliteStats, col1Y, COL1_X, COL_W, 'elite');
    }

    // ── RIGHT: Top cards in victories ─────────────────────────────────────────
    if (stats.topWinCards.length > 0) {
        col2Y = await drawCardRow(ctx, stats.topWinCards, 'wins',
            'Most Common Cards in Victories', false, col2Y, COL2_X, COL_W);
    }

    // ── RIGHT: Top cards overall ──────────────────────────────────────────────
    if (stats.topAllCards.length > 0) {
        col2Y = await drawCardRow(ctx, stats.topAllCards, 'appearances',
            'Most Common Cards Overall', false, col2Y, COL2_X, COL_W);
    }

    // ── RIGHT: Per-character top cards ────────────────────────────────────────
    if (stats.topCardsByChar.length > 0) {
        col2Y = drawHeading(ctx, 'Most Common Cards by Character', col2Y, COL2_X, COL_W);
        col2Y += 4;
        for (const { charName, cards } of stats.topCardsByChar) {
            if (cards.length > 0) {
                col2Y = await drawCardRow(ctx, cards, 'appearances', charName, true, col2Y, COL2_X, COL_W,
                    charIconUrl(charName) ?? undefined);
            }
        }
        col2Y += 6;
    }

    // ── RIGHT: Top relics in victories ────────────────────────────────────────
    if (stats.topWinRelics.length > 0) {
        col2Y = await drawRelicRow(ctx, stats.topWinRelics, 'wins',
            'Most Common Relics in Victories', col2Y, COL2_X, COL_W);
    }

    // ── RIGHT: Top relics overall ─────────────────────────────────────────────
    if (stats.topAllRelics.length > 0) {
        col2Y = await drawRelicRow(ctx, stats.topAllRelics, 'appearances',
            'Most Common Relics Overall', col2Y, COL2_X, COL_W);
    }

    // ── Footer watermark ──────────────────────────────────────────────────────
    const bodyBottom = Math.max(col1Y, col2Y) + 20;
    ctx.fillStyle = C_MUTED;
    ctx.font      = '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('mrtyton.github.io/sts2-deck-exporter', W - PAD, bodyBottom);

    const finalH = bodyBottom + 28 + PAD;

    // ── Crop to actual height ─────────────────────────────────────────────────
    const out = document.createElement('canvas');
    out.width  = W;
    out.height = finalH;
    out.getContext('2d')!.drawImage(tmpCanvas, 0, 0);
    return out;
}

