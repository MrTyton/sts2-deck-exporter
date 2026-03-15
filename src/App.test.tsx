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

// ─── Helper: upload one run file ──────────────────────────────────────────────

async function uploadRun(container: HTMLElement, json: object) {
    const input = container.querySelector('#file-upload')!;
    const file = new File([JSON.stringify(json)], 'test.run', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
        expect(screen.getByText('Clear All Runs')).toBeInTheDocument();
    });
}

const singlePlayerJson = {
    players: [{ character: 'IRONCLAD', deck: [{ id: 'ANGER' }], relics: [] }],
    win: true,
    ascension: 20,
    run_time: 3661,
};

// ─── Info modal ───────────────────────────────────────────────────────────────

describe('App Component – Info Modal', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        window.location.hash = '';
    });

    it('info modal is hidden on mount', () => {
        render(<App />);
        expect(screen.queryByText('How to Use')).not.toBeInTheDocument();
    });

    it('opens the info modal when the "i" button is clicked', () => {
        render(<App />);
        fireEvent.click(screen.getByTitle('Information & Disclaimer'));
        expect(screen.getByText('How to Use')).toBeInTheDocument();
    });

    it('closes the info modal when the "×" close button is clicked', async () => {
        render(<App />);
        fireEvent.click(screen.getByTitle('Information & Disclaimer'));
        expect(screen.getByText('How to Use')).toBeInTheDocument();
        fireEvent.click(screen.getByText('×'));
        await waitFor(() => {
            expect(screen.queryByText('How to Use')).not.toBeInTheDocument();
        });
    });

    it('closes the info modal when the overlay backdrop is clicked', async () => {
        render(<App />);
        fireEvent.click(screen.getByTitle('Information & Disclaimer'));
        const overlay = document.querySelector('.modal-overlay')!;
        fireEvent.click(overlay);
        await waitFor(() => {
            expect(screen.queryByText('How to Use')).not.toBeInTheDocument();
        });
    });

    it('modal stopPropagation prevents close when clicking inside the modal content', () => {
        render(<App />);
        fireEvent.click(screen.getByTitle('Information & Disclaimer'));
        const modalContent = document.querySelector('.modal-content')!;
        // Click inside the modal – it should remain open
        fireEvent.click(modalContent);
        expect(screen.getByText('How to Use')).toBeInTheDocument();
    });

    it('info modal contains the Windows save path hint', () => {
        render(<App />);
        fireEvent.click(screen.getByTitle('Information & Disclaimer'));
        expect(screen.getByText(/Windows/)).toBeInTheDocument();
        expect(screen.getByText(/AppData/)).toBeInTheDocument();
    });
});

// ─── Tab switching ────────────────────────────────────────────────────────────

describe('App Component – Gallery / Stats tabs', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        window.location.hash = '';
    });

    it('shows gallery tab active by default after upload', async () => {
        const { container } = render(<App />);
        await uploadRun(container, singlePlayerJson);
        // The Gallery component should be visible; StatsPage should not
        expect(screen.queryByText('Total Runs')).not.toBeInTheDocument();
    });

    it('switches to Stats tab and shows stats content', async () => {
        const { container } = render(<App />);
        await uploadRun(container, singlePlayerJson);
        fireEvent.click(screen.getByRole('button', { name: 'stats' }));
        await waitFor(() => {
            expect(screen.getByText('Total Runs')).toBeInTheDocument();
        });
    });

    it('switches back to Gallery from Stats tab', async () => {
        const { container } = render(<App />);
        await uploadRun(container, singlePlayerJson);
        fireEvent.click(screen.getByRole('button', { name: 'stats' }));
        await waitFor(() => expect(screen.getByText('Total Runs')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'gallery' }));
        await waitFor(() => {
            expect(screen.queryByText('Total Runs')).not.toBeInTheDocument();
        });
    });

    it('stats page shows "1" as total run count after one upload', async () => {
        const { container } = render(<App />);
        await uploadRun(container, singlePlayerJson);
        fireEvent.click(screen.getByRole('button', { name: 'stats' }));
        await waitFor(() => expect(screen.getByText('Total Runs')).toBeInTheDocument());
        // '1' appears multiple times (total runs, victories, table cells) — just confirm it's present
        expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    });
});

// ─── URL hash loading ─────────────────────────────────────────────────────────

describe('App Component – URL hash loading', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        window.location.hash = '';
    });

    it('loads a run from #d= hash on mount and shows DeckVisualizer', async () => {
        const sampleRun = {
            players: [{ characterName: 'The Ironclad', cards: [], relics: [] }],
            meta: { characterName: 'The Ironclad', ascension: 5, floor: 45, outcome: 'Victory' },
        };
        const uid = encodeRun(sampleRun);
        window.location.hash = `#d=${uid}`;

        render(<App />);

        await waitFor(() => {
            expect(screen.getAllByText(/The Ironclad/).length).toBeGreaterThan(0);
        });
    });

    it('does NOT show "← Back to Gallery" when loaded from #d= URL (shared view)', async () => {
        const sampleRun = {
            players: [{ characterName: 'The Ironclad', cards: [], relics: [] }],
            meta: { characterName: 'The Ironclad', ascension: 0, floor: 1, outcome: 'Victory' },
        };
        const uid = encodeRun(sampleRun);
        window.location.hash = `#d=${uid}`;

        render(<App />);

        await waitFor(() =>
            expect(screen.getAllByText(/The Ironclad/).length).toBeGreaterThan(0)
        );
        expect(screen.queryByText('← Back to Gallery')).not.toBeInTheDocument();
    });

    it('ignores a malformed #d= hash gracefully', async () => {
        window.location.hash = '#d=this_is_not_valid_base64_data!!!';
        render(<App />);
        // Should fall back to the file uploader without crashing
        await waitFor(() => {
            expect(screen.getByText('Drop Save/Run Files Here')).toBeInTheDocument();
        });
    });
});

// ─── Back to Gallery button ───────────────────────────────────────────────────

describe('App Component – Back to Gallery', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        window.location.hash = '';
    });

    it('shows "← Back to Gallery" when a run tile is clicked from gallery', async () => {
        const { container } = render(<App />);
        await uploadRun(container, singlePlayerJson);

        // Click the first run tile in the gallery
        const tile = document.querySelector('.run-tile')!;
        fireEvent.click(tile);

        await waitFor(() => {
            expect(screen.getByText('← Back to Gallery')).toBeInTheDocument();
        });
    });

    it('"← Back to Gallery" navigates back to the gallery', async () => {
        const { container } = render(<App />);
        await uploadRun(container, singlePlayerJson);

        const tile = document.querySelector('.run-tile')!;
        fireEvent.click(tile);

        await waitFor(() =>
            expect(screen.getByText('← Back to Gallery')).toBeInTheDocument()
        );

        fireEvent.click(screen.getByText('← Back to Gallery'));

        await waitFor(() => {
            expect(screen.queryByText('← Back to Gallery')).not.toBeInTheDocument();
            expect(screen.getByText('Clear All Runs')).toBeInTheDocument();
        });
    });
});

// ─── Browser history / back button ───────────────────────────────────────────

describe('App Component – Browser History (back button)', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        window.location.hash = '';
    });

    it('calls pushState when the user selects a run from the gallery', async () => {
        const pushSpy = vi.spyOn(window.history, 'pushState');
        const { container } = render(<App />);
        await uploadRun(container, singlePlayerJson);

        const tile = document.querySelector('.run-tile')!;
        fireEvent.click(tile);

        await waitFor(() =>
            expect(screen.getByText('← Back to Gallery')).toBeInTheDocument()
        );

        expect(pushSpy).toHaveBeenCalledWith(null, '', expect.stringMatching(/^#d=/));
        pushSpy.mockRestore();
    });

    it('does NOT call pushState when the run is loaded from a shared #d= URL', async () => {
        const sampleRun = {
            players: [{ characterName: 'The Ironclad', cards: [], relics: [] }],
            meta: { characterName: 'The Ironclad', ascension: 0, floor: 1, outcome: 'Victory' },
        };
        const uid = encodeRun(sampleRun);
        window.location.hash = `#d=${uid}`;

        const pushSpy = vi.spyOn(window.history, 'pushState');
        render(<App />);

        await waitFor(() =>
            expect(screen.getAllByText(/The Ironclad/).length).toBeGreaterThan(0)
        );

        expect(pushSpy).not.toHaveBeenCalledWith(null, '', expect.stringMatching(/^#d=/));
        pushSpy.mockRestore();
    });

    it('popstate event with no #d= hash returns to the gallery', async () => {
        const { container } = render(<App />);
        await uploadRun(container, singlePlayerJson);

        // Navigate into a run
        const tile = document.querySelector('.run-tile')!;
        fireEvent.click(tile);
        await waitFor(() =>
            expect(screen.getByText('← Back to Gallery')).toBeInTheDocument()
        );

        // Simulate the browser restoring the previous URL and firing popstate
        window.location.hash = '';
        window.dispatchEvent(new PopStateEvent('popstate'));

        await waitFor(() => {
            expect(screen.queryByText('← Back to Gallery')).not.toBeInTheDocument();
            expect(screen.getByText('Clear All Runs')).toBeInTheDocument();
        });
    });

    it('popstate event with a #d= hash keeps the run view open', async () => {
        const sampleRun = {
            players: [{ characterName: 'The Ironclad', cards: [], relics: [] }],
            meta: { characterName: 'The Ironclad', ascension: 0, floor: 1, outcome: 'Victory' },
        };
        const uid = encodeRun(sampleRun);

        const { container } = render(<App />);
        await uploadRun(container, singlePlayerJson);

        // Navigate into a run
        const tile = document.querySelector('.run-tile')!;
        fireEvent.click(tile);
        await waitFor(() =>
            expect(screen.getByText('← Back to Gallery')).toBeInTheDocument()
        );

        // Simulate forward navigation: URL still has a #d= hash
        window.location.hash = `#d=${uid}`;
        window.dispatchEvent(new PopStateEvent('popstate'));

        // Run view should remain
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(screen.getByText('← Back to Gallery')).toBeInTheDocument();
    });
});

