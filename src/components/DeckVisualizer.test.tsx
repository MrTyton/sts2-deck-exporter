import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, describe, it, vi, beforeEach } from 'vitest';
import { DeckVisualizer } from './DeckVisualizer';
vi.mock('../utils/canvasExport', () => ({
    generateDeckImage: vi.fn(),
}));

describe('DeckVisualizer', () => {
    const mockCards: any[] = [
        { id: 'strike', count: 3, upgraded: false, upgrades: 0 },
        { id: 'defend', count: 2, upgraded: true, upgrades: 1, enchantment: 'FIRE' }
    ];

    const mockMeta: any = {
        characterName: 'The Ironclad',
        ascension: 20,
        outcome: 'Victory',
        floor: 51,
        relics: ['burning_blood', 'bag_of_preparation']
    };

    const mockMultiplayerRun: any = {
        meta: {
            characterName: 'The Ironclad & The Silent',
            ascension: 10,
            outcome: 'Defeat',
            floor: 30
        },
        players: [
            {
                characterName: 'The Ironclad',
                relics: ['burning_blood'],
                cards: [{ id: 'strike_ironclad', count: 1, upgraded: false, upgrades: 0 }]
            },
            {
                characterName: 'The Silent',
                relics: ['ring_of_the_snake'],
                cards: [{ id: 'strike_silent', count: 2, upgraded: true, upgrades: 1, enchantment: 'POISON' }]
            }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock global window functions
        Object.defineProperty(window, 'location', {
            value: { assign: vi.fn(), pathname: '/current-path' },
            writable: true
        });
        Object.assign(navigator, {
            clipboard: {
                write: vi.fn(),
                writeText: vi.fn(),
            },
        });
    });

    it('renders the character name, total cards, ascension, and outcome correctly', () => {
        render(<DeckVisualizer run={{ cards: mockCards, meta: mockMeta }} />);
        expect(screen.getByText('The Ironclad')).toBeInTheDocument();
        expect(screen.getByText('5 cards')).toBeInTheDocument();
        expect(screen.getByText(/A20/)).toBeInTheDocument();
        expect(screen.getByText(/Victory/)).toBeInTheDocument();
        expect(screen.getByText(/51/)).toBeInTheDocument();
    });

    it('renders the relics accurately when provided', () => {
        render(<DeckVisualizer run={{ cards: mockCards, meta: mockMeta }} />);
        expect(screen.getByText('Relics')).toBeInTheDocument();
        const relicImages = screen.getAllByRole('img').filter(img => (img as HTMLImageElement).src.includes('relics')) as HTMLImageElement[];
        expect(relicImages.length).toBe(2);
        expect(relicImages[0].alt).toBe('burning_blood');
    });

    it('renders cards with correct counts, upgrades, and enchantments', () => {
        render(<DeckVisualizer run={{ cards: mockCards, meta: mockMeta }} />);
        expect(screen.getAllByText(/strike/i).length).toBeGreaterThan(0);
        expect(screen.getByText('x3')).toBeInTheDocument();

        expect(screen.getByText(/defend/i)).toBeInTheDocument();
        expect(screen.getAllByText(/\+/).length).toBeGreaterThan(0);
        expect(screen.getByText('x2')).toBeInTheDocument();
        expect(screen.getByText('FIRE')).toBeInTheDocument();
    });

    it('calls navigator.clipboard.writeText on Copy Share Link', async () => {
        render(<DeckVisualizer run={{ cards: mockCards, meta: mockMeta }} />);
        const copyLinkBtn = screen.getByText('Copy Share Link');
        fireEvent.click(copyLinkBtn);

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalled();
            expect(screen.getByText('Copied!')).toBeInTheDocument();
        });
    });

    it('calls window.location.assign on Reset', () => {
        render(<DeckVisualizer run={{ cards: mockCards, meta: mockMeta }} />);
        const resetBtn = screen.getByText('Reset');
        fireEvent.click(resetBtn);
        expect(window.location.assign).toHaveBeenCalledWith(window.location.pathname);
    });

    it('renders patch badge when buildId is present in meta', () => {
        const metaWithPatch = { ...mockMeta, buildId: 'v0.99.1' };
        render(<DeckVisualizer run={{ cards: mockCards, meta: metaWithPatch }} />);
        expect(screen.getByText('v0.99.1')).toBeInTheDocument();
        expect(screen.getByText(/Patch/)).toBeInTheDocument();
    });

    it('does not render patch badge when buildId is absent', () => {
        render(<DeckVisualizer run={{ cards: mockCards, meta: mockMeta }} />);
        expect(screen.queryByText(/Patch/)).toBeNull();
    });

    it('renders multiplayer run correctly (stacked layers)', () => {
        render(<DeckVisualizer run={mockMultiplayerRun} />);

        // Metadata
        expect(screen.getByText('The Ironclad & The Silent')).toBeInTheDocument();
        expect(screen.getByText(/A10/)).toBeInTheDocument();
        expect(screen.getByText(/Defeat/)).toBeInTheDocument();

        // Ironclad Section
        // The player sub-header
        expect(screen.getByText('The Ironclad', { selector: 'h3' })).toBeInTheDocument();
        expect(screen.getAllByText(/1 cards/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/strike/i).length).toBeGreaterThan(0);

        // Silent Section
        // The player sub-header
        expect(screen.getByText('The Silent', { selector: 'h3' })).toBeInTheDocument();
        expect(screen.getAllByText(/2 cards/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/strike/i).length).toBeGreaterThan(1); // Should find both ironclad and silent strikes
        expect(screen.getAllByText(/\+/).length).toBeGreaterThan(0);
        expect(screen.getByText('x2')).toBeInTheDocument();
        expect(screen.getByText('POISON')).toBeInTheDocument();
    });
});
