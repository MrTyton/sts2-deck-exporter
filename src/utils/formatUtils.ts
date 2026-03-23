// ── Shared formatting helpers ─────────────────────────────────────────────────
// Used by both StatsPage.tsx (React UI) and statsImageExport.ts (canvas export)
// so that display formatting logic lives in one place.

/** Returns a percentage string, or '—' when the denominator is zero. */
export function pct(n: number, d: number): string {
    return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;
}

/** Formats a duration in seconds as "Xh Xm Xs" / "Xm Xs" / "Xs". */
export function formatSeconds(s: number): string {
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

/** Formats a long total duration as "Xh Xm" / "Xm" (drops seconds, suited for totals). */
export function formatTotalTime(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
