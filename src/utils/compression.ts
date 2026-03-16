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
    for (;;) {
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
    writer.write(new Uint8Array(ab)).catch(() => {});
    writer.close().catch(() => {});
    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    for (;;) {
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
