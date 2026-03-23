// ── Shared game constants ─────────────────────────────────────────────────────
// Used by StatsPage.tsx (stats computation) and Gallery.tsx (tile backgrounds)
// so that starter-card/relic filtering lives in one place.
// Sourced from each character's StartingDeck / StartingRelics definitions in the
// decompiled game source.

export const STARTER_CARD_IDS = new Set([
    // Generic fallbacks
    'strike', 'defend',
    // Ironclad: 5× strike, 4× defend, 1× bash
    'strike_ironclad', 'defend_ironclad', 'bash',
    // Silent: 5× strike, 5× defend, 1× neutralize, 1× survivor
    'strike_silent', 'defend_silent', 'neutralize', 'survivor',
    // Defect: 4× strike, 4× defend, 1× zap, 1× dualcast
    'strike_defect', 'defend_defect', 'zap', 'dualcast',
    // Necrobinder: 4× strike, 4× defend, 1× bodyguard, 1× unleash
    'strike_necrobinder', 'defend_necrobinder', 'bodyguard', 'unleash',
    // Regent: 4× strike, 4× defend, 1× falling_star, 1× venerate
    'strike_regent', 'defend_regent', 'falling_star', 'venerate',
]);

export const STARTER_RELIC_IDS = new Set([
    'burning_blood',      // Ironclad
    'ring_of_the_snake',  // Silent
    'cracked_core',       // Defect
    'bound_phylactery',   // Necrobinder
    'divine_right',       // Regent
]);
