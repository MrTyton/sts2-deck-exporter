import { describe, it, expect, beforeEach } from 'vitest';
import { getSavedRunUIDs, saveRunUID, clearSavedRuns, getLocalNetId, saveLocalNetId } from './storage';

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

describe('Local Net ID helpers', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns undefined when no net ID has been saved', () => {
        expect(getLocalNetId()).toBeUndefined();
    });

    it('saves and retrieves a Steam ID string', () => {
        saveLocalNetId('76561198012345678');
        expect(getLocalNetId()).toBe('76561198012345678');
    });

    it('overwrites a previously saved net ID', () => {
        saveLocalNetId('76561198000000001');
        saveLocalNetId('76561198000000002');
        expect(getLocalNetId()).toBe('76561198000000002');
    });

    it('net ID persists independently of run UIDs being cleared', () => {
        saveLocalNetId('76561198012345678');
        saveRunUID('some-run-uid');
        clearSavedRuns();
        // clearSavedRuns only removes run UIDs, not the local net ID
        expect(getLocalNetId()).toBe('76561198012345678');
        expect(getSavedRunUIDs()).toEqual([]);
    });

    it('localStorage.clear wipes the net ID (full clear)', () => {
        saveLocalNetId('76561198012345678');
        localStorage.clear();
        expect(getLocalNetId()).toBeUndefined();
    });
});
