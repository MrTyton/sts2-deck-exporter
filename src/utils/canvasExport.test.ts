import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateDeckImage } from './canvasExport';

// Mock canvas API
class MockContext2D {
    fillRect = vi.fn();
    fillText = vi.fn();
    drawImage = vi.fn();
    createLinearGradient = vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
    });
    strokeRect = vi.fn();
    beginPath = vi.fn();
    roundRect = vi.fn();
    fill = vi.fn();
    stroke = vi.fn();
    measureText = vi.fn().mockReturnValue({ width: 50 });
}

describe('generateDeckImage', () => {
    let originalCreateElement: typeof document.createElement;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock document.createElement('canvas')
        originalCreateElement = document.createElement;
        document.createElement = vi.fn((tagName) => {
            if (tagName === 'canvas') {
                const mockCtx = new MockContext2D();
                return {
                    getContext: vi.fn(() => mockCtx as any),
                    width: 0,
                    height: 0,
                    toDataURL: vi.fn(),
                } as any;
            }
            return originalCreateElement.call(document, tagName);
        });

        // Mock global Image to simulate immediate load
        vi.stubGlobal('Image', class {
            src: string = '';
            onload?: () => void;
            onerror?: (e: Error) => void;
            constructor() {
                setTimeout(() => {
                    if (this.src.includes('error')) {
                        if (this.onerror) this.onerror(new Error('img error'));
                    } else {
                        if (this.onload) this.onload();
                    }
                }, 0);
            }
        });
    });

    afterEach(() => {
        document.createElement = originalCreateElement;
    });

    it('generates a canvas with correct dimensions when no relics are provided', async () => {
        const cards = [{ id: 'strike', count: 1 }] as any;
        const meta = { characterName: 'Test', ascension: 1, outcome: 'Victory', floor: 50, relics: [] };

        const canvas = await generateDeckImage({ cards, meta });

        expect(canvas.width).toBe(1080);
        expect(canvas.height).toBe(1320);
    });

    it('handles image loading errors gracefully', async () => {
        const cards = [{ id: 'error_card', count: 1 }] as any;

        const canvas = await generateDeckImage({ cards });
        const ctx: any = canvas.getContext('2d');

        // When image fails, it should draw a fallback rectangle
        expect(ctx.fillRect).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalledWith('Image Missing', expect.any(Number), expect.any(Number));
    });

    it('sorts cards by count descending', async () => {
        const cards = [
            { id: 'b', count: 1 },
            { id: 'a', count: 3 },
            { id: 'c', count: 2 }
        ] as any;

        const canvas = await generateDeckImage({ cards });
        const ctx: any = canvas.getContext('2d');

        // We know it draws text for card names. So the first card drawn should be 'a'.
        // Let's verify measureText or fillText was called with 'A'.
        const calls = ctx.fillText.mock.calls.map((call: any[]) => call[0]);
        const textDraws = calls.filter((t: any) => typeof t === 'string' && ['A', 'C', 'B'].includes(t));

        expect(textDraws).toEqual(['A', 'C', 'B']);
    });

    it('displays the correct number of total cards', async () => {
        const cards = [{ id: 'strike', count: 5 }, { id: 'defend', count: 5 }] as any;
        const canvas = await generateDeckImage({ cards });
        const ctx: any = canvas.getContext('2d');

        expect(ctx.fillText).toHaveBeenCalledWith('10 cards', 60, 210);
    });

    it('includes patch badge text when buildId is provided', async () => {
        const cards = [{ id: 'strike', count: 1 }] as any;
        const meta = { characterName: 'Test', ascension: 1, outcome: 'Victory', floor: 50, relics: [], buildId: 'v0.99.1' };

        const canvas = await generateDeckImage({ cards, meta });
        const ctx: any = canvas.getContext('2d');

        // Badge text is split into parts for bold rendering; "Patch v" is the non-digit prefix
        const calls = ctx.fillText.mock.calls.map((call: any[]) => call[0] as string);
        expect(calls.some((t: string) => t === 'Patch v')).toBe(true);
    });

    it('does not include patch badge text when buildId is absent', async () => {
        const cards = [{ id: 'strike', count: 1 }] as any;
        const meta = { characterName: 'Test', ascension: 1, outcome: 'Victory', floor: 50, relics: [] };

        const canvas = await generateDeckImage({ cards, meta });
        const ctx: any = canvas.getContext('2d');

        const calls = ctx.fillText.mock.calls.map((call: any[]) => call[0] as string);
        expect(calls.some((t: string) => typeof t === 'string' && t.startsWith('Patch'))).toBe(false);
    });

    it('wraps multiplayer character names if they are too long', async () => {
        const cards = [{ id: 'strike', count: 1 }] as any;
        const meta = {
            characterName: 'The Defect & The Necrobinder & The Silent & The Ironclad',
            ascension: 1,
            outcome: 'Victory',
            floor: 50
        };

        const mockCtx = new MockContext2D();
        // Mock measureText to return a large width to trigger wrapping
        // availableWidth is 960 (1080 - 120)
        mockCtx.measureText = vi.fn().mockReturnValue({ width: 1000 });

        const originalCreateElement = document.createElement;
        document.createElement = vi.fn((tagName) => {
            if (tagName === 'canvas') {
                return {
                    getContext: vi.fn(() => mockCtx as any),
                    width: 0,
                    height: 0,
                    toDataURL: vi.fn(),
                } as any;
            }
            return originalCreateElement.call(document, tagName);
        });

        await generateDeckImage({ cards, meta });

        expect(mockCtx.fillText).toHaveBeenCalledWith('The Defect &', 60, 120);
        expect(mockCtx.fillText).toHaveBeenCalledWith('The Necrobinder &', 60, 200);
        expect(mockCtx.fillText).toHaveBeenCalledWith('The Silent &', 60, 280);
        expect(mockCtx.fillText).toHaveBeenCalledWith('The Ironclad', 60, 360);

        document.createElement = originalCreateElement;
    });
});
