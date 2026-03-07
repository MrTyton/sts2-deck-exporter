import React, { useState, useCallback } from 'react';

export function FileUploader({ onDeckLoaded }) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState(null);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragIn = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragOut = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const processFile = (file) => {
        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (!json.players || !json.players[0] || !json.players[0].deck) {
                    throw new Error('Invalid save file format: Could not find deck array.');
                }

                // Pass the whole JSON so App can extract relics and run metadata
                onDeckLoaded(json);
            } catch (err) {
                setError('Failed to parse file: ' + err.message);
            }
        };
        reader.onerror = () => setError('Error reading the file.');
        reader.readAsText(file);
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    }, [onDeckLoaded]);

    const handleFileInput = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    return (
        <div
            className={`glass-panel uploader ${isDragging ? 'dragging' : ''}`}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                borderStyle: isDragging ? 'dashed' : 'solid',
                borderColor: isDragging ? 'var(--accent-color)' : 'var(--surface-border)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
            }}
            onClick={() => document.getElementById('file-upload').click()}
        >
            <input
                id="file-upload"
                type="file"
                accept=".run,.backup,.save"
                style={{ display: 'none' }}
                onChange={handleFileInput}
            />
            <div style={{ pointerEvents: 'none' }}>
                <h2 style={{ marginBottom: '1rem', color: isDragging ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                    Drop your Save/Run File Here
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Accepts .run, current_run.save.backup files
                </p>
                <button className="btn-primary" style={{ pointerEvents: 'none' }}>Select File</button>
            </div>
            {error && <div style={{ color: '#ff6b6b', marginTop: '1.5rem', fontWeight: 500 }}>{error}</div>}
        </div>
    );
}
