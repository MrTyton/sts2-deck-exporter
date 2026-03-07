import { useMemo, useCallback } from 'react';
import type { CardData, ImageExportMeta } from '../types';

export interface RunData {
    meta?: ImageExportMeta;
    cards?: CardData[];
    // Other properties from raw run might exist, but we care about these
}

export interface GalleryProps {
    runs: RunData[];
    onSelectRun: (index: number) => void;
    filters?: Record<string, string>;
    onFilterChange?: (filters: Record<string, string>) => void;
}

export function Gallery({ runs, onSelectRun, filters = {}, onFilterChange }: GalleryProps) {
    const characterFilter = filters.character || 'All';
    const outcomeFilter = filters.outcome || 'All';
    const ascensionFilter = filters.ascension || 'All';
    const sortBy = filters.sortBy || 'date_desc';

    const updateFilter = useCallback((key: string, value: string) => {
        if (onFilterChange) {
            onFilterChange({ ...filters, [key]: value });
        }
    }, [filters, onFilterChange]);

    const uniqueCharacters = useMemo(() => {
        const chars = new Set(runs.map(r => r.meta?.characterName || 'Unknown'));
        return ['All', ...Array.from(chars).sort()];
    }, [runs]);

    const uniqueOutcomes = useMemo(() => {
        const outcomes = new Set(runs.map(r => r.meta?.outcome || 'Unknown'));
        return ['All', ...Array.from(outcomes).sort()];
    }, [runs]);

    const uniqueAscensions = useMemo(() => {
        const ascensions = new Set(runs.map(r => r.meta?.ascension ?? 0));
        return ['All', ...Array.from(ascensions).sort((a: any, b: any) => Number(a) - Number(b)).map(String)];
    }, [runs]);

    const processedRuns = useMemo(() => {
        let result = runs.map((run, index) => ({ run, index }));

        if (characterFilter !== 'All') {
            result = result.filter(item => (item.run.meta?.characterName || 'Unknown') === characterFilter);
        }
        if (outcomeFilter !== 'All') {
            result = result.filter(item => (item.run.meta?.outcome || 'Unknown') === outcomeFilter);
        }
        if (ascensionFilter !== 'All') {
            result = result.filter(item => String(item.run.meta?.ascension ?? 0) === ascensionFilter);
        }

        result.sort((a, b) => {
            if (sortBy === 'date_desc') return b.index - a.index;
            if (sortBy === 'date_asc') return a.index - b.index;
            if (sortBy === 'asc_desc') return Number(b.run.meta?.ascension || 0) - Number(a.run.meta?.ascension || 0);
            if (sortBy === 'asc_asc') return Number(a.run.meta?.ascension || 0) - Number(b.run.meta?.ascension || 0);

            const getFloor = (f: string | number | undefined) => f === '?' || f === undefined ? -1 : parseInt(String(f), 10);
            if (sortBy === 'floor_desc') return getFloor(b.run.meta?.floor) - getFloor(a.run.meta?.floor);
            if (sortBy === 'floor_asc') return getFloor(a.run.meta?.floor) - getFloor(b.run.meta?.floor);
            return 0;
        });

        return result;
    }, [runs, characterFilter, outcomeFilter, ascensionFilter, sortBy]);

    if (!runs || runs.length === 0) return null;

    const selectStyle = {
        padding: '0.4rem 0.8rem',
        borderRadius: '8px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: 'var(--text-color)',
        border: '1px solid var(--surface-border)',
        outline: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.9rem'
    };

    const labelStyle = {
        fontSize: '0.9rem',
        color: 'var(--text-secondary)'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel" style={{ display: 'flex', gap: '15px', padding: '15px', borderRadius: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={labelStyle}>Character</label>
                    <select style={selectStyle} value={characterFilter} onChange={e => updateFilter('character', e.target.value)}>
                        {uniqueCharacters.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={labelStyle}>Outcome</label>
                    <select style={selectStyle} value={outcomeFilter} onChange={e => updateFilter('outcome', e.target.value)}>
                        {uniqueOutcomes.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={labelStyle}>Ascension</label>
                    <select style={selectStyle} value={ascensionFilter} onChange={e => updateFilter('ascension', e.target.value)}>
                        {uniqueAscensions.map(a => <option key={a} value={a}>{a === 'All' ? 'All' : `A${a}`}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
                    <label style={labelStyle}>Sort By</label>
                    <select style={selectStyle} value={sortBy} onChange={e => updateFilter('sortBy', e.target.value)}>
                        <option value="date_desc">Newest First</option>
                        <option value="date_asc">Oldest First</option>
                        <option value="asc_desc">Ascension (High-Low)</option>
                        <option value="asc_asc">Ascension (Low-High)</option>
                        <option value="floor_desc">Floor (High-Low)</option>
                        <option value="floor_asc">Floor (Low-High)</option>
                    </select>
                </div>
            </div>

            {processedRuns.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', borderRadius: '12px' }}>
                    No runs match the selected filters.
                </div>
            ) : (
                <div className="gallery-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                    {processedRuns.map(({ run, index }) => {
                        // Determine background images from the first 3 non-starter cards in the deck
                        const starterIds = [
                            'strike', 'defend', 'strike_ironclad', 'defend_ironclad',
                            'strike_silent', 'defend_silent', 'strike_defect', 'defend_defect',
                            'strike_necrobinder', 'defend_necrobinder', 'strike_regent', 'defend_regent'
                        ];
                        let bgCards: CardData[] = [];
                        if (run.cards && run.cards.length > 0) {
                            bgCards = run.cards.filter(c => !starterIds.includes(c.id)).slice(0, 1);
                            if (bgCards.length === 0) bgCards = run.cards.slice(0, 1); // Fallback
                        }

                        return (
                            <div
                                key={index}
                                className="run-tile glass-panel"
                                style={{
                                    padding: '1.5rem',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    borderRadius: '16px',
                                    minHeight: '150px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    border: '1px solid var(--surface-border)',
                                    transition: 'all 0.2s ease'
                                }}
                                onClick={() => onSelectRun(index)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent-color)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--surface-border)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                {/* Background Images */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    zIndex: 0,
                                    opacity: 0.2, // dim the background so text is readable
                                    filter: 'blur(1px)' // slight blur
                                }}>
                                    {bgCards.map((card, i) => (
                                        <img
                                            key={i}
                                            src={`${import.meta.env.BASE_URL}assets/portraits/${card.id}.webp`}
                                            alt=""
                                            style={{
                                                flex: 1,
                                                height: '100%',
                                                objectFit: 'cover',
                                                backgroundColor: 'var(--surface-color)',
                                                borderLeft: i > 0 ? '2px solid rgba(0,0,0,0.5)' : 'none'
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    ))}
                                </div>

                                {/* Foreground Content */}
                                <div style={{ position: 'relative', zIndex: 1, backgroundColor: 'rgba(0,0,0,0.6)', padding: '10px 15px', borderRadius: '12px', width: '90%' }}>
                                    <h3 style={{ color: 'var(--accent-color)', margin: '0 0 0.5rem 0', fontSize: '1.25rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                        {run.meta?.characterName || 'Unknown'}
                                    </h3>
                                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                                        A{run.meta?.ascension || 0} • Floor {run.meta?.floor || '?'}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                                        {run.meta?.outcome || 'Unknown'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
