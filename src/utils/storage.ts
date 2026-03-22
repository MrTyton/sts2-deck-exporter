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
 * Removes a single bitpacked run UID from localStorage.
 */
export function removeRunUID(bitpacked: string) {
    try {
        const current = getSavedRunUIDs();
        const updated = current.filter(uid => uid !== bitpacked);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
        console.error("Failed to remove run from storage", err);
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

const LOCAL_NET_ID_KEY = 'sts2_local_net_id';

/**
 * Retrieves the local player's Steam ID (read from the raw JSON 'id' field) saved from a prior session.
 */
export function getLocalNetId(): string | undefined {
    try {
        return localStorage.getItem(LOCAL_NET_ID_KEY) ?? undefined;
    } catch {
        return undefined;
    }
}

/**
 * Persists the local player's Steam ID so it can be used to identify
 * the local player in co-op runs across sessions.
 */
export function saveLocalNetId(netId: string) {
    try {
        localStorage.setItem(LOCAL_NET_ID_KEY, netId);
    } catch (err) {
        console.error("Failed to save local net ID", err);
    }
}
