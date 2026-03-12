import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, describe, it, vi } from 'vitest';
import { Gallery } from './Gallery';

const GalleryWrapper = (props: any) => {
    const [filters, setFilters] = useState(props.filters || {});
    return <Gallery
        {...props}
        filters={filters}
        onFilterChange={(newFilters: any) => {
            setFilters(newFilters);
            if (props.onFilterChange) props.onFilterChange(newFilters);
        }}
    />;
};

describe('Gallery', () => {
    const mockRuns: any[] = [
        {
            meta: { characterName: 'The Ironclad', ascension: 20, outcome: 'Victory', floor: 51 },
            cards: [{ id: 'strike_ironclad' }]
        },
        {
            meta: { characterName: 'The Silent', ascension: 15, outcome: 'Defeat', floor: 33 },
            cards: [{ id: 'strike_silent' }]
        },
        {
            meta: { characterName: 'The Defect', ascension: 1, outcome: 'Victory', floor: 51 },
            cards: [{ id: 'strike_defect' }]
        },
        {
            meta: { characterName: 'The Ironclad & The Silent', ascension: 5, outcome: 'Victory', floor: 50 },
            players: [
                { characterName: 'The Ironclad', cards: [{ id: 'strike_ironclad' }], relics: [] },
                { characterName: 'The Silent', cards: [{ id: 'strike_silent' }], relics: [] }
            ]
        }
    ];

    it('renders empty state when no runs are provided', () => {
        const { container } = render(<GalleryWrapper runs={[]} onSelectRun={() => { }} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the given runs correctly', () => {
        render(<GalleryWrapper runs={mockRuns} onSelectRun={() => { }} />);
        expect(screen.getByRole('heading', { name: 'The Ironclad' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'The Silent' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'The Defect' })).toBeInTheDocument();
    });

    it('filters runs by character outcome', () => {
        render(<GalleryWrapper runs={mockRuns} onSelectRun={() => { }} />);

        // Change outcome filter to 'Victory'
        const outcomeSelect = screen.getAllByRole('combobox')[1];
        fireEvent.change(outcomeSelect, { target: { value: 'Victory' } });

        expect(screen.getByRole('heading', { name: 'The Ironclad' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'The Defect' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'The Silent' })).not.toBeInTheDocument();
    });

    it('filters runs by ascension', () => {
        render(<GalleryWrapper runs={mockRuns} onSelectRun={() => { }} />);

        // Change ascension filter to '20'
        const ascSelect = screen.getAllByRole('combobox')[2];
        fireEvent.change(ascSelect, { target: { value: '20' } });

        expect(screen.getByRole('heading', { name: 'The Ironclad' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'The Silent' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'The Defect' })).not.toBeInTheDocument();
    });

    it('calls onSelectRun when a tile is clicked', () => {
        const onSelectMock = vi.fn();
        render(<GalleryWrapper runs={mockRuns} onSelectRun={onSelectMock} />);

        const ironcladTile = screen.getByRole('heading', { name: 'The Ironclad' }).closest('.run-tile');
        fireEvent.click(ironcladTile!);

        // The Ironclad is at index 0
        expect(onSelectMock).toHaveBeenCalledWith(0);
    });

    it('filters multiplayer runs by individual character names', () => {
        render(<GalleryWrapper runs={mockRuns} onSelectRun={() => { }} />);

        // Change character filter to 'The Silent'
        const charSelect = screen.getAllByRole('combobox')[0];
        fireEvent.change(charSelect, { target: { value: 'The Silent' } });

        // Should show 'The Silent' (singleplayer) and 'The Ironclad & The Silent' (multiplayer)
        expect(screen.getByRole('heading', { name: 'The Silent' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'The Ironclad & The Silent' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'The Ironclad' })).not.toBeInTheDocument(); // Singleplayer Ironclad shouldn't match
    });

    it('filters runs by player count', async () => {
        render(<GalleryWrapper runs={mockRuns} onSelectRun={() => { }} />);

        const playerSelect = screen.getByLabelText('Players');
        fireEvent.change(playerSelect, { target: { value: '2' } });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'The Ironclad & The Silent' })).toBeInTheDocument();
        });

        expect(screen.queryByRole('heading', { name: 'The Ironclad' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'The Silent' })).not.toBeInTheDocument();
    });

    it('clears all filters when "Clear Filters" is clicked', () => {
        render(<GalleryWrapper runs={mockRuns} onSelectRun={() => { }} />);

        const outcomeSelect = screen.getAllByRole('combobox')[1];
        fireEvent.change(outcomeSelect, { target: { value: 'Victory' } });

        const clearButton = screen.getByRole('button', { name: 'Clear Filters' });
        fireEvent.click(clearButton);

        // All runs should be visible again
        expect(screen.getByRole('heading', { name: 'The Ironclad' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'The Silent' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'The Defect' })).toBeInTheDocument();
    });
});
