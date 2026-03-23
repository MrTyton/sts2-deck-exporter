import { describe, it, expect } from 'vitest';
import { STARTER_CARD_IDS, STARTER_RELIC_IDS } from './gameConstants';

describe('STARTER_CARD_IDS', () => {
    it('includes generic starter cards shared across characters', () => {
        expect(STARTER_CARD_IDS.has('strike')).toBe(true);
        expect(STARTER_CARD_IDS.has('defend')).toBe(true);
    });

    it('includes Ironclad starter cards', () => {
        expect(STARTER_CARD_IDS.has('strike_ironclad')).toBe(true);
        expect(STARTER_CARD_IDS.has('defend_ironclad')).toBe(true);
        expect(STARTER_CARD_IDS.has('bash')).toBe(true);
    });

    it('includes Silent starter cards', () => {
        expect(STARTER_CARD_IDS.has('strike_silent')).toBe(true);
        expect(STARTER_CARD_IDS.has('defend_silent')).toBe(true);
        expect(STARTER_CARD_IDS.has('neutralize')).toBe(true);
        expect(STARTER_CARD_IDS.has('survivor')).toBe(true);
    });

    it('includes Defect starter cards', () => {
        expect(STARTER_CARD_IDS.has('strike_defect')).toBe(true);
        expect(STARTER_CARD_IDS.has('defend_defect')).toBe(true);
        expect(STARTER_CARD_IDS.has('zap')).toBe(true);
        expect(STARTER_CARD_IDS.has('dualcast')).toBe(true);
    });

    it('includes Necrobinder starter cards', () => {
        expect(STARTER_CARD_IDS.has('strike_necrobinder')).toBe(true);
        expect(STARTER_CARD_IDS.has('defend_necrobinder')).toBe(true);
        expect(STARTER_CARD_IDS.has('bodyguard')).toBe(true);
        expect(STARTER_CARD_IDS.has('unleash')).toBe(true);
    });

    it('includes Regent starter cards', () => {
        expect(STARTER_CARD_IDS.has('strike_regent')).toBe(true);
        expect(STARTER_CARD_IDS.has('defend_regent')).toBe(true);
        expect(STARTER_CARD_IDS.has('falling_star')).toBe(true);
        expect(STARTER_CARD_IDS.has('venerate')).toBe(true);
    });

    it('does not include non-starter acquired cards', () => {
        expect(STARTER_CARD_IDS.has('whirlwind')).toBe(false);
        expect(STARTER_CARD_IDS.has('shiv')).toBe(false);
        expect(STARTER_CARD_IDS.has('ball_lightning')).toBe(false);
    });
});

describe('STARTER_RELIC_IDS', () => {
    it('includes the starting relic for each character', () => {
        expect(STARTER_RELIC_IDS.has('burning_blood')).toBe(true);      // Ironclad
        expect(STARTER_RELIC_IDS.has('ring_of_the_snake')).toBe(true);  // Silent
        expect(STARTER_RELIC_IDS.has('cracked_core')).toBe(true);       // Defect
        expect(STARTER_RELIC_IDS.has('bound_phylactery')).toBe(true);   // Necrobinder
        expect(STARTER_RELIC_IDS.has('divine_right')).toBe(true);       // Regent
    });

    it('contains exactly 5 entries (one per character)', () => {
        expect(STARTER_RELIC_IDS.size).toBe(5);
    });

    it('does not include non-starting relics', () => {
        expect(STARTER_RELIC_IDS.has('anchor')).toBe(false);
        expect(STARTER_RELIC_IDS.has('bag_of_preparation')).toBe(false);
    });
});
