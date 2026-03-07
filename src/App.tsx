import { useState, useCallback, useEffect } from 'react';
import { FileUploader } from './components/FileUploader'
import { DeckVisualizer } from './components/DeckVisualizer'
import { Gallery } from './components/Gallery'
import type { RunData } from './components/Gallery'
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
                    const minimalDeck = run.cards ? run.cards.map(c => ({
                        id: c.id,
                        upgrades: c.upgrades || 0,
                        enchantmentId: c.enchantment || null,
                        count: c.count
                    })) : [];
                    const payload = { deck: minimalDeck, meta: run.meta }
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

    const handleDeckLoaded = useCallback((rawJsons: any | any[]) => {
        setIsSharedView(false);
        const jsonArray = Array.isArray(rawJsons) ? rawJsons : [rawJsons];

        const newRuns = jsonArray.map(rawJson => {
            const deckArray = rawJson.players[0].deck;
            const relicsArray = rawJson.players[0].relics || [];

            let runLengthStr: string | number = "?";
            if (rawJson.map_point_history) {
                let totalFloors = rawJson.map_point_history.reduce((acc: number, act: any[]) => acc + act.length, 0);
                runLengthStr = totalFloors;
            }

            const ascension = rawJson.ascension || 0;
            const outcome = rawJson.win ? "Victory" : (rawJson.was_abandoned ? "Abandoned" : "Defeat");

            const characterId = rawJson.players[0].character;
            const characterName = getCharacterName(characterId);

            const metadata = {
                relics: relicsArray.map((r: any) => r.id.replace('RELIC.', '').toLowerCase()),
                floor: runLengthStr,
                ascension: ascension,
                outcome: outcome,
                characterName: characterName || undefined
            };

            return {
                cards: parseDeckArray(deckArray),
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
                            <li>Locate your Slay the Spire 2 save files (usually in your Steam directory under <code>Steam\steamapps\common\Slay the Spire 2\saves</code>).</li>
                            <li>Upload one or multiple <code>.run</code> or <code>.backup</code> files.</li>
                            <li>View your run history, deck composition, and generate shareable images of your deck!</li>
                        </ul>
                        <div style={{ padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', borderLeft: '4px solid var(--text-secondary)' }}>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                <strong>Disclaimer:</strong> This is a fan-made project and has no association with MegaCrit.
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
                        <DeckVisualizer cards={runs[selectedRunId].cards!} meta={runs[selectedRunId].meta} />
                    </div>
                )}
            </main>
        </div>
    )
}

export default App
