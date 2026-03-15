import { describe, it, expect } from 'vitest';
import { getCardTooltip, getRelicTooltip, getEnchantmentTooltip } from './tooltipUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Concatenate all text values from a description segment array. */
function joinText(segs: { text: string }[]): string {
    return segs.map(s => s.text).join('');
}

/** Find a segment whose text equals value (exact). */
function findSeg(segs: { text: string; color?: string; upgraded?: boolean }[], text: string) {
    return segs.find(s => s.text === text);
}

// ─── getCardTooltip ───────────────────────────────────────────────────────────

describe('getCardTooltip', () => {
    describe('bash (basic attack, 2-cost)', () => {
        it('returns correct title, type, rarity, and energy cost', () => {
            const t = getCardTooltip('bash', false, 0, null);
            expect(t.title).toBe('Bash');
            expect(t.cardType).toBe('Attack');
            expect(t.cardRarity).toBe('Basic');
            expect(t.energyCost).toBe('2');
        });

        it('base description contains damage value 8 as un-upgraded numeric segment', () => {
            const t = getCardTooltip('bash', false, 0, null);
            const seg = findSeg(t.description, '8');
            expect(seg).toBeDefined();
            expect(seg!.color).toBe('var(--tooltip-value)');
            expect(seg!.upgraded).toBe(false);
        });

        it('base description contains VulnerablePower value 2 as un-upgraded segment', () => {
            const t = getCardTooltip('bash', false, 0, null);
            const seg = t.description.find(s => s.text === '2' && s.color === 'var(--tooltip-value)');
            expect(seg).toBeDefined();
        });

        it('description contains the word "damage"', () => {
            const t = getCardTooltip('bash', false, 0, null);
            expect(joinText(t.description)).toContain('damage');
        });

        it('description contains "Vulnerable" in gold', () => {
            const t = getCardTooltip('bash', false, 0, null);
            const vulSeg = t.description.find(s => s.text === 'Vulnerable' && s.color === 'var(--tooltip-gold)');
            expect(vulSeg).toBeDefined();
        });

        it('upgraded bash (level 1) shows damage 10 marked as changed', () => {
            const t = getCardTooltip('bash', true, 1, null);
            const seg = findSeg(t.description, '10');
            expect(seg).toBeDefined();
            expect(seg!.upgraded).toBe(true);
            expect(seg!.color).toBe('var(--tooltip-upgraded)');
        });

        it('upgraded bash (level 1) shows VulnerablePower 3 marked as changed', () => {
            const t = getCardTooltip('bash', true, 1, null);
            const seg = t.description.find(s => s.text === '3' && s.upgraded === true);
            expect(seg).toBeDefined();
            expect(seg!.color).toBe('var(--tooltip-upgraded)');
        });

        it('description contains a newline segment (multi-line card)', () => {
            const t = getCardTooltip('bash', false, 0, null);
            const nl = t.description.find(s => s.text === '\n');
            expect(nl).toBeDefined();
        });

        it('no enchantment fields when enchantmentId is null', () => {
            const t = getCardTooltip('bash', false, 0, null);
            expect(t.enchantmentTitle).toBeUndefined();
            expect(t.enchantmentDescription).toBeUndefined();
        });
    });

    describe('acrobatics (skill, 1-cost)', () => {
        it('returns correct title, type, and energy cost', () => {
            const t = getCardTooltip('acrobatics', false, 0, null);
            expect(t.title).toBe('Acrobatics');
            expect(t.cardType).toBe('Skill');
            expect(t.energyCost).toBe('1');
        });

        it('base description shows 3 cards drawn', () => {
            const t = getCardTooltip('acrobatics', false, 0, null);
            const seg = findSeg(t.description, '3');
            expect(seg).toBeDefined();
            expect(seg!.upgraded).toBe(false);
        });

        it('upgraded acrobatics shows 4 cards drawn as changed', () => {
            const t = getCardTooltip('acrobatics', true, 1, null);
            const seg = t.description.find(s => s.text === '4' && s.upgraded === true);
            expect(seg).toBeDefined();
        });

        it('description contains "cards"', () => {
            const t = getCardTooltip('acrobatics', false, 0, null);
            expect(joinText(t.description)).toContain('card');
        });
    });

    describe('anger (0-cost attack)', () => {
        it('returns energyCost "0"', () => {
            const t = getCardTooltip('anger', false, 0, null);
            expect(t.title).toBe('Anger');
            expect(t.energyCost).toBe('0');
            expect(t.cardType).toBe('Attack');
        });

        it('base damage is 6', () => {
            const t = getCardTooltip('anger', false, 0, null);
            const seg = findSeg(t.description, '6');
            expect(seg).toBeDefined();
        });

        it('upgraded anger shows 8 damage as changed', () => {
            const t = getCardTooltip('anger', true, 1, null);
            const seg = t.description.find(s => s.text === '8' && s.upgraded === true);
            expect(seg).toBeDefined();
        });
    });

    describe('enchantment support', () => {
        it('includes enchantmentTitle when enchantmentId is provided', () => {
            const t = getCardTooltip('bash', false, 0, 'SHARP', 3);
            expect(t.enchantmentTitle).toBe('Sharp');
        });

        it('enchantmentDescription is non-empty', () => {
            const t = getCardTooltip('bash', false, 0, 'SHARP', 3);
            expect(t.enchantmentDescription).toBeDefined();
            expect(t.enchantmentDescription!.length).toBeGreaterThan(0);
        });

        it('enchantmentDescription contains Amount value 3', () => {
            const t = getCardTooltip('bash', false, 0, 'SHARP', 3);
            const amtSeg = findSeg(t.enchantmentDescription!, '3');
            expect(amtSeg).toBeDefined();
        });

        it('enchantmentAmount defaults to 1 when not provided', () => {
            const t = getCardTooltip('bash', false, 0, 'SHARP');
            const amtSeg = findSeg(t.enchantmentDescription!, '1');
            expect(amtSeg).toBeDefined();
        });

        it('enchantmentDescription contains the word "damage"', () => {
            const t = getCardTooltip('bash', false, 0, 'SHARP', 2);
            expect(joinText(t.enchantmentDescription!)).toContain('damage');
        });
    });

    describe('cardTypeOverride for Mad Science', () => {
        it('respects cardTypeOverride parameter', () => {
            const t = getCardTooltip('mad_science', false, 0, null, undefined, 'Skill');
            expect(t.cardType).toBe('Skill');
        });
    });

    describe('unknown / fallback card', () => {
        it('returns a title-cased fallback name for unknown card ids', () => {
            const t = getCardTooltip('some_unknown_card', false, 0, null);
            expect(t.title).toBe('Some Unknown Card');
        });

        it('description is empty for a card with no game data', () => {
            const t = getCardTooltip('completely_made_up_card_xyz', false, 0, null);
            expect(t.description.length).toBe(0);
        });

        it('cardType and cardRarity are undefined for unknown cards', () => {
            const t = getCardTooltip('zzz_no_such_card', false, 0, null);
            expect(t.cardType).toBeUndefined();
            expect(t.cardRarity).toBeUndefined();
        });

        it('energyCost is undefined for unknown cards', () => {
            const t = getCardTooltip('zzz_no_such_card', false, 0, null);
            expect(t.energyCost).toBeUndefined();
        });
    });
});

// ─── getRelicTooltip ──────────────────────────────────────────────────────────

describe('getRelicTooltip', () => {
    it('returns correct title for burning_blood', () => {
        const t = getRelicTooltip('burning_blood');
        expect(t.title).toBe('Burning Blood');
    });

    it('description is non-empty', () => {
        const t = getRelicTooltip('burning_blood');
        expect(t.description.length).toBeGreaterThan(0);
    });

    it('description contains the heal value (6) as a numeric segment', () => {
        const t = getRelicTooltip('burning_blood');
        const seg = findSeg(t.description, '6');
        expect(seg).toBeDefined();
    });

    it('description contains "HP" text', () => {
        const t = getRelicTooltip('burning_blood');
        expect(joinText(t.description)).toContain('HP');
    });

    it('returns a fallback title for unknown relics', () => {
        const t = getRelicTooltip('some_unknown_relic');
        expect(t.title).toBe('Some Unknown Relic');
    });

    it('description is empty for unknown relic', () => {
        const t = getRelicTooltip('completely_unknown_relic_xyz');
        expect(t.description.length).toBe(0);
    });

    it('does not have energyCost or cardType (it is a relic)', () => {
        const t = getRelicTooltip('burning_blood');
        expect(t.energyCost).toBeUndefined();
        expect(t.cardType).toBeUndefined();
    });
});

// ─── getEnchantmentTooltip ────────────────────────────────────────────────────

describe('getEnchantmentTooltip', () => {
    it('returns correct title for sharp', () => {
        const t = getEnchantmentTooltip('sharp');
        expect(t.title).toBe('Sharp');
    });

    it('description is non-empty', () => {
        const t = getEnchantmentTooltip('sharp');
        expect(t.description.length).toBeGreaterThan(0);
    });

    it('description contains "damage" text', () => {
        const t = getEnchantmentTooltip('sharp');
        expect(joinText(t.description)).toContain('damage');
    });

    it('returns a fallback title for unknown enchantments', () => {
        const t = getEnchantmentTooltip('unknown_enchantment_xyz');
        expect(t.title).toBe('Unknown Enchantment Xyz');
    });

    it('description is empty for unknown enchantment', () => {
        const t = getEnchantmentTooltip('totally_fake_enchantment');
        expect(t.description.length).toBe(0);
    });

    it('does not have energyCost or cardType', () => {
        const t = getEnchantmentTooltip('sharp');
        expect(t.energyCost).toBeUndefined();
        expect(t.cardType).toBeUndefined();
    });
});
