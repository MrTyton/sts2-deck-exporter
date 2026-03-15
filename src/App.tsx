import { useState, useCallback, useEffect } from 'react';
import { FileUploader } from './components/FileUploader'
import { DeckVisualizer } from './components/DeckVisualizer'
import { Gallery } from './components/Gallery'
import { StatsPage } from './components/StatsPage'
import type { RunData, PlayerRunData } from './types'
import { parseDeckArray } from './utils/deckParser'
import { getCharacterName } from './utils/characterMapper'
import { encodeRun, decodeRun } from './utils/deckEncoder'
import { decodeStats } from './utils/statsEncoder'
import type { StatsSnapshot } from './utils/statsImageExport'
import { getSavedRunUIDs, saveRunUID, clearSavedRuns, getLocalNetId, saveLocalNetId } from './utils/storage'

function App() {
    const [isInfoOpen, setIsInfoOpen] = useState(false)
    const [runs, setRuns] = useState<RunData[]>([])
    const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
    const [isSharedView, setIsSharedView] = useState(false)
    const [galleryTab, setGalleryTab] = useState<'gallery' | 'stats'>('gallery')
    const [sharedStats, setSharedStats] = useState<StatsSnapshot | null>(null)
    const [galleryFilters, setGalleryFilters] = useState<Record<string, string>>({
        character: 'All',
        outcome: 'All',
        ascension: 'All',
        playerCount: 'All',
        sortBy: 'date_desc'
    })

    // On mount, check if there's a deck compressed in the URL hash AND load saved runs
    useEffect(() => {
        const hash = window.location.hash
        let initialRuns: RunData[] = [];

        // 1. Load from storage first
        const savedUIDs = getSavedRunUIDs();
        savedUIDs.forEach(uid => {
            try {
                const decoded = decodeRun(uid);
                if (decoded) initialRuns.push(decoded);
            } catch (err) {
                console.error("Failed to decode saved run:", err);
            }
        });

        // 2. Check hash
        if (hash) {
            if (hash.startsWith('#d=')) {
                // New bitpacked format
                try {
                    const bitpacked = hash.substring(3);
                    const decoded = decodeRun(bitpacked);
                    if (decoded) {
                        // Check if already in initialRuns to avoid dupes
                        const alreadyStored = savedUIDs.includes(bitpacked);
                        if (!alreadyStored) {
                            initialRuns.push(decoded);
                        }
                        setRuns(initialRuns);
                        setSelectedRunId(initialRuns.indexOf(decoded));
                        setIsSharedView(true);
                        return;
                    }
                } catch (err) {
                    console.error("Failed to decode bitpacked run from hash:", err);
                }
            } else if (hash.startsWith('#s=')) {
                // Stats snapshot shared link
                decodeStats(hash.substring(3)).then(decoded => {
                    if (decoded) {
                        setSharedStats(decoded);
                        setGalleryTab('stats');
                    }
                }).catch(err => console.error('Failed to decode stats snapshot from hash:', err));
                if (initialRuns.length > 0) setRuns(initialRuns);
                return;
            } else if (hash.startsWith('#deck=')) {
                // Legacy lz-string format
                import('lz-string').then(lzString => {
                    try {
                        const compressed = hash.substring(6)
                        const decompressed = lzString.decompressFromEncodedURIComponent(compressed)
                        if (decompressed) {
                            const parsed = JSON.parse(decompressed)
                            let legacyRun: RunData;
                            // Backwards compatibility if it's just an array
                            if (Array.isArray(parsed)) {
                                legacyRun = {
                                    cards: parseDeckArray(parsed),
                                    meta: undefined
                                };
                            } else if (parsed.players) {
                                const fullPlayers = parsed.players.map((p: any) => ({
                                    ...p,
                                    cards: parseDeckArray(p.cards)
                                }));
                                legacyRun = {
                                    players: fullPlayers,
                                    meta: parsed.meta
                                };
                            } else {
                                legacyRun = {
                                    cards: parseDeckArray(parsed.deck),
                                    meta: parsed.meta
                                };
                            }

                            setRuns([...initialRuns, legacyRun]);
                            setSelectedRunId(initialRuns.length); // view it directly
                            setIsSharedView(true);
                        }
                    } catch (err) {
                        console.error("Failed to decode run data from legacy URL:", err)
                    }
                }).catch(err => console.error("Failed to load lz-string:", err))
                return;
            }
        }

        if (initialRuns.length > 0) {
            setRuns(initialRuns);
        }
    }, [])

    // Update share URL whenever a specific run is selected
    useEffect(() => {
        if (selectedRunId !== null && runs[selectedRunId]) {
            const run = runs[selectedRunId]
            try {
                const bitpacked = encodeRun(run);
                if (bitpacked) {
                    window.history.replaceState(null, '', `#d=${bitpacked}`);
                }
            } catch (err) {
                console.warn("Could not generate share URL", err);
            }
        } else {
            // clear hash if back in gallery
            window.history.replaceState(null, '', ' ');
        }
    }, [selectedRunId, runs])

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const CopyButton = ({ text, label }: { text: string, label: string }) => {
        const [copied, setCopied] = useState(false);

        const handleCopy = () => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };

        return (
            <button
                className={`copy-button ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
                title={`Copy ${label} path`}
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
        );
    };

    const handleDeckLoaded = useCallback((rawJsons: any | any[]) => {
        setIsSharedView(false);
        const jsonArray = Array.isArray(rawJsons) ? rawJsons : [rawJsons];
        const currentUIDs = getSavedRunUIDs();
        const addedUIDsInThisBatch = new Set<string>();

        // Detect the local player's Steam ID from solo runs.
        // Solo runs have exactly one player whose 'id' field (a Steam64 ulong) is definitively
        // the local player. Pre-scan the batch first, then fall back to the ID saved from a prior session.
        let localNetId = getLocalNetId();
        if (!localNetId) {
            for (const rawJson of jsonArray) {
                if (rawJson.players?.length === 1 && rawJson.players[0].id != null) {
                    localNetId = String(rawJson.players[0].id);
                    saveLocalNetId(localNetId);
                    break;
                }
            }
        }

        const newRuns: RunData[] = [];
        jsonArray.forEach(rawJson => {
            let runLengthStr: string | number = "?";
            if (rawJson.map_point_history) {
                let totalFloors = rawJson.map_point_history.reduce((acc: number, act: any[]) => acc + act.length, 0);
                runLengthStr = totalFloors;
            }

            const ascension = rawJson.ascension || 0;
            const outcome = rawJson.win ? "Victory" : (rawJson.was_abandoned ? "Abandoned" : "Defeat");
            const timeStr = rawJson.run_time ? formatTime(rawJson.run_time) : undefined;
            const timestamp = rawJson.start_time;

            const isSoloRun = rawJson.players.length === 1;
            const playersData: PlayerRunData[] = rawJson.players.map((player: any) => {
                const characterId = player.character;
                const characterName = getCharacterName(characterId);
                const deckArray = player.deck;
                const relicsArray = player.relics || [];
                // 'id' in the run JSON is a Steam64 ulong; store as string to avoid JS number precision loss.
                const netId = player.id != null ? String(player.id) : undefined;
                const isLocalPlayer: boolean | undefined =
                    isSoloRun ? true
                    : (localNetId !== undefined && netId === localNetId) ? true
                    : undefined;

                return {
                    characterName: characterName || "Unknown Character",
                    cards: parseDeckArray(deckArray),
                    relics: relicsArray.map((r: any) => r.id.replace('RELIC.', '').toLowerCase()),
                    netId,
                    isLocalPlayer,
                };
            });

            const combinedNames = playersData.map(p => p.characterName).join(' & ');

            const metadata = {
                floor: runLengthStr,
                ascension: ascension,
                outcome: outcome,
                characterName: combinedNames,
                time: timeStr,
                timestamp: timestamp
            };

            const run: RunData = {
                players: playersData,
                meta: metadata
            };

            // Save to local storage with duplicate check
            try {
                const bitpacked = encodeRun(run);
                if (bitpacked) {
                    if (!currentUIDs.includes(bitpacked) && !addedUIDsInThisBatch.has(bitpacked)) {
                        newRuns.push(run);
                        saveRunUID(bitpacked);
                        addedUIDsInThisBatch.add(bitpacked);
                    }
                }
            } catch (err) {
                console.warn("Could not process run for saving", err);
            }
        });

        setRuns(prev => [...prev, ...newRuns]);
    }, [])

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', position: 'relative' }}>
            <button
                className="btn-info"
                onClick={() => setIsInfoOpen(true)}
                title="Information & Disclaimer"
            >
                i
            </button>

            {isInfoOpen && (
                <div className="modal-overlay" onClick={() => setIsInfoOpen(false)}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setIsInfoOpen(false)}>×</button>
                        <h2 style={{ marginBottom: '1rem', color: 'var(--accent-color)' }}>How to Use</h2>
                        <ul style={{ textAlign: 'left', marginBottom: '1.5rem', color: 'var(--text-primary)', lineHeight: '1.6', paddingLeft: '1.5rem' }}>
                            <li>
                                Locate your Slay the Spire 2 save files (you can paste these into the file picker's address bar):
                                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                    <li style={{ marginBottom: '0.4rem' }}>
                                        <strong>Windows:</strong> <code>%AppData%\SlayTheSpire2\steam\&lt;SteamID&gt;\&lt;profile&gt;\saves\history</code>
                                        <CopyButton text="%AppData%\SlayTheSpire2\steam\" label="Windows Path" />
                                    </li>
                                    <li style={{ marginBottom: '0.4rem' }}>
                                        <strong>Mac:</strong> <code>~/Library/Application Support/Steam/userdata/&lt;SteamID&gt;/2868840/remote/&lt;profile&gt;/saves/history</code>
                                        <CopyButton text="~/Library/Application Support/Steam/userdata/" label="Mac Path" />
                                    </li>
                                </ul>
                            </li>
                            <li>Upload one or multiple <code>.run</code> or <code>.backup</code> files.</li>
                            <li>View your run history, deck composition, and generate shareable images of your deck!</li>
                        </ul>
                        <div style={{ padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', borderLeft: '4px solid var(--text-secondary)' }}>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                <strong>Privacy & Data:</strong> Your uploaded runs are stored locally on your computer using <code>localStorage</code>.
                                No data is ever sent to a server. You can clear this data at any time by clicking "Clear All Runs" or by clearing your browser's site data.
                            </p>
                            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                <strong>Disclaimer:</strong> This is a fan-made project and has no association with MegaCrit.
                            </p>
                            <p style={{ marginTop: '0.5rem', fontSize: '1rem' }}>
                                <a
                                    href="https://store.steampowered.com/app/2868840/Slay_the_Spire_2/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}
                                >
                                    Buy Slay the Spire 2 on Steam
                                </a>
                            </p>
                            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                Have a bug or feature request? <a href="https://github.com/MrTyton/sts2-deck-exporter/issues" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>Submit an issue on GitHub</a>.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <header style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }}>
                <h1 style={{ fontSize: '3rem', color: 'var(--accent-color)' }}>Slay the Spire 2</h1>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Deck Exporter</h2>
            </header>

            <main>
                {sharedStats !== null ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Viewing shared run stats. Upload your own <code>.run</code> files to see your stats here.
                            </span>
                            <button className="btn-secondary" onClick={() => {
                                    setSharedStats(null);
                                    window.history.replaceState(null, '', ' ');
                                    if (getSavedRunUIDs().length > 0) {
                                        setGalleryTab('stats');
                                    }
                                }}>
                                Load Your Own Runs
                            </button>
                        </div>
                        <StatsPage runs={[]} sharedStats={sharedStats} />
                    </div>
                ) : runs.length === 0 ? (
                    <FileUploader onDeckLoaded={handleDeckLoaded} />
                ) : selectedRunId === null ? (
                    <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* Top toolbar: upload + tabs + clear */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr auto',
                                alignItems: 'center',
                                width: '100%',
                                gap: '1rem'
                            }}>
                                <FileUploader onDeckLoaded={handleDeckLoaded} compact={true} />

                                {/* Tab bar */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                    {(['gallery', 'stats'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setGalleryTab(tab)}
                                            style={{
                                                padding: '0.4rem 1.2rem',
                                                borderRadius: '8px',
                                                border: '1px solid',
                                                borderColor: galleryTab === tab ? 'var(--accent-color)' : 'var(--surface-border)',
                                                background: galleryTab === tab ? 'rgba(214,178,81,0.12)' : 'transparent',
                                                color: galleryTab === tab ? 'var(--accent-color)' : 'var(--text-secondary)',
                                                fontFamily: 'var(--font-body)',
                                                fontSize: '0.9rem',
                                                fontWeight: galleryTab === tab ? 700 : 400,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                                textTransform: 'capitalize',
                                            }}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className="btn-secondary" onClick={() => {
                                        setRuns([]);
                                        clearSavedRuns();
                                    }}>Clear All Runs</button>
                                </div>
                            </div>

                            {galleryTab === 'gallery' ? (
                                <Gallery
                                    runs={runs}
                                    onSelectRun={setSelectedRunId}
                                    filters={galleryFilters}
                                    onFilterChange={setGalleryFilters}
                                />
                            ) : (
                                <StatsPage runs={runs} />
                            )}
                        </div>
                    </div>
                ) : (
                    <div>
                        {!isSharedView && runs.length >= 1 && (
                            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '10px' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setSelectedRunId(null)}
                                >
                                    ← Back to Gallery
                                </button>
                            </div>
                        )}
                        <DeckVisualizer run={runs[selectedRunId]} />
                    </div>
                )}
            </main>
        </div>
    )
}

export default App
