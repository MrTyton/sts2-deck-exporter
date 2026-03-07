import React, { useState, useCallback, useEffect } from 'react'
import { FileUploader } from './components/FileUploader.jsx'
import { DeckVisualizer } from './components/DeckVisualizer.jsx'
import { Gallery } from './components/Gallery.jsx'
import { parseDeckArray } from './utils/deckParser.js'
import { getCharacterName } from './utils/characterMapper.js'
import * as lzString from 'lz-string'

function App() {
    const [runs, setRuns] = useState([])
    const [selectedRunId, setSelectedRunId] = useState(null)
    const [isSharedView, setIsSharedView] = useState(false)
    const [galleryFilters, setGalleryFilters] = useState({
        character: 'All',
        outcome: 'All',
        ascension: 'All',
        sortBy: 'date_desc'
    })

    // On mount, check if there's a deck compressed in the URL hash
    useEffect(() => {
        const hash = window.location.hash
        if (hash && hash.startsWith('#deck=')) {
            try {
                const compressed = hash.substring(6)
                const decompressed = lzString.decompressFromEncodedURIComponent(compressed)
                if (decompressed) {
                    const parsed = JSON.parse(decompressed)
                    // Backwards compatibility if it's just an array
                    if (Array.isArray(parsed)) {
                        setRuns([{
                            cards: parseDeckArray(parsed),
                            meta: null
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
        }
    }, [])

    // Update share URL whenever a specific run is selected
    useEffect(() => {
        if (selectedRunId !== null && runs[selectedRunId]) {
            const run = runs[selectedRunId]
            try {
                const minimalDeck = run.cards.map(c => ({
                    id: c.id,
                    upgrades: c.current_upgrade_level || c.upgrades || 0,
                    enchantmentId: c.enchantment ? c.enchantment.id : null
                }))
                const payload = { deck: minimalDeck, meta: run.meta }
                const compressed = lzString.compressToEncodedURIComponent(JSON.stringify(payload))
                window.history.replaceState(null, null, `#deck=${compressed}`)
            } catch (err) {
                console.warn("Could not generate share URL", err)
            }
        } else {
            // clear hash if back in gallery
            window.history.replaceState(null, null, ' ')
        }
    }, [selectedRunId, runs])

    const handleDeckLoaded = useCallback((rawJsons) => {
        setIsSharedView(false);
        const jsonArray = Array.isArray(rawJsons) ? rawJsons : [rawJsons];

        const newRuns = jsonArray.map(rawJson => {
            const deckArray = rawJson.players[0].deck;
            const relicsArray = rawJson.players[0].relics || [];

            let runLengthStr = "?";
            if (rawJson.map_point_history) {
                let totalFloors = rawJson.map_point_history.reduce((acc, act) => acc + act.length, 0);
                runLengthStr = totalFloors;
            }

            const ascension = rawJson.ascension || 0;
            const outcome = rawJson.win ? "Victory" : (rawJson.was_abandoned ? "Abandoned" : "Defeat");

            const characterId = rawJson.players[0].character;
            const characterName = getCharacterName(characterId);

            const metadata = {
                relics: relicsArray.map(r => r.id.replace('RELIC.', '').toLowerCase()),
                floor: runLengthStr,
                ascension: ascension,
                outcome: outcome,
                characterName: characterName
            };

            return {
                cards: parseDeckArray(deckArray),
                meta: metadata
            };
        });

        setRuns(prev => [...prev, ...newRuns]);
    }, [])

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
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
                        <DeckVisualizer cards={runs[selectedRunId].cards} meta={runs[selectedRunId].meta} />
                    </div>
                )}
            </main>
        </div>
    )
}

export default App
