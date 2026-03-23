// ── Character icon helpers ────────────────────────────────────────────────────
// Used by StatsPage.tsx (React UI) and statsImageExport.ts (canvas export)
// so that adding a new playable character only requires updating this one map.

export const CHARACTER_ICONS: Record<string, string> = {
    'The Ironclad':    'char_select_ironclad.webp',
    'The Silent':      'char_select_silent.webp',
    'The Defect':      'char_select_defect.webp',
    'The Necrobinder': 'char_select_necrobinder.webp',
    'The Regent':      'char_select_regent.webp',
};

export function charIconUrl(name: string): string | null {
    const file = CHARACTER_ICONS[name];
    return file ? `${import.meta.env.BASE_URL}assets/characters/${file}` : null;
}

export function getCharacterName(id: string | null | undefined): string | null {
    if (!id) return null;

    // 1. Normalize for mapping: remove prefix and uppercase
    const cleanId = id.replace('CHARACTER.', '').toUpperCase();

    const mapping: Record<string, string> = {
        'SILENT': 'The Silent',
        'IRONCLAD': 'The Ironclad',
        'DEFECT': 'The Defect',
        'NECROBINDER': 'The Necrobinder',
        'REGENT': 'The Regent',
        'WATCHER': 'The Watcher'
    };

    // 2. Check direct mapping
    if (mapping[cleanId]) return mapping[cleanId];

    // 3. Fallback: If it's already a values of the mapping (case-insensitive check)
    const knownNames = Object.values(mapping);
    const existingMatch = knownNames.find(name => name.toUpperCase() === cleanId);
    if (existingMatch) return existingMatch;

    return mapping[cleanId] || id; // Return original ID if no match found
}
