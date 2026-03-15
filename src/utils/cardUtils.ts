import type { CardData } from '../types';

/**
 * Formats a card ID into a displayable name.
 * Specifically strips character names from basic "Strike" and "Defend" cards.
 * Now also ensures Title Case (e.g., "Body Slam").
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
            // Return only the first word capitalized ("Strike" or "Defend")
            const firstWord = parts[0];
            return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
        }
    }

    // Convert to Title Case
    return name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Returns the portrait filename stem (without extension) for a card.
 * For variant cards like Mad Science the portrait differs per instance,
 * so `portraitId` may be set to e.g. 'mad_science_attack'.
 * Falls back to `card.id` for all normal cards.
 */
export function getCardPortraitId(card: CardData): string {
    return card.portraitId ?? card.id;
}
