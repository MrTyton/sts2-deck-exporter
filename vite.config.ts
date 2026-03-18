import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/sts2-deck-exporter/',
    plugins: [react()],
    build: {
        target: 'esnext',
        cssMinify: true
    },
    esbuild: {
        drop: ['console', 'debugger']
    },
    optimizeDeps: {
        // brotli-wasm loads its WASM via `new URL('...bg.wasm', import.meta.url)`.
        // If esbuild pre-bundles it, import.meta.url shifts to .vite/deps/ and the
        // relative WASM path breaks.  Excluding it lets Vite serve the module directly
        // from node_modules where the .wasm file sits in the right relative position.
        exclude: ['brotli-wasm'],
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './setupTests.ts',
        alias: {
            // brotli-wasm's web ESM bundle tries to fetch() a .wasm file, which
            // fails in the vitest / Node.js environment.  Point tests at the
            // synchronous Node.js CJS build instead — same API, no WASM fetch.
            'brotli-wasm': resolve('./node_modules/brotli-wasm/index.node.js'),
        },
    }
})
