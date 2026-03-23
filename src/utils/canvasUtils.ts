// ── Shared canvas utilities ───────────────────────────────────────────────────
// Used by both canvasExport.ts (deck image) and statsImageExport.ts (stats image)
// so that asset loading logic lives in one place.

const imageCache = new Map<string, HTMLImageElement | null>();

/** Loads an image by URL, caching the result so subsequent calls are instant. */
export function loadCachedImage(src: string): Promise<HTMLImageElement | null> {
    if (imageCache.has(src)) return Promise.resolve(imageCache.get(src) ?? null);
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload  = () => { imageCache.set(src, img);  resolve(img);  };
        img.onerror = () => { imageCache.set(src, null); resolve(null); };
        img.src = src;
    });
}
