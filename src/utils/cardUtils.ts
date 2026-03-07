/**
 * Formats a card ID into a displayable name.
 * Specifically strips character names from basic "Strike" and "Defend" cards.
 */
export function formatCardName(id: string): string {
    // Replace underscores with spaces
    let name = id.replace(/_/g, ' ');

    // Check if it's a basic Strike or Defend of a specific class
    // We only want to filter out if it's one of the 5 classes - ironclad, silent, defect, necrobinder, or regent.
    const lowerName = name.toLowerCase();
    const characterSuffixes = ['ironclad', 'silent', 'defect', 'necrobinder', 'regent'];

    if (lowerName.startsWith('strike ') || lowerName.startsWith('defend ')) {
        const parts = lowerName.split(' ');
        if (parts.length === 2 && characterSuffixes.includes(parts[1])) {
            // Return only the first word ("Strike" or "Defend")
            // Use the original name's capitalization for the first word
            return name.split(' ')[0];
        }
    }

    return name;
}
