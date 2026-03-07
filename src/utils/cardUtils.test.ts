import { describe, it, expect } from 'vitest';
import { formatCardName } from './cardUtils';

describe('formatCardName', () => {
    it('should strip character names from basic Strike cards', () => {
        expect(formatCardName('strike_ironclad')).toBe('strike');
        expect(formatCardName('strike_silent')).toBe('strike');
        expect(formatCardName('strike_defect')).toBe('strike');
        expect(formatCardName('strike_necrobinder')).toBe('strike');
        expect(formatCardName('strike_regent')).toBe('strike');
    });

    it('should strip character names from basic Defend cards', () => {
        expect(formatCardName('defend_ironclad')).toBe('defend');
        expect(formatCardName('defend_silent')).toBe('defend');
        expect(formatCardName('defend_defect')).toBe('defend');
        expect(formatCardName('defend_necrobinder')).toBe('defend');
        expect(formatCardName('defend_regent')).toBe('defend');
    });

    it('should NOT strip character names from other cards starting with Strike or Defend', () => {
        // Pommel Strike is not "Strike [Character]"
        expect(formatCardName('pommel_strike')).toBe('pommel strike');
        expect(formatCardName('twin_strike')).toBe('twin strike');
        expect(formatCardName('wild_strike')).toBe('wild strike');
        expect(formatCardName('glacier_defend')).toBe('glacier defend'); // hypothetical
    });

    it('should replace underscores with spaces for all cards', () => {
        expect(formatCardName('bash')).toBe('bash');
        expect(formatCardName('bloodletting')).toBe('bloodletting');
        expect(formatCardName('feel_no_pain')).toBe('feel no pain');
    });

    it('should work with single word strike/defend if they exist', () => {
        expect(formatCardName('strike')).toBe('strike');
        expect(formatCardName('defend')).toBe('defend');
    });
});
