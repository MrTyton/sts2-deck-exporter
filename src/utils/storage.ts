const STORAGE_KEY = 'sts2_exported_runs';

/**
 * Retrieves the list of bitpacked run UIDs from localStorage.
 */
export function getSavedRunUIDs(): string[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        return JSON.parse(stored) as string[];
    } catch (err) {
        console.error("Failed to retrieve saved runs from storage", err);
        return [];
    }
}

/**
 * Saves a new bitpacked run UID to localStorage if it's not already there.
 */
export function saveRunUID(bitpacked: string) {
    try {
        const current = getSavedRunUIDs();
        if (!current.includes(bitpacked)) {
            const updated = [...current, bitpacked];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }
    } catch (err) {
        console.error("Failed to save run to storage", err);
    }
}

/**
 * Clears all saved runs from localStorage.
 */
export function clearSavedRuns() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
        console.error("Failed to clear saved runs from storage", err);
    }
}
