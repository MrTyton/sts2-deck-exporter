import { describe, it, expect } from 'vitest';
import { parseDeckArray } from './deckParser';

describe('parseDeckArray', () => {
    it('should correctly group identical base cards', () => {
        const rawDeck = [
            { id: "CARD.STRIKE_SILENT" },
            { id: "CARD.STRIKE_SILENT" },
            { id: "STRIKE_SILENT" }
        ];

        const result = parseDeckArray(rawDeck);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('strike_silent');
        expect(result[0].count).toBe(3);
        expect(result[0].upgraded).toBe(false);
    });

    it('should separate upgraded cards from base cards', () => {
        const rawDeck = [
            { id: "STRIKE_SILENT" },
            { id: "STRIKE_SILENT", upgrades: 1 },
            { id: "STRIKE_SILENT+" },
            { id: "STRIKE_SILENT", current_upgrade_level: 2 }
        ];

        const result = parseDeckArray(rawDeck);
        // We expect STRIKE_SILENT (1), STRIKE_SILENT upgraded (1 with upgrade 1, 1 with upgrade 2, 1 with plus symbol)
        // Wait, the unique key in parseDeckArray includes the number of upgrades. 
        // id.includes('+') doesn't change `upgrades` value if upgrades isn't set.
        // Let's verify grouping keys.
        expect(result).toHaveLength(4);
    });

    it('should sort cards by count descending, then alphabetically', () => {
        const rawDeck = [
            { id: "B" },
            { id: "A" },
            { id: "A" },
            { id: "C" },
            { id: "C" },
            { id: "C" }
        ];

        const result = parseDeckArray(rawDeck);
        expect(result[0].id).toBe('c');
        expect(result[1].id).toBe('a');
        expect(result[2].id).toBe('b');
    });

    it('should handle enchantments correctly', () => {
        const rawDeck = [
            { id: "STRIKE", enchantment: { id: "ENCHANTMENT.FIRE" } },
            { id: "STRIKE", enchantment: { id: "ENCHANTMENT.ICE" } },
            { id: "STRIKE", enchantmentId: "ENCHANTMENT.FIRE" }
        ];

        const result = parseDeckArray(rawDeck);
        expect(result).toHaveLength(2); // One FIRE (count 2), one ICE (count 1)
        const fire = result.find(c => c.enchantment === 'FIRE');
        const ice = result.find(c => c.enchantment === 'ICE');
        expect(fire!.count).toBe(2);
        expect(ice!.count).toBe(1);
    });

    it('should respect the count property if present', () => {
        const rawDeck = [
            { id: "STRIKE", count: 5 },
            { id: "DEFEND", count: 3 },
            { id: "STRIKE", count: 2 }
        ];

        const result = parseDeckArray(rawDeck);
        expect(result).toHaveLength(2);
        const strike = result.find(c => c.id === 'strike');
        const defend = result.find(c => c.id === 'defend');
        expect(strike!.count).toBe(7);
        expect(defend!.count).toBe(3);
    });
});

describe('parseDeckArray – Mad Science variants', () => {
    it('defaults to attack type (portraitId=mad_science_attack) when props are absent', () => {
        const result = parseDeckArray([{ id: 'MAD_SCIENCE' }]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('mad_science');
        expect(result[0].portraitId).toBe('mad_science_attack');
        expect(result[0].cardType).toBe('Attack');
        expect(result[0].tinkerTimeRider).toBeUndefined();
    });

    it('parses TinkerTimeType=1 as Attack variant', () => {
        const result = parseDeckArray([{
            id: 'MAD_SCIENCE',
            props: { ints: [{ name: 'TinkerTimeType', value: 1 }] }
        }]);
        expect(result[0].portraitId).toBe('mad_science_attack');
        expect(result[0].cardType).toBe('Attack');
    });

    it('parses TinkerTimeType=2 as Skill variant', () => {
        const result = parseDeckArray([{
            id: 'MAD_SCIENCE',
            props: { ints: [{ name: 'TinkerTimeType', value: 2 }] }
        }]);
        expect(result[0].portraitId).toBe('mad_science_skill');
        expect(result[0].cardType).toBe('Skill');
    });

    it('parses TinkerTimeType=3 as Power variant', () => {
        const result = parseDeckArray([{
            id: 'MAD_SCIENCE',
            props: { ints: [{ name: 'TinkerTimeType', value: 3 }] }
        }]);
        expect(result[0].portraitId).toBe('mad_science_power');
        expect(result[0].cardType).toBe('Power');
    });

    it('falls back to attack for an unknown TinkerTimeType value', () => {
        const result = parseDeckArray([{
            id: 'MAD_SCIENCE',
            props: { ints: [{ name: 'TinkerTimeType', value: 99 }] }
        }]);
        expect(result[0].portraitId).toBe('mad_science_attack');
        expect(result[0].cardType).toBe('Attack');
    });

    it('correctly parses TinkerTimeRider=3 (choking)', () => {
        const result = parseDeckArray([{
            id: 'MAD_SCIENCE',
            props: { ints: [{ name: 'TinkerTimeType', value: 1 }, { name: 'TinkerTimeRider', value: 3 }] }
        }]);
        expect(result[0].tinkerTimeRider).toBe('choking');
    });

    it('correctly parses TinkerTimeRider=1 (sapping)', () => {
        const result = parseDeckArray([{
            id: 'MAD_SCIENCE',
            props: { ints: [{ name: 'TinkerTimeType', value: 1 }, { name: 'TinkerTimeRider', value: 1 }] }
        }]);
        expect(result[0].tinkerTimeRider).toBe('sapping');
    });

    it('leaves tinkerTimeRider undefined when TinkerTimeRider=0 (None)', () => {
        const result = parseDeckArray([{
            id: 'MAD_SCIENCE',
            props: { ints: [{ name: 'TinkerTimeType', value: 1 }, { name: 'TinkerTimeRider', value: 0 }] }
        }]);
        expect(result[0].tinkerTimeRider).toBeUndefined();
    });

    it('groups two mad_science cards with different types as separate entries', () => {
        const rawDeck = [
            { id: 'MAD_SCIENCE', props: { ints: [{ name: 'TinkerTimeType', value: 1 }] } },
            { id: 'MAD_SCIENCE', props: { ints: [{ name: 'TinkerTimeType', value: 2 }] } },
        ];
        const result = parseDeckArray(rawDeck);
        expect(result).toHaveLength(2);
    });

    it('groups two identical mad_science cards (same type and rider) into one entry', () => {
        const card = { id: 'MAD_SCIENCE', props: { ints: [{ name: 'TinkerTimeType', value: 1 }, { name: 'TinkerTimeRider', value: 3 }] } };
        const result = parseDeckArray([card, card]);
        expect(result).toHaveLength(1);
        expect(result[0].count).toBe(2);
    });
});
