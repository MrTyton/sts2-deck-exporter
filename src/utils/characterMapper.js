export function getCharacterName(id) {
    if (!id) return null;

    // Internal IDs are usually CHARACTER.SILENT, etc.
    const cleanId = id.replace('CHARACTER.', '').toUpperCase();

    const mapping = {
        'SILENT': 'The Silent',
        'IRONCLAD': 'The Ironclad',
        'DEFECT': 'The Defect',
        'NECROBINDER': 'The Necrobinder',
        'REGENT': 'The Regent',
        'WATCHER': 'The Watcher' // Included just in case
    };

    return mapping[cleanId] || cleanId;
}
