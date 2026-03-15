import { describe, it, expect } from 'vitest';
import { formatCardName, getCardPortraitId } from './cardUtils';
import type { CardData } from '../types';

describe('formatCardName', () => {
    it('should strip character names from basic Strike cards and capitalize', () => {
        expect(formatCardName('strike_ironclad')).toBe('Strike');
        expect(formatCardName('strike_silent')).toBe('Strike');
        expect(formatCardName('strike_defect')).toBe('Strike');
        expect(formatCardName('strike_necrobinder')).toBe('Strike');
        expect(formatCardName('strike_regent')).toBe('Strike');
    });

    it('should strip character names from basic Defend cards and capitalize', () => {
        expect(formatCardName('defend_ironclad')).toBe('Defend');
        expect(formatCardName('defend_silent')).toBe('Defend');
        expect(formatCardName('defend_defect')).toBe('Defend');
        expect(formatCardName('defend_necrobinder')).toBe('Defend');
        expect(formatCardName('defend_regent')).toBe('Defend');
    });

    it('should NOT strip character names from other cards starting with Strike or Defend and use Title Case', () => {
        // Pommel Strike is not "Strike [Character]"
        expect(formatCardName('pommel_strike')).toBe('Pommel Strike');
        expect(formatCardName('twin_strike')).toBe('Twin Strike');
        expect(formatCardName('wild_strike')).toBe('Wild Strike');
        expect(formatCardName('glacier_defend')).toBe('Glacier Defend'); // hypothetical
    });

    it('should replace underscores with spaces for all cards and use Title Case', () => {
        expect(formatCardName('bash')).toBe('Bash');
        expect(formatCardName('bloodletting')).toBe('Bloodletting');
        expect(formatCardName('feel_no_pain')).toBe('Feel No Pain');
        expect(formatCardName('body_slam')).toBe('Body Slam');
    });

    it('should work with single word strike/defend if they exist', () => {
        expect(formatCardName('strike')).toBe('Strike');
        expect(formatCardName('defend')).toBe('Defend');
    });
});

describe('getCardPortraitId', () => {
    it('returns card.id when portraitId is undefined', () => {
        const card: CardData = { id: 'bash', count: 1, upgraded: false, upgrades: 0, enchantment: null };
        expect(getCardPortraitId(card)).toBe('bash');
    });

    it('returns portraitId when explicitly set (Mad Science attack variant)', () => {
        const card: CardData = {
            id: 'mad_science', count: 1, upgraded: false, upgrades: 0,
            enchantment: null, portraitId: 'mad_science_attack'
        };
        expect(getCardPortraitId(card)).toBe('mad_science_attack');
    });

    it('returns portraitId for skill and power variants', () => {
        const skillCard: CardData = {
            id: 'mad_science', count: 1, upgraded: false, upgrades: 0,
            enchantment: null, portraitId: 'mad_science_skill'
        };
        const powerCard: CardData = {
            id: 'mad_science', count: 1, upgraded: false, upgrades: 0,
            enchantment: null, portraitId: 'mad_science_power'
        };
        expect(getCardPortraitId(skillCard)).toBe('mad_science_skill');
        expect(getCardPortraitId(powerCard)).toBe('mad_science_power');
    });

    it('returns card.id for non-variant cards regardless of other fields', () => {
        const card: CardData = { id: 'anger', count: 2, upgraded: true, upgrades: 1, enchantment: 'SHARP' };
        expect(getCardPortraitId(card)).toBe('anger');
    });
});
