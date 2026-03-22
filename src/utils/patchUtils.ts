/**
 * patchUtils.ts
 *
 * Provides patch-aware overrides for card values and localization text.
 *
 * How it works:
 * - cardValues.json and gameData.json always reflect the CURRENT (latest) patch.
 * - patchList.json is an ordered array of known patch version strings; the last
 *   entry is always the current patch.
 * - patchDeltas.json stores ONLY the fields that differ from the current patch
 *   for each older patch index. Each key is the patchIndex (as a string) whose
 *   data differs from today's baseline.
 *
 * Usage:
 *   const cvDelta  = getCardValueDelta('BASH', patchIndex);
 *   const textDelta = getTextOverride('cards', 'bash.description', patchIndex);
 *
 * To add a new patch:
 *   1. Append the new patch version string to src/data/patchList.json.
 *   2. Re-run the extraction scripts to update cardValues.json / gameData.json.
 *   3. Diff the old extraction outputs against the new ones and populate
 *      patchDeltas.json with the old values under the relevant patch index.
 */

import rawPatchList from '../data/patchList.json';
import rawPatchDeltas from '../data/patchDeltas.json';

/** Ordered list of known game patch version strings. Index = patchIndex in the encoder. */
export const PATCH_LIST: string[] = rawPatchList as string[];

/** The patchIndex that corresponds to the current (latest) patch. */
export const CURRENT_PATCH_INDEX = PATCH_LIST.length - 1;

// ── Internal delta structure ─────────────────────────────────────────────────

interface PatchDeltaEntry {
    /** Partial overrides for cardValues.json entries (card/relic/enchantment). */
    cardValues?: Record<string, Record<string, unknown>>;
    /** Overrides for gameData string keys (same structure as gameData.json). */
    gameData?: {
        cards?: Record<string, string>;
        relics?: Record<string, string>;
        enchantments?: Record<string, string>;
        keywords?: Record<string, string>;
    };
}

const patchDeltas: Record<string, PatchDeltaEntry> =
    (rawPatchDeltas as { patchData: Record<string, PatchDeltaEntry> }).patchData ?? {};

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Returns the cardValues override for `cardKey` (UPPERCASE) at `patchIndex`,
 * or null if there is no delta for that card at that patch.
 *
 * The returned object is a partial record; callers merge it over the current
 * cardValues entry using their own knowledge of the field shapes.
 */
export function getCardValueDelta(
    cardKey: string,
    patchIndex: number | undefined,
): Record<string, unknown> | null {
    if (patchIndex === undefined || patchIndex >= CURRENT_PATCH_INDEX) return null;
    const delta = patchDeltas[String(patchIndex)];
    if (!delta?.cardValues) return null;
    return delta.cardValues[cardKey] ?? null;
}

/**
 * Returns the localization string override for a specific key at `patchIndex`,
 * or null if there is no delta.
 *
 * @param category  'cards' | 'relics' | 'enchantments' | 'keywords'
 * @param key       The full dot-key, e.g. 'bash.description' or 'bash.title'
 */
export function getTextOverride(
    category: 'cards' | 'relics' | 'enchantments' | 'keywords',
    key: string,
    patchIndex: number | undefined,
): string | null {
    if (patchIndex === undefined || patchIndex >= CURRENT_PATCH_INDEX) return null;
    const delta = patchDeltas[String(patchIndex)];
    if (!delta?.gameData) return null;
    return (delta.gameData[category] as Record<string, string> | undefined)?.[key] ?? null;
}

/**
 * Resolves a build_id string (e.g. "v0.99.1") to its patchIndex.
 * Returns CURRENT_PATCH_INDEX if the build_id is unknown or undefined.
 */
export function buildIdToPatchIndex(buildId: string | undefined): number {
    if (!buildId) return CURRENT_PATCH_INDEX;
    const idx = PATCH_LIST.indexOf(buildId);
    return idx >= 0 ? idx : CURRENT_PATCH_INDEX;
}
