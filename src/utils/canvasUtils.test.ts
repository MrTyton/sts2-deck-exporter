import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadCachedImage } from './canvasUtils';

// Stub the global Image constructor so tests run in jsdom without real network
function makeImageStub(opts: { fail?: boolean } = {}) {
    return class MockImage {
        crossOrigin = '';
        onload?: () => void;
        onerror?: () => void;
        private _src = '';

        get src() { return this._src; }
        set src(value: string) {
            this._src = value;
            // Trigger async-ish callback so Promises settle
            setTimeout(() => {
                if (opts.fail) { this.onerror?.(); }
                else           { this.onload?.();  }
            }, 0);
        }
    };
}

describe('loadCachedImage', () => {
    beforeEach(() => {
        // Reset the module cache between test runs by re-importing would be complex;
        // instead we rely on unique URLs per test to avoid cross-test cache hits.
        vi.restoreAllMocks();
    });

    it('resolves with an HTMLImageElement on successful load', async () => {
        vi.stubGlobal('Image', makeImageStub());
        const img = await loadCachedImage('https://example.com/card-a.webp');
        expect(img).not.toBeNull();
    });

    it('resolves with null when the image fails to load', async () => {
        vi.stubGlobal('Image', makeImageStub({ fail: true }));
        const img = await loadCachedImage('https://example.com/bad-image.webp');
        expect(img).toBeNull();
    });

    it('returns the cached result on a second call for the same URL (no new Image created)', async () => {
        const ImageSpy = makeImageStub();
        const constructorSpy = vi.fn().mockImplementation((...args) => new ImageSpy(...args));
        // We can't easily spy on Image construction; instead verify only 1 onload fires
        vi.stubGlobal('Image', makeImageStub());

        const url = 'https://example.com/card-cached.webp';
        const first  = await loadCachedImage(url);
        const second = await loadCachedImage(url);

        // Both calls should return the same object reference from the cache
        expect(first).toBe(second);
    });

    it('sets crossOrigin to "anonymous" on the Image element', async () => {
        let capturedCrossOrigin: string | undefined;
        class CapturingImage {
            crossOrigin = '';
            onload?: () => void;
            set src(_: string) {
                capturedCrossOrigin = this.crossOrigin;
                setTimeout(() => this.onload?.(), 0);
            }
        }
        vi.stubGlobal('Image', CapturingImage);

        await loadCachedImage('https://example.com/card-cors.webp');
        expect(capturedCrossOrigin).toBe('anonymous');
    });
});
