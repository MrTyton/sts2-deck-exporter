import type { BrotliWasmType } from 'brotli-wasm';

// ── Brotli helpers (via brotli-wasm, quality 11) ─────────────────────────────
// Lazy-initialised so the WASM only loads when first used.

let _brotli: BrotliWasmType | null = null;

async function getBrotli(): Promise<BrotliWasmType> {
    if (_brotli) return _brotli;
    const mod = await import('brotli-wasm');
    // The Node.js build exposes the operations synchronously (mod.default is a
    // resolved Promise wrapping nodePkg, or Vite transforms the CJS default
    // export directly).  The web/ESM build exposes a real async Promise.
    // Handle both: if the resolved default looks like a thenable treat it as a
    // Promise; otherwise use it directly.
    const exported: unknown = mod.default ?? mod;
    _brotli = (
        exported !== null &&
        typeof exported === 'object' &&
        typeof (exported as PromiseLike<unknown>).then === 'function'
    )
        ? await (exported as Promise<BrotliWasmType>)
        : (exported as BrotliWasmType);
    return _brotli;
}

export async function compressBytesBrotli(data: Uint8Array): Promise<Uint8Array> {
    const brotli = await getBrotli();
    return brotli.compress(data, { quality: 11 });
}

export async function decompressBytesBrotli(data: Uint8Array): Promise<Uint8Array> {
    const brotli = await getBrotli();
    return brotli.decompress(data);
}

// ── Shared compression helpers (native browser CompressionStream / deflate-raw) ──

export async function compressBytes(data: Uint8Array): Promise<Uint8Array> {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    writer.write(new Uint8Array(ab));
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    for (; ;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
}

export async function decompressBytes(data: Uint8Array): Promise<Uint8Array> {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    // Suppress write-side rejections; errors surface through reader.read() below.
    writer.write(new Uint8Array(ab)).catch(() => { });
    writer.close().catch(() => { });
    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    for (; ;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
}
