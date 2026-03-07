import { describe, it, expect } from 'vitest';
import { getCharacterName } from './characterMapper';

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
