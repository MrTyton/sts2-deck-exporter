export function parseDeckArray(rawDeckArray) {
    // rawDeckArray looks like: [{ id: "CARD.STRIKE_SILENT", floor_added_to_deck: 1 }, ...]
    const cardCounts = {};
    const cards = [];

    rawDeckArray.forEach(cardData => {
        let id = cardData.id;
        // Strip "CARD." prefix if it exists
        if (id.startsWith("CARD.")) {
            id = id.substring(5);
        }

        // Convert to lowercase to match our extracted image files
        id = id.toLowerCase();

        // Check for upgrades
        const upgrades = cardData.current_upgrade_level || cardData.upgrades || 0;

        // Check for enchantments
        const enchantment = cardData.enchantment ? cardData.enchantment.id.replace("ENCHANTMENT.", "") : cardData.enchantmentId || null;

        const uniqueKey = `${id}_${upgrades}_${enchantment || 'none'}`;

        if (cardCounts[uniqueKey]) {
            cardCounts[uniqueKey].count += 1;
        } else {
            const newCard = {
                id: id,
                count: 1,
                upgraded: upgrades > 0 || id.includes('+'),
                upgrades: upgrades,
                enchantment: enchantment
            };
            cardCounts[uniqueKey] = newCard;
            cards.push(newCard);
        }
    });

    // Sort by count (descending), then alphabetically by ID
    cards.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.id.localeCompare(b.id);
    });

    return cards;
}
