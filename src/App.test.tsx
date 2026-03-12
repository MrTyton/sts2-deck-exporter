import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, describe, it, vi, beforeEach } from 'vitest';
import App from './App';
import { encodeRun } from './utils/deckEncoder';

// Mock dynamic import for lz-string
vi.mock('lz-string', () => ({
    default: {
        decompressFromEncodedURIComponent: vi.fn(),
    },
}));

describe('App Component Persistence & Duplicates', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        // Reset URL hash
        window.location.hash = '';
    });

    it('loads saved runs from localStorage on mount', async () => {
        const sampleRun = {
            players: [{ characterName: 'Ironclad', cards: [], relics: [] }],
            meta: { characterName: 'Ironclad', ascension: 0, floor: 1, outcome: 'Victory' }
        };
        const uid = encodeRun(sampleRun);
        localStorage.setItem('sts2_exported_runs', JSON.stringify([uid]));

        render(<App />);

        await waitFor(() => {
            // The character name is displayed in the Gallery
            // Note: combinedNames = "Ironclad" for this run
            expect(screen.getAllByText(/Ironclad/i).length).toBeGreaterThan(0);
        });
    });

    it('prevents adding duplicate runs on upload', async () => {
        const validJson = {
            players: [
                { character: "IRONCLAD", deck: [{ id: "STRIKE" }], relics: [] }
            ],
            win: true,
            ascension: 0,
            run_time: 100
        };

        const { container } = render(<App />);
        const input = container.querySelector('#file-upload');

        // Upload once
        const file1 = new File([JSON.stringify(validJson)], 'run1.run', { type: 'application/json' });
        fireEvent.change(input!, { target: { files: [file1] } });

        await waitFor(() => {
            expect(screen.getByText('Clear All Runs')).toBeInTheDocument();
        });

        const initialSaved = JSON.parse(localStorage.getItem('sts2_exported_runs') || '[]');
        expect(initialSaved.length).toBe(1);

        // Upload again (same content)
        const file2 = new File([JSON.stringify(validJson)], 'run2.run', { type: 'application/json' });
        fireEvent.change(input!, { target: { files: [file2] } });

        // Wait a bit to ensure async processing would have finished
        await new Promise(resolve => setTimeout(resolve, 100));

        // localStorage should still only have 1 entry
        const saved = JSON.parse(localStorage.getItem('sts2_exported_runs') || '[]');
        expect(saved.length).toBe(1);
    });

    it('clears localStorage when "Clear All Runs" is clicked', async () => {
        const sampleRun = {
            players: [{ characterName: 'Ironclad', cards: [], relics: [] }],
            meta: { characterName: 'Ironclad', ascension: 0, floor: 1, outcome: 'Victory' }
        };
        const uid = encodeRun(sampleRun);
        localStorage.setItem('sts2_exported_runs', JSON.stringify([uid]));

        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Clear All Runs')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Clear All Runs'));

        expect(localStorage.getItem('sts2_exported_runs')).toBeNull();
        await waitFor(() => {
            expect(screen.queryByText('Clear All Runs')).not.toBeInTheDocument();
            // Should be back to the initial broad uploader
            expect(screen.getByText('Drop Save/Run Files Here')).toBeInTheDocument();
        });
    });

    it('renders the uploader in the gallery view after files are loaded', async () => {
        const validJson = {
            players: [{ character: "IRONCLAD", deck: [], relics: [] }],
            win: true,
            ascension: 0,
            run_time: 100
        };

        const { container } = render(<App />);
        const input = container.querySelector('#file-upload');

        // Upload once
        const file = new File([JSON.stringify(validJson)], 'run1.run', { type: 'application/json' });
        fireEvent.change(input!, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByText('Clear All Runs')).toBeInTheDocument();
        });

        // Verify uploader is still there (now in its compact form)
        expect(screen.getByText('Upload More Runs')).toBeInTheDocument();
        // The old large header should NOT be there
        expect(screen.queryByText('Drop Save/Run Files Here')).not.toBeInTheDocument();
    });
});
