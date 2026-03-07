import React, { useState, useCallback, useEffect } from 'react'
import { FileUploader } from './components/FileUploader.jsx'
import { DeckVisualizer } from './components/DeckVisualizer.jsx'
import { parseDeckArray } from './utils/deckParser.js'
import { getCharacterName } from './utils/characterMapper.js'
import * as lzString from 'lz-string'

function App() {
    const [runData, setRunData] = useState(null)

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
                        setRunData({
                            cards: parseDeckArray(parsed),
                            meta: null
                        })
                    } else {
                        setRunData({
                            cards: parseDeckArray(parsed.deck),
                            meta: parsed.meta
                        })
                    }
                }
            } catch (err) {
                console.error("Failed to decode run data from URL:", err)
            }
        }
    }, [])

    const handleDeckLoaded = useCallback((rawJson) => {
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

        // Generate shareable URL
        try {
            const minimalDeck = deckArray.map(c => ({
                id: c.id,
                upgrades: c.current_upgrade_level || 0,
                enchantmentId: c.enchantment ? c.enchantment.id : null
            }))
            const payload = { deck: minimalDeck, meta: metadata }
            const compressed = lzString.compressToEncodedURIComponent(JSON.stringify(payload))
            window.history.replaceState(null, null, `#deck=${compressed}`)
        } catch (err) {
            console.warn("Could not generate share URL", err)
        }

        setRunData({
            cards: parseDeckArray(deckArray),
            meta: metadata
        })
    }, [])

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <header style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }}>
                <h1 style={{ fontSize: '3rem', color: 'var(--accent-color)' }}>Slay the Spire 2</h1>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Deck Exporter</h2>
            </header>

            <main>
                {!runData ? (
                    <FileUploader onDeckLoaded={handleDeckLoaded} />
                ) : (
                    <DeckVisualizer cards={runData.cards} meta={runData.meta} />
                )}
            </main>
        </div>
    )
}

export default App
