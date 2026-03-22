import { useState, useRef, useCallback } from 'react';
import { generateDeckImage } from '../utils/canvasExport';
import { formatCardName, getCardPortraitId } from '../utils/cardUtils';
import { Tooltip } from './Tooltip';
import { getCardTooltip, getRelicTooltip } from '../utils/tooltipUtils';
import type { TooltipContent } from '../utils/tooltipUtils';
import type { CardData, RunData } from '../types';

export interface DeckVisualizerProps {
    run: RunData;
}

export function DeckVisualizer({ run }: DeckVisualizerProps) {
    const exportRef = useRef<HTMLDivElement>(null);
    const [copyImageText, setCopyImageText] = useState('Copy Image');
    const [copyLinkText, setCopyLinkText] = useState('Copy Share Link');

    // ── Tooltip state ────────────────────────────────────────────────────────
    const [tooltipContent, setTooltipContent] = useState<TooltipContent | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [tooltipVisible, setTooltipVisible] = useState(false);

    const showCardTooltip = useCallback((e: React.MouseEvent, card: CardData) => {
        const content = getCardTooltip(card.id, card.upgraded, card.upgrades, card.enchantment, card.enchantmentAmount, card.cardType, card.tinkerTimeRider, run.meta?.patchIndex);
        setTooltipContent(content);
        setTooltipPos({ x: e.clientX, y: e.clientY });
        setTooltipVisible(true);
    }, [run.meta?.patchIndex]);

    const showRelicTooltip = useCallback((e: React.MouseEvent, relicId: string) => {
        const content = getRelicTooltip(relicId, run.meta?.patchIndex);
        setTooltipContent(content);
        setTooltipPos({ x: e.clientX, y: e.clientY });
        setTooltipVisible(true);
    }, [run.meta?.patchIndex]);

    const updateTooltipPos = useCallback((e: React.MouseEvent) => {
        setTooltipPos({ x: e.clientX, y: e.clientY });
    }, []);

    const hideTooltip = useCallback(() => {
        setTooltipVisible(false);
    }, []);

    const handleExport = async () => {
        try {
            const canvas = await generateDeckImage(run);
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'sts2-deck.png';
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to export image', err);
        }
    };

    const handleCopyImage = async () => {
        try {
            const canvas = await generateDeckImage(run);
            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error("Canvas toBlob failed");
                await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                ]);
                setCopyImageText('Copied!');
                setTimeout(() => setCopyImageText('Copy Image'), 2000);
            }, 'image/png');
        } catch (err) {
            console.error('Failed to copy image', err);
            setCopyImageText('Failed');
            setTimeout(() => setCopyImageText('Copy Image'), 2000);
        }
    };

    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopyLinkText('Copied!');
            setTimeout(() => setCopyLinkText('Copy Share Link'), 2000);
        } catch (err) {
            console.error('Failed to copy link', err);
            setCopyLinkText('Failed');
            setTimeout(() => setCopyLinkText('Copy Share Link'), 2000);
        }
    };

    const playersToRender = run.players || [{
        characterName: run.meta?.characterName || 'Your Run Deck',
        cards: run.cards || [],
        relics: run.meta?.relics || []
    }];

    return (
        <>
        <div className="deck-visualizer">
            <div className="controls-panel glass-panel" style={{ padding: '1rem 2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn-secondary" onClick={copyUrl}>{copyLinkText}</button>
                <button className="btn-primary" onClick={handleCopyImage}>{copyImageText}</button>
                <button className="btn-primary" onClick={handleExport}>Download Image</button>
                <button className="btn-secondary" onClick={() => window.location.assign(window.location.pathname)}>Reset</button>
            </div>

            <div ref={exportRef} className="export-container" style={{ backgroundColor: '#0d0f12', padding: '2rem', borderRadius: '16px' }}>
                <div className="deck-header" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ color: 'var(--accent-color)', marginBottom: '0.25rem' }}>{run.meta?.characterName || 'Your Run Deck'}</h2>

                    {run.meta && (
                        <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <strong>A{run.meta.ascension}</strong> • {run.meta.outcome}
                            </span>
                            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                Floor <strong>{run.meta.floor}</strong>
                            </span>
                            {run.meta.time && (
                                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    Time: <strong>{run.meta.time}</strong>
                                </span>
                            )}
                            {run.meta.buildId && (
                                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    Patch <strong>{run.meta.buildId}</strong>
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {playersToRender.map((player, pIdx) => (
                    <div key={pIdx} style={{ marginBottom: pIdx < playersToRender.length - 1 ? '4rem' : '0' }}>
                        {playersToRender.length > 1 ? (
                            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'baseline', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                <h3 style={{ color: 'white', fontSize: '1.2rem', margin: 0 }}>{player.characterName}</h3>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{player.cards.reduce((acc, c) => acc + c.count, 0)} cards</span>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{player.cards.reduce((acc, c) => acc + c.count, 0)} cards</p>
                        )}

                        {player.relics && player.relics.length > 0 && (
                            <div className="relics-panel" style={{ marginBottom: '2rem' }}>
                                <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Relics</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                    {player.relics.map((relic, idx) => (
                                        <div
                                            key={idx}
                                            style={{ width: '56px', height: '56px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '4px', border: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
                                            onMouseEnter={(e) => showRelicTooltip(e, relic)}
                                            onMouseMove={updateTooltipPos}
                                            onMouseLeave={hideTooltip}
                                        >
                                            <img
                                                src={`${import.meta.env.BASE_URL}assets/relics/${relic}.webp`}
                                                alt={relic}
                                                style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.onerror = null;
                                                    target.style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="cards-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: '24px',
                            padding: '1rem 0'
                        }}>
                            {player.cards.map((card: CardData, index: number) => (
                                <div
                                    key={card.id + index}
                                    className="card-wrapper"
                                    style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden', cursor: 'default' }}
                                    onMouseEnter={(e) => showCardTooltip(e, card)}
                                    onMouseMove={updateTooltipPos}
                                    onMouseLeave={hideTooltip}
                                >
                                    <img
                                        src={`${import.meta.env.BASE_URL}assets/portraits/${getCardPortraitId(card)}.webp`}
                                        alt={card.id}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: '12px',
                                            border: '1px solid var(--surface-border)',
                                            backgroundColor: 'var(--surface-color)'
                                        }}
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.onerror = null;
                                            target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><rect width="100%" height="100%" fill="%23191c24"/><text x="50%" y="50%" fill="%2390929c" font-family="sans-serif" font-size="14" text-anchor="middle" dominant-baseline="middle">Image Missing</text></svg>';
                                        }}
                                    />
                                    {card.count > 1 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            background: 'rgba(0,0,0,0.8)',
                                            color: 'var(--accent-color)',
                                            padding: '4px 12px',
                                            borderRadius: '16px',
                                            fontWeight: 'bold',
                                            border: '1px solid rgba(214, 178, 81, 0.5)',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                                        }}>
                                            x{card.count}
                                        </div>
                                    )}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
                                        padding: '32px 12px 12px',
                                        pointerEvents: 'none'
                                    }}>
                                        <p style={{
                                            color: 'white',
                                            margin: 0,
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            textTransform: 'capitalize',
                                            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                            lineHeight: '1.2',
                                            overflowWrap: 'break-word',
                                            wordWrap: 'break-word',
                                            whiteSpace: 'normal',
                                        }}>
                                            {formatCardName(card.id)} {card.upgraded ? (card.upgrades > 1 ? `+${card.upgrades}` : '+') : ''}
                                        </p>
                                        {card.enchantment && (
                                            <p style={{
                                                color: 'var(--accent-color)',
                                                margin: 0,
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                textShadow: '0 2px 4px rgba(0,0,0,1)'
                                            }}>
                                                {card.enchantment}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {tooltipContent && (
            <Tooltip
                content={tooltipContent}
                x={tooltipPos.x}
                y={tooltipPos.y}
                visible={tooltipVisible}
            />
        )}
        </>
    );
}
