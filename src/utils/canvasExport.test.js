import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    let originalCreateElement;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock document.createElement('canvas')
        originalCreateElement = document.createElement;
        document.createElement = vi.fn((tagName) => {
            if (tagName === 'canvas') {
                const mockCtx = new MockContext2D();
                return {
                    getContext: vi.fn(() => mockCtx),
                    width: 0,
                    height: 0,
                    toDataURL: vi.fn(),
                };
            }
            return originalCreateElement.call(document, tagName);
        });

        // Mock global Image to simulate immediate load
        global.Image = class {
            constructor() {
                setTimeout(() => {
                    if (this.src.includes('error')) {
                        if (this.onerror) this.onerror(new Error('img error'));
                    } else {
                        if (this.onload) this.onload();
                    }
                }, 0);
            }
        };
    });

    afterEach(() => {
        document.createElement = originalCreateElement;
    });

    it('generates a canvas with correct dimensions when no relics are provided', async () => {
        const cards = [{ id: 'strike', count: 1 }];
        const meta = { characterName: 'Test', ascension: 1, outcome: 'Victory', floor: 50, relics: [] };

        const canvas = await generateDeckImage(cards, meta);

        expect(canvas.width).toBe(1080);
        expect(canvas.height).toBe(1300);
    });

    it('handles image loading errors gracefully', async () => {
        const cards = [{ id: 'error_card', count: 1 }];
        const meta = null;

        const canvas = await generateDeckImage(cards, meta);
        const ctx = canvas.getContext('2d');

        // When image fails, it should draw a fallback rectangle
        expect(ctx.fillRect).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalledWith('Image Missing', expect.any(Number), expect.any(Number));
    });

    it('sorts cards by count descending', async () => {
        const cards = [
            { id: 'b', count: 1 },
            { id: 'a', count: 3 },
            { id: 'c', count: 2 }
        ];

        const canvas = await generateDeckImage(cards, null);
        const ctx = canvas.getContext('2d');

        // We know it draws text for card names. So the first card drawn should be 'a'.
        // Let's verify measureText or fillText was called with 'A'.
        const calls = ctx.fillText.mock.calls.map(call => call[0]);
        const textDraws = calls.filter(t => typeof t === 'string' && ['A', 'C', 'B'].includes(t));

        expect(textDraws).toEqual(['A', 'C', 'B']);
    });

    it('displays the correct number of total cards', async () => {
        const cards = [{ id: 'strike', count: 5 }, { id: 'defend', count: 5 }];
        const canvas = await generateDeckImage(cards, null);
        const ctx = canvas.getContext('2d');

        expect(ctx.fillText).toHaveBeenCalledWith('10 cards total', 60, 180);
    });
});
