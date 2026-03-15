import type { CardData } from '../types';
import { formatCardName, getCardPortraitId } from './cardUtils';

// ── Canvas / colour constants ─────────────────────────────────────────────────
const W = 1080;
const PAD = 60;
const AW = W - PAD * 2; // 960

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

function hline(ctx: CanvasRenderingContext2D, y: number, color = C_DIV) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
}

// ── Metric box ────────────────────────────────────────────────────────────────
const BOX_COLS = 4;
const BOX_GAP  = 16;
const BOX_W    = (AW - (BOX_COLS - 1) * BOX_GAP) / BOX_COLS; // ≈ 228
const BOX_H    = 88;

function drawMetricBox(ctx: CanvasRenderingContext2D,
                       x: number, y: number,
                       label: string, value: string, sub?: string) {
    rr(ctx, x, y, BOX_W, BOX_H, 10, C_SURF, C_BORDER);

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
                     fontSize = 20, withLine = true): number {
    ctx.fillStyle = C_GOLD;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(text, PAD, y + fontSize);
    if (withLine) {
        ctx.strokeStyle = 'rgba(214,178,81,0.20)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD, y + fontSize + 5);
        ctx.lineTo(W - PAD, y + fontSize + 5);
        ctx.stroke();
    }
    return y + fontSize + (withLine ? 5 : 0) + 14; // return y below heading
}

// ── Breakdown table ───────────────────────────────────────────────────────────
// Column right-edge positions (relative to PAD=0):
const TCOL = {
    labelEnd:   300,
    runsEnd:    390,
    winsEnd:    470,
    lossesEnd:  550,
    abandEnd:   640,
    pctEnd:     720,
    floorEnd:   820,
};
const ROW_H = 40;

async function drawTable(ctx: CanvasRenderingContext2D,
                   title: string,
                   rows: StatsTableRow[],
                   y: number): Promise<number> {
    y = drawHeading(ctx, title, y);

    // Pre-load character icons for By Character table
    const iconMap = new Map<string, HTMLImageElement | null>();
    if (title === 'By Character') {
        await Promise.all(rows.map(async row => {
            const url = charIconUrl(row.label);
            if (url) iconMap.set(row.label, await loadImg(url));
        }));
    }

    // Header bg
    rr(ctx, PAD, y, AW, ROW_H, 0, 'rgba(255,255,255,0.04)');

    const HEADERS = ['', 'Runs', 'Wins', 'Losses', 'Aband.', 'Win%', 'Avg Floor'];
    const RIGHTS  = [TCOL.labelEnd, TCOL.runsEnd, TCOL.winsEnd, TCOL.lossesEnd,
                     TCOL.abandEnd, TCOL.pctEnd, TCOL.floorEnd];

    ctx.font = '600 12px sans-serif';
    ctx.fillStyle = C_MUTED;
    HEADERS.forEach((h, i) => {
        ctx.textAlign = i === 0 ? 'left' : 'right';
        const x = i === 0 ? PAD + 10 : PAD + RIGHTS[i] - 2;
        ctx.fillText(h.toUpperCase(), x, y + 26);
    });
    y += ROW_H;

    rows.forEach((row, idx) => {
        if (idx % 2 === 1) rr(ctx, PAD, y, AW, ROW_H, 0, 'rgba(255,255,255,0.025)');
        hline(ctx, y);

        const cy = y + 26;

        // Draw character icon if available
        const icon    = iconMap.get(row.label) ?? null;
        const iconSz  = 24;
        const iconGap = 6;
        if (icon) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(PAD + 10, y + (ROW_H - iconSz) / 2, iconSz, iconSz, 3);
            ctx.clip();
            ctx.drawImage(icon, PAD + 10, y + (ROW_H - iconSz) / 2, iconSz, iconSz);
            ctx.restore();
        }
        const textX     = icon ? PAD + 10 + iconSz + iconGap : PAD + 10;
        const maxLabelW = TCOL.labelEnd - (icon ? iconSz + iconGap + 20 : 20);

        ctx.font      = '600 15px sans-serif';
        ctx.fillStyle = C_TEXT;
        ctx.textAlign = 'left';
        ctx.fillText(clip(ctx, row.label, maxLabelW), textX, cy);

        ctx.font = '15px sans-serif';

        ctx.textAlign = 'right';
        ctx.fillStyle = C_TEXT;   ctx.fillText(String(row.runs),      PAD + TCOL.runsEnd  - 2, cy);
        ctx.fillStyle = C_GREEN;  ctx.fillText(String(row.wins),      PAD + TCOL.winsEnd  - 2, cy);
        ctx.fillStyle = C_RED;    ctx.fillText(String(row.losses),    PAD + TCOL.lossesEnd - 2, cy);
        ctx.fillStyle = C_MUTED;  ctx.fillText(String(row.abandoned), PAD + TCOL.abandEnd  - 2, cy);

        const wp = pct(row.wins, row.runs);
        ctx.fillStyle = (row.wins / row.runs >= 0.5) ? C_GREEN : C_TEXT;
        ctx.fillText(wp, PAD + TCOL.pctEnd - 2, cy);

        ctx.fillStyle = C_TEXT;
        ctx.fillText(row.avgFloor != null ? String(row.avgFloor) : '—',
                     PAD + TCOL.floorEnd - 2, cy);

        y += ROW_H;
    });

    // Bottom border
    hline(ctx, y);
    y += 2;

    ctx.textAlign = 'left';
    return y + 32;
}

// ── Card portrait row ─────────────────────────────────────────────────────────
const CARD_SZ  = 80;
const CARD_GAP = Math.floor((AW - 10 * CARD_SZ) / 9); // ≈ 17

async function drawCardRow(ctx: CanvasRenderingContext2D,
                            cards: StatsTopCard[],
                            countType: 'wins' | 'appearances',
                            title: string,
                            isSubTitle: boolean,
                            y: number,
                            iconUrl?: string): Promise<number> {
    if (isSubTitle && iconUrl) {
        const icon     = await loadImg(iconUrl);
        const fontSize = 16;
        const iconSz   = 20;
        const iconGap  = 8;
        if (icon) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(PAD, y, iconSz, iconSz, 3);
            ctx.clip();
            ctx.drawImage(icon, PAD, y, iconSz, iconSz);
            ctx.restore();
        }
        ctx.fillStyle = C_GOLD;
        ctx.font      = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(title, PAD + (icon ? iconSz + iconGap : 0), y + fontSize);
        y += fontSize + 14;
    } else {
        y = drawHeading(ctx, title, y, isSubTitle ? 16 : 20, !isSubTitle);
    }

    const imgs = await Promise.all(
        cards.map(c => loadImg(`${import.meta.env.BASE_URL}assets/portraits/${getCardPortraitId(c.card)}.webp`))
    );

    const totalW  = cards.length * CARD_SZ + (cards.length - 1) * CARD_GAP;
    const startX  = PAD + Math.floor((AW - totalW) / 2);
    const NAME_H  = 17;

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

        // Count badge (top-right corner)
        const count   = countType === 'wins' ? tc.wins : tc.appearances;
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

        // Name
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
                             y: number): Promise<number> {
    y = drawHeading(ctx, title, y);

    const gap     = relics.length > 1
        ? Math.min(50, Math.floor((AW - relics.length * RELIC_SZ) / (relics.length - 1)))
        : 0;
    const totalW  = relics.length * RELIC_SZ + (relics.length - 1) * gap;
    const startX  = PAD + Math.floor((AW - totalW) / 2);

    const imgs = await Promise.all(
        relics.map(r => loadImg(`${import.meta.env.BASE_URL}assets/relics/${r.id}.webp`))
    );

    relics.forEach((tr, i) => {
        const img = imgs[i];
        const rx  = startX + i * (RELIC_SZ + gap);
        const ry  = y;

        rr(ctx, rx, ry, RELIC_SZ, RELIC_SZ, 6, 'rgba(0,0,0,0.4)', C_BORDER);

        if (img) {
            ctx.drawImage(img, rx + 4, ry + 4, RELIC_SZ - 8, RELIC_SZ - 8);
        }

        // Count badge (bottom-right overlap)
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
    // Draw onto an oversized temp canvas, then crop to actual content height.
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width  = W;
    tmpCanvas.height = 12000;
    const ctx = tmpCanvas.getContext('2d')!;

    // Background
    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, W, tmpCanvas.height);

    let y = PAD;

    // ── Title ────────────────────────────────────────────────────────────────
    ctx.fillStyle = C_GOLD;
    ctx.font      = 'bold 54px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Run Statistics', PAD, y + 54);
    y += 68;

    ctx.fillStyle = C_MUTED;
    ctx.font      = '22px sans-serif';
    ctx.fillText(`${stats.totalRuns} run${stats.totalRuns !== 1 ? 's' : ''}`, PAD, y + 22);
    y += 22 + 36;

    // ── Metric tiles ─────────────────────────────────────────────────────────
    type Metric = { label: string; value: string; sub?: string };
    const metrics: Metric[] = [
        { label: 'Total Runs',   value: String(stats.totalRuns) },
        { label: 'Victories',    value: String(stats.wins),   sub: pct(stats.wins, stats.totalRuns) + ' win rate' },
        { label: 'Defeats',      value: String(stats.losses) },
        { label: 'Abandoned',    value: String(stats.abandoned) },
    ];
    if (stats.highestAscVictory !== null)
        metrics.push({ label: 'Best Ascension', value: `A${stats.highestAscVictory}`, sub: 'highest cleared' });
    if (stats.longestRunTime !== null)
        metrics.push({ label: 'Longest Run', value: fmtSeconds(stats.longestRunTime), sub: 'single run' });
    if (stats.avgFloor !== null)
        metrics.push({ label: 'Avg Floor',  value: String(stats.avgFloor),  sub: 'all runs' });
    if (stats.avgDefeatFloor !== null)
        metrics.push({ label: 'Avg Floor',  value: String(stats.avgDefeatFloor), sub: 'at defeat' });
    if (stats.avgWinFloor !== null)
        metrics.push({ label: 'Avg Floor',  value: String(stats.avgWinFloor),    sub: 'victories only' });
    if (stats.avgTime !== null)
        metrics.push({ label: 'Avg Run Time', value: fmtSeconds(stats.avgTime) });
    if (stats.fastestWin !== null)
        metrics.push({ label: 'Fastest Victory', value: fmtSeconds(stats.fastestWin) });
    if (stats.totalTimeSeconds !== null)
        metrics.push({ label: 'Total Time', value: fmtTotal(stats.totalTimeSeconds), sub: 'across all runs' });

    const metricRows = Math.ceil(metrics.length / BOX_COLS);
    metrics.forEach((m, i) => {
        const col = i % BOX_COLS;
        const row = Math.floor(i / BOX_COLS);
        const bx  = PAD + col * (BOX_W + BOX_GAP);
        const by  = y   + row * (BOX_H + BOX_GAP);
        drawMetricBox(ctx, bx, by, m.label, m.value, m.sub);
    });
    y += metricRows * BOX_H + (metricRows - 1) * BOX_GAP + 44;

    // ── Character breakdown ───────────────────────────────────────────────────
    if (stats.charRows.length > 0) {
        y = await drawTable(ctx, 'By Character', stats.charRows, y);
    }

    // ── Ascension breakdown (only if 2+ distinct ascensions) ─────────────────
    if (stats.ascRows.length > 1) {
        y = await drawTable(ctx, 'By Ascension', stats.ascRows, y);
    }

    // ── Top cards in victories ────────────────────────────────────────────────
    if (stats.topWinCards.length > 0) {
        y = await drawCardRow(ctx, stats.topWinCards, 'wins', 'Most Common Cards in Victories', false, y);
    }

    // ── Top cards overall ─────────────────────────────────────────────────────
    if (stats.topAllCards.length > 0) {
        y = await drawCardRow(ctx, stats.topAllCards, 'appearances', 'Most Common Cards Overall', false, y);
    }

    // ── Per-character top cards ───────────────────────────────────────────────
    if (stats.topCardsByChar.length > 0) {
        y = drawHeading(ctx, 'Most Common Cards by Character', y);
        y += 4;
        for (const { charName, cards } of stats.topCardsByChar) {
            if (cards.length > 0) {
                y = await drawCardRow(ctx, cards, 'appearances', charName, true, y, charIconUrl(charName) ?? undefined);
            }
        }
        y += 6;
    }

    // ── Top relics in victories ───────────────────────────────────────────────
    if (stats.topWinRelics.length > 0) {
        y = await drawRelicRow(ctx, stats.topWinRelics, 'wins', 'Most Common Relics in Victories', y);
    }

    // ── Top relics overall ───────────────────────────────────────────────────
    if (stats.topAllRelics.length > 0) {
        y = await drawRelicRow(ctx, stats.topAllRelics, 'appearances', 'Most Common Relics Overall', y);
    }

    // ── Footer watermark ──────────────────────────────────────────────────────
    y += 20;
    ctx.fillStyle = C_MUTED;
    ctx.font      = '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('mrtyton.github.io/sts2-deck-exporter', W - PAD, y);
    y += 28;

    const finalH = y + PAD;

    // ── Crop to actual height ─────────────────────────────────────────────────
    const out = document.createElement('canvas');
    out.width  = W;
    out.height = finalH;
    out.getContext('2d')!.drawImage(tmpCanvas, 0, 0);
    return out;
}
