import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

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
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './setupTests.ts',
    }
})
