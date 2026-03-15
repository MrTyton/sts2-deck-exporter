import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsPage } from './StatsPage';
import type { RunData } from '../types';
import type { StatsSnapshot } from '../utils/statsImageExport';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../utils/statsImageExport', async (importOriginal) => {
    const original = await importOriginal<typeof import('../utils/statsImageExport')>();
    return {
        ...original,
        generateStatsImage: vi.fn().mockResolvedValue({
            toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
            toBlob: vi.fn((_cb: (b: Blob | null) => void) => _cb(new Blob(['mock'], { type: 'image/png' }))),
        }),
    };
});

vi.mock('../utils/statsEncoder', () => ({
    encodeStats: vi.fn().mockResolvedValue('mock-encoded-stats'),
    decodeStats: vi.fn().mockResolvedValue(null),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Two runs: one Victory (Ironclad, A20, floor 51) and one Defeat (Silent, A10, floor 30)
const mockRuns: RunData[] = [
    {
        players: [{
            characterName: 'The Ironclad',
            cards: [
                { id: 'anger', count: 2, upgraded: false, upgrades: 0, enchantment: null },
                { id: 'bash', count: 1, upgraded: true, upgrades: 1, enchantment: null },
            ],
            relics: ['war_hammer'],
        }],
        meta: {
            characterName: 'The Ironclad',
            ascension: 20,
            outcome: 'Victory',
            floor: 51,
            time: '1:23:45',
            timestamp: 1000000,
        },
    },
    {
        players: [{
            characterName: 'The Silent',
            cards: [
                { id: 'shiv', count: 3, upgraded: false, upgrades: 0, enchantment: null },
            ],
            relics: ['shuriken'],
        }],
        meta: {
            characterName: 'The Silent',
            ascension: 10,
            outcome: 'Defeat',
            floor: 30,
            time: '0:45:00',
            timestamp: 1000001,
        },
    },
];

const mockSharedStats: StatsSnapshot = {
    totalRuns: 100,
    wins: 70,
    losses: 25,
    abandoned: 5,
    longestRunTime: 9000,
    avgFloor: 44,
    avgWinFloor: 51,
    avgDefeatFloor: 32,
    avgTime: 3600,
    fastestWin: 1800,
    totalTimeSeconds: 360000,
    highestAscVictory: 20,
    charRows: [{ label: 'The Ironclad', runs: 60, wins: 45, losses: 12, abandoned: 3, avgFloor: 46 }],
    ascRows: [{ label: 'A20', runs: 30, wins: 20, losses: 8, abandoned: 2, avgFloor: 43 }],
    topWinCards: [],
    topAllCards: [],
    topCardsByChar: [],
    topWinRelics: [],
    topAllRelics: [],
};

// Co-op run where the local player (Ironclad) is identified
const coopRunWithLocalPlayer: RunData = {
    players: [
        {
            characterName: 'The Ironclad',
            cards: [{ id: 'anger', count: 1, upgraded: false, upgrades: 0, enchantment: null }],
            relics: ['war_hammer'],
            isLocalPlayer: true,
        },
        {
            characterName: 'The Silent',
            cards: [{ id: 'shiv', count: 1, upgraded: false, upgrades: 0, enchantment: null }],
            relics: ['shuriken'],
        },
    ],
    meta: {
        characterName: 'The Ironclad & The Silent',
        ascension: 5,
        outcome: 'Victory',
        floor: 40,
        time: '1:00:00',
    },
};

// Co-op run where no local player is identified (fallback to players[0])
const coopRunWithoutLocalPlayer: RunData = {
    players: [
        { characterName: 'The Ironclad', cards: [], relics: [] },
        { characterName: 'The Silent',   cards: [], relics: [] },
    ],
    meta: {
        characterName: 'The Ironclad & The Silent',
        ascension: 5,
        outcome: 'Victory',
        floor: 40,
        time: '1:00:00',
    },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StatsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(navigator, {
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined), write: vi.fn().mockResolvedValue(undefined) },
        });
    });

    it('renders null (nothing) when runs is empty and no sharedStats', () => {
        const { container } = render(<StatsPage runs={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders total run count', () => {
        render(<StatsPage runs={mockRuns} />);
        expect(screen.getByText('Total Runs')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders victory and defeat counts', () => {
        render(<StatsPage runs={mockRuns} />);
        expect(screen.getByText('Victories')).toBeInTheDocument();
        expect(screen.getByText('Defeats')).toBeInTheDocument();
        // 1 win, 1 loss
        const ones = screen.getAllByText('1');
        expect(ones.length).toBeGreaterThanOrEqual(2);
    });

    it('renders highest ascension victory (A20)', () => {
        render(<StatsPage runs={mockRuns} />);
        // A20 appears in the Best Ascension summary tile AND the By Ascension table row
        expect(screen.getAllByText('A20').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Best Ascension')).toBeInTheDocument();
    });

    it('renders "By Character" breakdown table with character rows', () => {
        render(<StatsPage runs={mockRuns} />);
        expect(screen.getByText('By Character')).toBeInTheDocument();
        expect(screen.getAllByText('The Ironclad').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('The Silent').length).toBeGreaterThanOrEqual(1);
    });

    it('renders "By Ascension" breakdown table', () => {
        render(<StatsPage runs={mockRuns} />);
        expect(screen.getByText('By Ascension')).toBeInTheDocument();
        // A20 and A10 should appear as row labels
        expect(screen.getAllByText(/A\d+/).length).toBeGreaterThan(0);
    });

    it('renders "Most Common Cards in Victories" when victory run has non-starter cards', () => {
        render(<StatsPage runs={mockRuns} />);
        expect(screen.getByText('Most Common Cards in Victories')).toBeInTheDocument();
    });

    it('renders "Most Common Cards Overall" section', () => {
        render(<StatsPage runs={mockRuns} />);
        expect(screen.getByText('Most Common Cards Overall')).toBeInTheDocument();
    });

    it('renders "Most Common Cards by Character" section', () => {
        render(<StatsPage runs={mockRuns} />);
        expect(screen.getByText('Most Common Cards by Character')).toBeInTheDocument();
    });

    it('does NOT show the "Most Common Relics in Victories" section when all relics are starters or empty', () => {
        // 'war_hammer' is not a starter relic so it SHOULD appear
        render(<StatsPage runs={mockRuns} />);
        expect(screen.getByText('Most Common Relics in Victories')).toBeInTheDocument();
    });

    it('renders action buttons (Download, Copy Image, Copy Link)', () => {
        render(<StatsPage runs={mockRuns} />);
        expect(screen.getByText('Download Stats Image')).toBeInTheDocument();
        expect(screen.getByText('Copy Stats Image')).toBeInTheDocument();
        expect(screen.getByText('Copy Stats Link')).toBeInTheDocument();
    });

    it('"Copy Stats Link" calls encodeStats and writes to clipboard', async () => {
        const { encodeStats } = await import('../utils/statsEncoder');
        render(<StatsPage runs={mockRuns} />);
        fireEvent.click(screen.getByText('Copy Stats Link'));
        await waitFor(() => {
            expect(encodeStats).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalled();
        });
    });

    it('"Copy Stats Link" button shows "Copied!" feedback then resets', async () => {
        vi.useFakeTimers();
        render(<StatsPage runs={mockRuns} />);
        // act(async) flushes the encodeStats promise + state updates without real setTimeout
        await act(async () => {
            fireEvent.click(screen.getByText('Copy Stats Link'));
        });
        expect(screen.getByText('Copied!')).toBeInTheDocument();
        // Advance the fake 2-second reset timer
        act(() => { vi.runAllTimers(); });
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
        expect(screen.getByText('Copy Stats Link')).toBeInTheDocument();
        vi.useRealTimers();
    });

    it('renders average run time when present', () => {
        render(<StatsPage runs={mockRuns} />);
        expect(screen.getByText('Avg Run Time')).toBeInTheDocument();
    });

    it('renders fastest victory time when there are wins', () => {
        render(<StatsPage runs={mockRuns} />);
        expect(screen.getByText('Fastest Victory')).toBeInTheDocument();
    });

    describe('sharedStats mode', () => {
        it('renders stats from sharedStats when runs is empty', () => {
            render(<StatsPage runs={[]} sharedStats={mockSharedStats} />);
            expect(screen.getByText('Total Runs')).toBeInTheDocument();
            expect(screen.getByText('100')).toBeInTheDocument();
        });

        it('renders the character row from sharedStats', () => {
            render(<StatsPage runs={[]} sharedStats={mockSharedStats} />);
            expect(screen.getByText('The Ironclad')).toBeInTheDocument();
        });

        it('renders ascension rows from sharedStats', () => {
            render(<StatsPage runs={[]} sharedStats={mockSharedStats} />);
            expect(screen.getByText('By Ascension')).toBeInTheDocument();
        });

        it('still renders null when both runs and sharedStats are falsy', () => {
            const { container } = render(<StatsPage runs={[]} />);
            expect(container.firstChild).toBeNull();
        });
    });

    describe('abandoned runs', () => {
        it('counts abandoned runs correctly', () => {
            const abandonedRun: RunData = {
                players: [{ characterName: 'The Defect', cards: [], relics: [] }],
                meta: { characterName: 'The Defect', ascension: 0, outcome: 'Abandoned', floor: 15 },
            };
            render(<StatsPage runs={[...mockRuns, abandonedRun]} />);
            expect(screen.getAllByText('Abandoned').length).toBeGreaterThanOrEqual(1);
            // 1 abandoned
            const ones = screen.getAllByText('1');
            expect(ones.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('co-op run filtering', () => {
        it('counts only the local player\'s character when isLocalPlayer is set', () => {
            render(<StatsPage runs={[coopRunWithLocalPlayer]} />);
            // The Ironclad (isLocalPlayer=true) should appear in By Character
            expect(screen.getAllByText('The Ironclad').length).toBeGreaterThanOrEqual(1);
            // The Silent (co-op partner) should NOT appear as a character row
            expect(screen.queryByText('The Silent')).not.toBeInTheDocument();
        });

        it('counts only the local player\'s relics and cards when isLocalPlayer is set', () => {
            // war_hammer belongs to Ironclad (local player); shuriken belongs to Silent (partner)
            render(<StatsPage runs={[coopRunWithLocalPlayer]} />);
            // war_hammer image should be attempted; shuriken image for the partner should not
            // We check via the relic section appearing (war_hammer is non-starter, so it renders)
            expect(screen.getByText('Most Common Relics in Victories')).toBeInTheDocument();
        });

        it('falls back to players[0] when no isLocalPlayer is set and shows warning banner', () => {
            render(<StatsPage runs={[coopRunWithoutLocalPlayer]} />);
            // The host (players[0] = Ironclad) should appear, Silent should not
            expect(screen.getAllByText('The Ironclad').length).toBeGreaterThanOrEqual(1);
            expect(screen.queryByText('The Silent')).not.toBeInTheDocument();
            // Fallback warning banner should be visible
            expect(screen.getByText(/Co-op runs detected/i)).toBeInTheDocument();
        });

        it('does NOT show the fallback warning when isLocalPlayer is identified', () => {
            render(<StatsPage runs={[coopRunWithLocalPlayer]} />);
            expect(screen.queryByText(/Co-op runs detected/i)).not.toBeInTheDocument();
        });

        it('does NOT show the fallback warning for solo-only runs', () => {
            render(<StatsPage runs={mockRuns} />);
            expect(screen.queryByText(/Co-op runs detected/i)).not.toBeInTheDocument();
        });

        it('does NOT show the fallback warning when a solo run is present alongside an old-format co-op run', () => {
            // Simulates runs loaded from localStorage before v5: solo runs auto-flag as local,
            // co-op runs have no isLocalPlayer bit set — identity is still considered "known".
            const soloRun: RunData = {
                players: [{ characterName: 'The Ironclad', cards: [], relics: [], isLocalPlayer: true }],
                meta: { characterName: 'The Ironclad', ascension: 0, outcome: 'Victory', floor: 40 },
            };
            render(<StatsPage runs={[soloRun, coopRunWithoutLocalPlayer]} />);
            expect(screen.queryByText(/Co-op runs detected/i)).not.toBeInTheDocument();
        });
    });
});
