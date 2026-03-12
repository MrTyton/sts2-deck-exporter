import { describe, it, expect, beforeEach } from 'vitest';
import { getSavedRunUIDs, saveRunUID, clearSavedRuns } from './storage';

const STORAGE_KEY = 'sts2_exported_runs';

describe('Storage Utility', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns an empty array when no runs are saved', () => {
        expect(getSavedRunUIDs()).toEqual([]);
    });

    it('saves a new run UID', () => {
        const uid = 'abc-123';
        saveRunUID(uid);
        expect(getSavedRunUIDs()).toEqual([uid]);
    });

    it('does not save duplicate run UIDs', () => {
        const uid = 'abc-123';
        saveRunUID(uid);
        saveRunUID(uid);
        expect(getSavedRunUIDs()).toEqual([uid]);
        expect(getSavedRunUIDs().length).toBe(1);
    });

    it('can save multiple unique run UIDs', () => {
        const uids = ['run1', 'run2', 'run3'];
        uids.forEach(uid => saveRunUID(uid));
        expect(getSavedRunUIDs()).toEqual(uids);
    });

    it('clears all saved runs', () => {
        saveRunUID('run1');
        saveRunUID('run2');
        clearSavedRuns();
        expect(getSavedRunUIDs()).toEqual([]);
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('handles malformed JSON in localStorage gracefully', () => {
        localStorage.setItem(STORAGE_KEY, 'invalid-json');
        expect(getSavedRunUIDs()).toEqual([]);
    });
});
