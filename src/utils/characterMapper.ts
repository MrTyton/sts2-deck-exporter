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
