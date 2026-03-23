import { describe, it, expect } from 'vitest';
import { getCharacterName, charIconUrl, CHARACTER_ICONS } from './characterMapper';

describe('getCharacterName', () => {
    it('should map standard character classes to readable names', () => {
        expect(getCharacterName('SILENT')).toBe('The Silent');
        expect(getCharacterName('IRONCLAD')).toBe('The Ironclad');
        expect(getCharacterName('DEFECT')).toBe('The Defect');
        expect(getCharacterName('WATCHER')).toBe('The Watcher');
        expect(getCharacterName('NECROBINDER')).toBe('The Necrobinder');
        expect(getCharacterName('REGENT')).toBe('The Regent');
    });

    it('should handle CHARACTER. prefix commonly found in run files', () => {
        expect(getCharacterName('CHARACTER.IRONCLAD')).toBe('The Ironclad');
        expect(getCharacterName('CHARACTER.SILENT')).toBe('The Silent');
        expect(getCharacterName('CHARACTER.DEFECT')).toBe('The Defect');
        expect(getCharacterName('CHARACTER.WATCHER')).toBe('The Watcher');
    });

    it('should return the original string if no mapping matches', () => {
        expect(getCharacterName('NEW_CLASS')).toBe('NEW_CLASS');
    });

    it('should return null for undefined/null gracefully', () => {
        expect(getCharacterName(null)).toBe(null);
        expect(getCharacterName(undefined)).toBe(null);
    });
});

describe('CHARACTER_ICONS', () => {
    it('contains an entry for every playable character display name', () => {
        const expectedNames = [
            'The Ironclad', 'The Silent', 'The Defect', 'The Necrobinder', 'The Regent',
        ];
        expectedNames.forEach(name => {
            expect(CHARACTER_ICONS[name]).toBeDefined();
        });
    });

    it('maps to valid webp filenames', () => {
        Object.values(CHARACTER_ICONS).forEach(filename => {
            expect(filename).toMatch(/\.webp$/);
        });
    });
});

describe('charIconUrl', () => {
    it('returns a URL containing the mapped filename for known characters', () => {
        const url = charIconUrl('The Ironclad');
        expect(url).not.toBeNull();
        expect(url).toContain('char_select_ironclad.webp');
        expect(url).toContain('assets/characters/');
    });

    it('returns a URL for every character in CHARACTER_ICONS', () => {
        Object.keys(CHARACTER_ICONS).forEach(name => {
            expect(charIconUrl(name)).not.toBeNull();
        });
    });

    it('returns null for an unknown character name', () => {
        expect(charIconUrl('The Watcher')).toBeNull();
        expect(charIconUrl('')).toBeNull();
        expect(charIconUrl('unknown')).toBeNull();
    });
});
