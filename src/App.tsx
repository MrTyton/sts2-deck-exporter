import { useState, useCallback, useEffect } from 'react';
import { FileUploader } from './components/FileUploader'
import { DeckVisualizer } from './components/DeckVisualizer'
import { Gallery } from './components/Gallery'
import type { RunData, PlayerRunData } from './types'
import { parseDeckArray } from './utils/deckParser'
import { getCharacterName } from './utils/characterMapper'

function App() {
    const [isInfoOpen, setIsInfoOpen] = useState(false)
    const [runs, setRuns] = useState<RunData[]>([])
    const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
    const [isSharedView, setIsSharedView] = useState(false)
    const [galleryFilters, setGalleryFilters] = useState<Record<string, string>>({
        character: 'All',
        outcome: 'All',
        ascension: 'All',
        sortBy: 'date_desc'
    })

    // On mount, check if there's a deck compressed in the URL hash
    useEffect(() => {
        const hash = window.location.hash
        if (hash && hash.startsWith('#deck=')) {
            import('lz-string').then(lzString => {
                try {
                    const compressed = hash.substring(6)
                    const decompressed = lzString.decompressFromEncodedURIComponent(compressed)
                    if (decompressed) {
                        const parsed = JSON.parse(decompressed)
                        // Backwards compatibility if it's just an array
                        if (Array.isArray(parsed)) {
                            setRuns([{
                                cards: parseDeckArray(parsed),
                                meta: undefined
                            }])
                        } else if (parsed.players) {
                            const fullPlayers = parsed.players.map((p: any) => ({
                                ...p,
                                cards: parseDeckArray(p.cards)
                            }));
                            setRuns([{
                                players: fullPlayers,
                                meta: parsed.meta
                            }])
                        } else {
                            setRuns([{
                                cards: parseDeckArray(parsed.deck),
                                meta: parsed.meta
                            }])
                        }
                        setSelectedRunId(0) // view it directly
                        setIsSharedView(true)
                    }
                } catch (err) {
                    console.error("Failed to decode run data from URL:", err)
                }
            }).catch(err => console.error("Failed to load lz-string:", err))
        }
    }, [])

    // Update share URL whenever a specific run is selected
    useEffect(() => {
        if (selectedRunId !== null && runs[selectedRunId]) {
            const run = runs[selectedRunId]
            import('lz-string').then(lzString => {
                try {
                    let payload: any = {};
                    if (run.players) {
                        const minimalPlayers = run.players.map(p => ({
                            characterName: p.characterName,
                            relics: p.relics,
                            cards: p.cards.map(c => ({
                                id: c.id,
                                upgrades: c.upgrades || 0,
                                enchantmentId: c.enchantment || null,
                                count: c.count
                            }))
                        }));
                        payload = { players: minimalPlayers, meta: run.meta };
                    } else if (run.cards) {
                        const minimalDeck = run.cards.map(c => ({
                            id: c.id,
                            upgrades: c.upgrades || 0,
                            enchantmentId: c.enchantment || null,
                            count: c.count
                        }));
                        payload = { deck: minimalDeck, meta: run.meta };
                    }
                    const compressed = lzString.compressToEncodedURIComponent(JSON.stringify(payload))
                    window.history.replaceState(null, '', `#deck=${compressed}`)
                } catch (err) {
                    console.warn("Could not generate share URL", err)
                }
            }).catch(err => console.warn("Failed to load lz-string:", err))
        } else {
            // clear hash if back in gallery
            window.history.replaceState(null, '', ' ')
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

        const newRuns = jsonArray.map(rawJson => {
            let runLengthStr: string | number = "?";
            if (rawJson.map_point_history) {
                let totalFloors = rawJson.map_point_history.reduce((acc: number, act: any[]) => acc + act.length, 0);
                runLengthStr = totalFloors;
            }

            const ascension = rawJson.ascension || 0;
            const outcome = rawJson.win ? "Victory" : (rawJson.was_abandoned ? "Abandoned" : "Defeat");
            const timeStr = rawJson.run_time ? formatTime(rawJson.run_time) : undefined;

            const playersData: PlayerRunData[] = rawJson.players.map((player: any) => {
                const characterId = player.character;
                const characterName = getCharacterName(characterId);
                const deckArray = player.deck;
                const relicsArray = player.relics || [];

                return {
                    characterName: characterName || "Unknown Character",
                    cards: parseDeckArray(deckArray),
                    relics: relicsArray.map((r: any) => r.id.replace('RELIC.', '').toLowerCase())
                };
            });

            const combinedNames = playersData.map(p => p.characterName).join(' & ');

            const metadata = {
                floor: runLengthStr,
                ascension: ascension,
                outcome: outcome,
                characterName: combinedNames,
                time: timeStr
            };

            return {
                players: playersData,
                meta: metadata
            };
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
                                <strong>Disclaimer:</strong> This is a fan-made project and has no association with MegaCrit.
                            </p>
                            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
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
                {runs.length === 0 ? (
                    <FileUploader onDeckLoaded={handleDeckLoaded} />
                ) : selectedRunId === null ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
                            <button className="btn-secondary" onClick={() => setRuns([])}>Clear All Runs</button>
                        </div>
                        <Gallery
                            runs={runs}
                            onSelectRun={setSelectedRunId}
                            filters={galleryFilters}
                            onFilterChange={setGalleryFilters}
                        />
                        {/* We could also put the uploader below the gallery so they can add more, but let's keep it simple for now */}
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
