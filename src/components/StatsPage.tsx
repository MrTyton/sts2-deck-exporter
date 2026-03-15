import { useMemo, useState, useCallback } from 'react';
import { formatCardName, getCardPortraitId } from '../utils/cardUtils';
import { generateStatsImage } from '../utils/statsImageExport';
import { encodeStats } from '../utils/statsEncoder';
import type { StatsTableRow, StatsTopCard, StatsTopRelic, StatsSnapshot } from '../utils/statsImageExport';
import { Tooltip } from './Tooltip';
import { getCardTooltip, getRelicTooltip } from '../utils/tooltipUtils';
import type { TooltipContent } from '../utils/tooltipUtils';
import type { RunData, CardData } from '../types';

interface StatsPageProps {
    runs: RunData[];
    sharedStats?: StatsSnapshot;
}

// ── Starter card IDs to exclude from "most common" lists ─────────────────────
// Sourced from each character's StartingDeck definition in the decompiled game.
const STARTER_CARD_IDS = new Set([
    // Generic fallbacks
    'strike', 'defend',
    // Ironclad: 5× strike, 4× defend, 1× bash
    'strike_ironclad', 'defend_ironclad', 'bash',
    // Silent: 5× strike, 5× defend, 1× neutralize, 1× survivor
    'strike_silent', 'defend_silent', 'neutralize', 'survivor',
    // Defect: 4× strike, 4× defend, 1× zap, 1× dualcast
    'strike_defect', 'defend_defect', 'zap', 'dualcast',
    // Necrobinder: 4× strike, 4× defend, 1× bodyguard, 1× unleash
    'strike_necrobinder', 'defend_necrobinder', 'bodyguard', 'unleash',
    // Regent: 4× strike, 4× defend, 1× falling_star, 1× venerate
    'strike_regent', 'defend_regent', 'falling_star', 'venerate',
]);

// ── Starter relic IDs to exclude from relic counts ───────────────────────────
// Sourced from each character's StartingRelics definition in the decompiled game.
const STARTER_RELIC_IDS = new Set([
    'burning_blood',      // Ironclad
    'ring_of_the_snake',  // Silent
    'cracked_core',       // Defect
    'bound_phylactery',   // Necrobinder
    'divine_right',       // Regent
]);

// ── Character icon mapping ─────────────────────────────────────────────────────
// Maps display character names to their char_select sprite filenames.
const CHARACTER_ICONS: Record<string, string> = {
    'The Ironclad':   'char_select_ironclad.webp',
    'The Silent':     'char_select_silent.webp',
    'The Defect':     'char_select_defect.webp',
    'The Necrobinder':'char_select_necrobinder.webp',
    'The Regent':     'char_select_regent.webp',
};

function charIconUrl(name: string): string | null {
    const file = CHARACTER_ICONS[name];
    return file ? `${import.meta.env.BASE_URL}assets/characters/${file}` : null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseFloor(floor: string | number | undefined): number {
    if (floor === undefined || floor === '?') return 0;
    return parseInt(String(floor), 10) || 0;
}

function parseTime(time: string | undefined): number | null {
    if (!time) return null;
    const parts = time.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
}

function formatSeconds(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatTotalTime(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function pct(num: number, denom: number): string {
    if (denom === 0) return '—';
    return `${Math.round((num / denom) * 100)}%`;
}

function avg(values: number[]): number | null {
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="glass-panel" style={{
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            borderRadius: '12px',
            minWidth: 0,
        }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-color)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{value}</span>
            {sub && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{sub}</span>}
        </div>
    );
}

type TableRow = StatsTableRow;

function BreakdownTable({ title, rows }: { title: string; rows: StatsTableRow[] }) {
    if (rows.length === 0) return null;

    const thStyle: React.CSSProperties = {
        padding: '0.5rem 0.75rem',
        textAlign: 'left',
        color: 'var(--text-secondary)',
        fontSize: '0.78rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--surface-border)',
    };
    const tdStyle: React.CSSProperties = {
        padding: '0.55rem 0.75rem',
        fontSize: '0.9rem',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        whiteSpace: 'nowrap',
    };
    const numStyle: React.CSSProperties = { ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

    return (
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '12px' }}>
            <h3 style={{ color: 'var(--accent-color)', marginBottom: '1rem', fontSize: '1rem', fontFamily: 'var(--font-display)' }}>{title}</h3>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>{title === 'By Ascension' ? 'Asc' : 'Character'}</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Runs</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Wins</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Losses</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Abandoned</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Win%</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Floor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.label} style={{ transition: 'background 0.15s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <td style={{ ...tdStyle, fontWeight: 600 }}>
                                    {(() => {
                                        const icon = title !== 'By Ascension' ? charIconUrl(row.label) : null;
                                        return icon ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                                <img src={icon} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                                                {row.label}
                                            </span>
                                        ) : row.label;
                                    })()}
                                </td>
                                <td style={numStyle}>{row.runs}</td>
                                <td style={{ ...numStyle, color: 'var(--tooltip-green)' }}>{row.wins}</td>
                                <td style={{ ...numStyle, color: 'var(--tooltip-red)' }}>{row.losses}</td>
                                <td style={{ ...numStyle, color: 'var(--text-secondary)' }}>{row.abandoned}</td>
                                <td style={{ ...numStyle, color: row.wins / row.runs >= 0.5 ? 'var(--tooltip-green)' : 'var(--text-primary)' }}>
                                    {pct(row.wins, row.runs)}
                                </td>
                                <td style={numStyle}>{row.avgFloor ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

type TopCard  = StatsTopCard;
type TopRelic = StatsTopRelic;

interface TooltipHandlers {
    onMouseEnter: (e: React.MouseEvent, id: string, card?: CardData) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
}

/**
 * countType:
 *  'wins'        → badge shows wins×        (for victories list)
 *  'appearances' → badge shows appearances×  (for overall list)
 */
function TopCardsSection({ cards, title, countType = 'wins', tooltipHandlers, iconUrl }: {
    cards: TopCard[];
    title: string;
    countType?: 'wins' | 'appearances';
    tooltipHandlers: TooltipHandlers;
    iconUrl?: string;
}) {
    if (cards.length === 0) return null;

    return (
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '12px' }}>
            <h3 style={{ color: 'var(--accent-color)', marginBottom: '1rem', fontSize: '1rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {iconUrl && <img src={iconUrl} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
                {title}
            </h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {cards.map(({ id, card, appearances, wins }) => (
                    <div
                        key={id}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '72px', cursor: 'default' }}
                        onMouseEnter={e => tooltipHandlers.onMouseEnter(e, id, card)}
                        onMouseMove={tooltipHandlers.onMouseMove}
                        onMouseLeave={tooltipHandlers.onMouseLeave}
                    >
                        <div style={{ position: 'relative' }}>
                            <img
                                src={`${import.meta.env.BASE_URL}assets/portraits/${getCardPortraitId(card)}.webp`}
                                alt={formatCardName(id)}
                                style={{ width: 64, height: 64, borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--surface-border)' }}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            <span style={{
                                position: 'absolute', bottom: 2, right: 2,
                                background: 'rgba(0,0,0,0.85)', color: 'var(--accent-color)',
                                fontSize: '0.7rem', fontWeight: 800,
                                padding: '1px 5px', borderRadius: '4px',
                            }}>{countType === 'wins' ? wins : appearances}×</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.2, maxWidth: 72 }}>
                            {formatCardName(id)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TopRelicsSection({ relics, title, countType = 'wins', tooltipHandlers }: {
    relics: TopRelic[];
    title: string;
    countType?: 'wins' | 'appearances';
    tooltipHandlers: TooltipHandlers;
}) {
    if (relics.length === 0) return null;

    return (
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '12px' }}>
            <h3 style={{ color: 'var(--accent-color)', marginBottom: '1rem', fontSize: '1rem', fontFamily: 'var(--font-display)' }}>{title}</h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {relics.map(({ id, appearances, wins }) => (
                    <div
                        key={id}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '56px', cursor: 'default' }}
                        onMouseEnter={e => tooltipHandlers.onMouseEnter(e, id)}
                        onMouseMove={tooltipHandlers.onMouseMove}
                        onMouseLeave={tooltipHandlers.onMouseLeave}
                    >
                        <div style={{ position: 'relative' }}>
                            <div style={{ width: 56, height: 56, background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '4px', border: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img
                                    src={`${import.meta.env.BASE_URL}assets/relics/${id}.webp`}
                                    alt={id}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            </div>
                            <span style={{
                                position: 'absolute', bottom: -4, right: -4,
                                background: 'rgba(0,0,0,0.85)', color: 'var(--accent-color)',
                                fontSize: '0.7rem', fontWeight: 800,
                                padding: '1px 5px', borderRadius: '4px',
                                border: '1px solid rgba(214,178,81,0.3)',
                            }}>{countType === 'wins' ? wins : appearances}×</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function StatsPage({ runs, sharedStats }: StatsPageProps) {
    // All hooks must be declared before any early return (Rules of Hooks)
    const [tooltipContent, setTooltipContent] = useState<TooltipContent | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [tooltipVisible, setTooltipVisible] = useState(false);

    const handleCardEnter = useCallback((e: React.MouseEvent, id: string, card?: CardData) => {
        if (!card) return;
        const content = getCardTooltip(id, card.upgraded, card.upgrades, card.enchantment, card.enchantmentAmount, card.cardType, card.tinkerTimeRider);
        setTooltipContent(content);
        setTooltipPos({ x: e.clientX, y: e.clientY });
        setTooltipVisible(true);
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        setTooltipPos({ x: e.clientX, y: e.clientY });
    }, []);

    const handleHideTooltip = useCallback(() => setTooltipVisible(false), []);

    const handleRelicEnter = useCallback((e: React.MouseEvent, id: string) => {
        const content = getRelicTooltip(id);
        setTooltipContent(content);
        setTooltipPos({ x: e.clientX, y: e.clientY });
        setTooltipVisible(true);
    }, []);

    const cardTooltipHandlers: TooltipHandlers = {
        onMouseEnter: handleCardEnter,
        onMouseMove: handleMouseMove,
        onMouseLeave: handleHideTooltip,
    };

    const relicTooltipHandlers: TooltipHandlers = {
        onMouseEnter: handleRelicEnter,
        onMouseMove: handleMouseMove,
        onMouseLeave: handleHideTooltip,
    };

    const stats = useMemo((): StatsSnapshot | null => {
        if (sharedStats && runs.length === 0) return sharedStats;
        if (runs.length === 0) return null;

        const totalRuns = runs.length;
        let wins = 0, losses = 0, abandoned = 0;
        const floors: number[] = [];
        const winFloors: number[] = [];
        const defeatFloors: number[] = [];
        const times: number[] = [];
        const winTimes: number[] = [];
        let highestAscVictory = -1;
        let longestRunTime = 0;
        let totalTimeSeconds = 0;

        // Relic frequency per run (deduped across all players in the run)
        const relicAppearances: Record<string, { runs: number; wins: number }> = {};

        // Per-character tracking
        const byChar: Record<string, { runs: number; wins: number; losses: number; abandoned: number; floors: number[] }> = {};

        // Per-ascension tracking
        const byAsc: Record<number, { runs: number; wins: number; losses: number; abandoned: number; floors: number[] }> = {};

        // Global card frequency (starter-filtered): id → { runs it appeared in, wins, card }
        const cardAppearances: Record<string, { runs: number; wins: number; card: CardData }> = {};

        // Per-character card frequency (starter-filtered): charName → cardId → { runs, wins, card }
        const cardByChar: Record<string, Record<string, { runs: number; wins: number; card: CardData }>> = {};

        for (const run of runs) {
            const outcome = run.meta?.outcome ?? 'Unknown';
            const floor = parseFloor(run.meta?.floor);
            const ascension = Number(run.meta?.ascension ?? 0);
            const isVictory = outcome === 'Victory';
            const isDefeat = outcome === 'Defeat';
            const isAbandoned = outcome === 'Abandoned';

            if (isVictory) { wins++; winFloors.push(floor); if (ascension > highestAscVictory) highestAscVictory = ascension; }
            else if (isDefeat) { losses++; if (floor > 0) defeatFloors.push(floor); }
            else if (isAbandoned) abandoned++;

            if (floor > 0) floors.push(floor);

            const t = parseTime(run.meta?.time);
            if (t !== null) {
                times.push(t);
                totalTimeSeconds += t;
                if (t > longestRunTime) longestRunTime = t;
                if (isVictory) winTimes.push(t);
            }

            // Collect players' character names
            const players = run.players ?? (run.meta?.characterName ? [{ characterName: run.meta.characterName, cards: run.cards ?? [], relics: run.meta.relics ?? [] }] : []);

            // For multi-player runs, each character counts individually
            const charNames: string[] = players.length > 0
                ? players.map(p => p.characterName)
                : [run.meta?.characterName ?? 'Unknown'];

            for (const char of charNames) {
                if (!byChar[char]) byChar[char] = { runs: 0, wins: 0, losses: 0, abandoned: 0, floors: [] };
                byChar[char].runs++;
                if (isVictory) byChar[char].wins++;
                else if (isDefeat) byChar[char].losses++;
                else if (isAbandoned) byChar[char].abandoned++;
                if (floor > 0) byChar[char].floors.push(floor);
            }

            // Ascension
            if (!byAsc[ascension]) byAsc[ascension] = { runs: 0, wins: 0, losses: 0, abandoned: 0, floors: [] };
            byAsc[ascension].runs++;
            if (isVictory) byAsc[ascension].wins++;
            else if (isDefeat) byAsc[ascension].losses++;
            else if (isAbandoned) byAsc[ascension].abandoned++;
            if (floor > 0) byAsc[ascension].floors.push(floor);

            // Relics — collect unique relic IDs across all players in this run
            const relicsSeen = new Set<string>();
            for (const p of players) {
                for (const relicId of (p.relics ?? [])) {
                    if (!relicsSeen.has(relicId) && !STARTER_RELIC_IDS.has(relicId)) {
                        relicsSeen.add(relicId);
                        if (!relicAppearances[relicId]) relicAppearances[relicId] = { runs: 0, wins: 0 };
                        relicAppearances[relicId].runs++;
                        if (isVictory) relicAppearances[relicId].wins++;
                    }
                }
            }

            // Cards — collect unique card IDs seen per run
            const cardsSeen = new Set<string>();
            for (const p of players) {
                const charName = p.characterName;
                if (!cardByChar[charName]) cardByChar[charName] = {};
                const charCardsSeen = new Set<string>();

                for (const card of (p.cards ?? [])) {
                    // Global (starter-filtered)
                    if (!STARTER_CARD_IDS.has(card.id) && !cardsSeen.has(card.id)) {
                        cardsSeen.add(card.id);
                        if (!cardAppearances[card.id]) cardAppearances[card.id] = { runs: 0, wins: 0, card };
                        cardAppearances[card.id].runs++;
                        if (isVictory) cardAppearances[card.id].wins++;
                    }
                    // Per-character (starter-filtered)
                    if (!STARTER_CARD_IDS.has(card.id) && !charCardsSeen.has(card.id)) {
                        charCardsSeen.add(card.id);
                        if (!cardByChar[charName][card.id]) cardByChar[charName][card.id] = { runs: 0, wins: 0, card };
                        cardByChar[charName][card.id].runs++;
                        if (isVictory) cardByChar[charName][card.id].wins++;
                    }
                }
            }
        }

        // Build character rows (sorted by run count desc)
        const charRows: TableRow[] = Object.entries(byChar)
            .sort((a, b) => b[1].runs - a[1].runs)
            .map(([name, d]) => ({
                label: name,
                runs: d.runs,
                wins: d.wins,
                losses: d.losses,
                abandoned: d.abandoned,
                avgFloor: avg(d.floors),
            }));

        // Build ascension rows (sorted numerically)
        const ascRows: TableRow[] = Object.entries(byAsc)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([asc, d]) => ({
                label: `A${asc}`,
                runs: d.runs,
                wins: d.wins,
                losses: d.losses,
                abandoned: d.abandoned,
                avgFloor: avg(d.floors),
            }));

        // Top 10 most-seen cards in victories (starter-filtered), sorted by win appearances
        const topWinCards: TopCard[] = Object.entries(cardAppearances)
            .filter(([, d]) => d.wins > 0)
            .sort((a, b) => b[1].wins - a[1].wins || b[1].runs - a[1].runs)
            .slice(0, 10)
            .map(([id, d]) => ({ id, card: d.card, appearances: d.runs, wins: d.wins }));

        // Top 10 most-seen cards overall (starter-filtered)
        const topAllCards: TopCard[] = Object.entries(cardAppearances)
            .sort((a, b) => b[1].runs - a[1].runs)
            .slice(0, 10)
            .map(([id, d]) => ({ id, card: d.card, appearances: d.runs, wins: d.wins }));

        // Top 10 relics in victories
        const topWinRelics: TopRelic[] = Object.entries(relicAppearances)
            .filter(([, d]) => d.wins > 0)
            .sort((a, b) => b[1].wins - a[1].wins || b[1].runs - a[1].runs)
            .slice(0, 10)
            .map(([id, d]) => ({ id, appearances: d.runs, wins: d.wins }));

        // Top 10 relics overall
        const topAllRelics: TopRelic[] = Object.entries(relicAppearances)
            .sort((a, b) => b[1].runs - a[1].runs)
            .slice(0, 10)
            .map(([id, d]) => ({ id, appearances: d.runs, wins: d.wins }));

        // Per-character top 10 most-seen cards (starter-filtered, sorted by appearances)
        const topCardsByChar: Array<{ charName: string; cards: TopCard[] }> = Object.entries(cardByChar)
            .filter(([, cardMap]) => Object.keys(cardMap).length > 0)
            .sort((a, b) => {
                // Sort characters by run count descending
                const runsA = byChar[a[0]]?.runs ?? 0;
                const runsB = byChar[b[0]]?.runs ?? 0;
                return runsB - runsA;
            })
            .map(([charName, cardMap]) => ({
                charName,
                cards: Object.entries(cardMap)
                    .sort((a, b) => b[1].runs - a[1].runs || b[1].wins - a[1].wins)
                    .slice(0, 10)
                    .map(([id, d]) => ({ id, card: d.card, appearances: d.runs, wins: d.wins })),
            }))
            .filter(({ cards }) => cards.length > 0);

        return {
            totalRuns,
            wins,
            losses,
            abandoned,
            longestRunTime: longestRunTime > 0 ? longestRunTime : null,
            avgFloor: avg(floors),
            avgWinFloor: avg(winFloors),
            avgDefeatFloor: avg(defeatFloors),
            avgTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
            fastestWin: winTimes.length > 0 ? Math.min(...winTimes) : null,
            totalTimeSeconds: totalTimeSeconds > 0 ? totalTimeSeconds : null,
            highestAscVictory: highestAscVictory >= 0 ? highestAscVictory : null,
            charRows,
            ascRows,
            topWinCards,
            topAllCards,
            topCardsByChar,
            topWinRelics,
            topAllRelics,
        };
    }, [runs, sharedStats]);

    // ── Button states (before early return — Rules of Hooks) ───────────────────
    const [exportText,   setExportText]   = useState('Download Stats Image');
    const [copyText,     setCopyText]     = useState('Copy Stats Image');
    const [copyLinkText, setCopyLinkText] = useState('Copy Stats Link');

    if (!stats) return null;

    // ── Image export ─────────────────────────────────────────────────────
    const handleExport = async () => {
        setExportText('Generating…');
        try {
            const canvas  = await generateStatsImage(stats);
            const dataUrl = canvas.toDataURL('image/png');
            const link    = document.createElement('a');
            link.download = 'sts2-run-stats.png';
            link.href     = dataUrl;
            link.click();
        } catch (err) {
            console.error('Stats image export failed', err);
        } finally {
            setExportText('Download Stats Image');
        }
    };

    const handleCopyImage = async () => {
        setCopyText('Generating…');
        try {
            const canvas = await generateStatsImage(stats);
            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error('toBlob failed');
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                setCopyText('Copied!');
                setTimeout(() => setCopyText('Copy Stats Image'), 2000);
            }, 'image/png');
        } catch (err) {
            console.error('Stats image copy failed', err);
            setCopyText('Failed');
            setTimeout(() => setCopyText('Copy Stats Image'), 2000);
        }
    };

    const handleCopyLink = async () => {
        try {
            const encoded = await encodeStats(stats);
            const base    = window.location.href.split('#')[0];
            await navigator.clipboard.writeText(`${base}#s=${encoded}`);
            setCopyLinkText('Copied!');
            setTimeout(() => setCopyLinkText('Copy Stats Link'), 2000);
        } catch (err) {
            console.error('Failed to copy stats link', err);
            setCopyLinkText('Failed');
            setTimeout(() => setCopyLinkText('Copy Stats Link'), 2000);
        }
    };

    return (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Export controls */}
            <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn-secondary" onClick={handleCopyLink}>{copyLinkText}</button>
                <button className="btn-secondary" onClick={handleCopyImage}>{copyText}</button>
                <button className="btn-primary"   onClick={handleExport}>{exportText}</button>
            </div>
            {/* Summary Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                <StatCard label="Total Runs" value={stats.totalRuns} />
                <StatCard label="Victories" value={stats.wins} sub={pct(stats.wins, stats.totalRuns) + ' win rate'} />
                <StatCard label="Defeats" value={stats.losses} />
                <StatCard label="Abandoned" value={stats.abandoned} />
                {stats.highestAscVictory !== null && (
                    <StatCard label="Best Ascension" value={`A${stats.highestAscVictory}`} sub="highest cleared" />
                )}
                {stats.longestRunTime !== null && (
                    <StatCard label="Longest Run" value={formatSeconds(stats.longestRunTime)} sub="single run" />
                )}
                {stats.avgFloor !== null && (
                    <StatCard label="Avg Floor" value={stats.avgFloor} sub="all runs" />
                )}
                {stats.avgDefeatFloor !== null && (
                    <StatCard label="Avg Floor" value={stats.avgDefeatFloor} sub="at defeat" />
                )}
                {stats.avgWinFloor !== null && (
                    <StatCard label="Avg Floor" value={stats.avgWinFloor} sub="victories only" />
                )}
                {stats.avgTime !== null && (
                    <StatCard label="Avg Run Time" value={formatSeconds(stats.avgTime)} />
                )}
                {stats.fastestWin !== null && (
                    <StatCard label="Fastest Victory" value={formatSeconds(stats.fastestWin)} />
                )}
                {stats.totalTimeSeconds !== null && (
                    <StatCard label="Total Time" value={formatTotalTime(stats.totalTimeSeconds)} sub="across all runs" />
                )}
            </div>

            {/* Breakdowns */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <BreakdownTable title="By Character" rows={stats.charRows} />
                <BreakdownTable title="By Ascension" rows={stats.ascRows} />
            </div>

            {/* Global Top Cards */}
            {stats.topWinCards.length > 0 && (
                <TopCardsSection cards={stats.topWinCards} title="Most Common Cards in Victories" countType="wins" tooltipHandlers={cardTooltipHandlers} />
            )}
            {stats.topAllCards.length > 0 && (
                <TopCardsSection cards={stats.topAllCards} title="Most Common Cards Overall" countType="appearances" tooltipHandlers={cardTooltipHandlers} />
            )}

            {/* Per-Character Top Cards */}
            {stats.topCardsByChar.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ color: 'var(--accent-color)', fontSize: '1rem', fontFamily: 'var(--font-display)', margin: 0 }}>
                        Most Common Cards by Character
                    </h3>
                    {stats.topCardsByChar.map(({ charName, cards }) => (
                        <TopCardsSection
                            key={charName}
                            cards={cards}
                            title={charName}
                            countType="appearances"
                            tooltipHandlers={cardTooltipHandlers}
                            iconUrl={charIconUrl(charName) ?? undefined}
                        />
                    ))}
                </div>
            )}

            {/* Top Relics */}
            {stats.topWinRelics.length > 0 && (
                <TopRelicsSection relics={stats.topWinRelics} title="Most Common Relics in Victories" tooltipHandlers={relicTooltipHandlers} />
            )}
            {stats.topAllRelics.length > 0 && (
                <TopRelicsSection relics={stats.topAllRelics} title="Most Common Relics Overall" tooltipHandlers={relicTooltipHandlers} />
            )}
        </div>

        {tooltipContent && (
            <Tooltip
                content={tooltipContent}
                x={tooltipPos.x}
                y={tooltipPos.y}
                visible={tooltipVisible}
            />
        )}
        </>
    );
}
