import type { CardData, PlayerRunData, RawCardData, RunData } from '../types';

export function parseDeckArray(rawDeckArray: RawCardData[]): CardData[] {
    // rawDeckArray looks like: [{ id: "CARD.STRIKE_SILENT", floor_added_to_deck: 1 }, ...]
    const cardCounts: Record<string, CardData> = {};
    const cards: CardData[] = [];

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
        let enchantment = cardData.enchantment ? cardData.enchantment.id : (cardData.enchantmentId || null);
        const enchantmentAmount: number | undefined = cardData.enchantment?.amount;
        if (enchantment && enchantment.startsWith("ENCHANTMENT.")) {
            enchantment = enchantment.substring(12);
        }

        // Resolve variant portrait and card type for cards with runtime-chosen types.
        // Mad Science (from the Tinker Time event) stores its chosen type in TinkerTimeType:
        //   1 = Attack, 2 = Skill, 3 = Power
        let portraitId: string | undefined;
        let cardType: string | undefined;
        let tinkerTimeRider: string | undefined;
        if (id === 'mad_science') {
            const tinkType = cardData.props?.ints?.find(p => p.name === 'TinkerTimeType')?.value ?? 1;
            const variantMap: Record<number, { portraitId: string; cardType: string }> = {
                1: { portraitId: 'mad_science_attack', cardType: 'Attack' },
                2: { portraitId: 'mad_science_skill',  cardType: 'Skill'  },
                3: { portraitId: 'mad_science_power',  cardType: 'Power'  },
            };
            const resolved = variantMap[tinkType] ?? variantMap[1];
            portraitId = resolved.portraitId;
            cardType   = resolved.cardType;
            // TinkerTimeRider enum: 0=None,1=Sapping,2=Violence,3=Choking,4=Energized,
            //                       5=Wisdom,6=Chaos,7=Expertise,8=Curious,9=Improvement
            const riderEnumNames: Record<number, string> = {
                1: 'sapping', 2: 'violence', 3: 'choking', 4: 'energized',
                5: 'wisdom',  6: 'chaos',    7: 'expertise', 8: 'curious', 9: 'improvement',
            };
            const riderVal = cardData.props?.ints?.find(p => p.name === 'TinkerTimeRider')?.value ?? 0;
            tinkerTimeRider = riderEnumNames[riderVal];
        }

        const uniqueKey = `${id}_${upgrades}_${enchantment || 'none'}_${portraitId || 'none'}`;
        const countToAdd = cardData.count || 1;

        if (cardCounts[uniqueKey]) {
            cardCounts[uniqueKey].count += countToAdd;
        } else {
            const newCard: CardData = {
                id: id,
                count: countToAdd,
                upgraded: upgrades > 0 || id.includes('+'),
                upgrades: upgrades,
                enchantment: enchantment,
                enchantmentAmount: enchantmentAmount,
                portraitId: portraitId,
                cardType: cardType,
                tinkerTimeRider: tinkerTimeRider,
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

/**
 * Returns the normalised per-player array for a run.
 * Single-player (legacy) runs expose a flat `cards` / `meta.relics` shape;
 * this helper wraps them in a single-element array so callers never need to
 * branch on `run.players` vs. `run.cards`.
 * Used by both DeckVisualizer.tsx and canvasExport.ts.
 */
export function getPlayersToRender(run: RunData): PlayerRunData[] {
    return run.players ?? [{
        characterName: run.meta?.characterName ?? 'Your Run Deck',
        cards: run.cards ?? [],
        relics: run.meta?.relics ?? [],
    }];
}
