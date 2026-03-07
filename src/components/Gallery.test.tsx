import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, describe, it, vi } from 'vitest';
import { Gallery } from './Gallery';

const GalleryWrapper = (props: any) => {
    const [filters, setFilters] = useState({});
    return <Gallery {...props} filters={filters} onFilterChange={setFilters} />;
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
});
