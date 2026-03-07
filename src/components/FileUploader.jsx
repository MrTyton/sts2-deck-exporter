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

    const processFiles = async (files) => {
        setError(null);
        if (!files || files.length === 0) return;

        const readPromises = Array.from(files).map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target.result);
                        if (!json.players || !json.players[0] || !json.players[0].deck) {
                            reject(new Error(`Invalid format in ${file.name}`));
                            return;
                        }
                        resolve(json);
                    } catch (err) {
                        reject(new Error(`Parse error in ${file.name}: ${err.message}`));
                    }
                };
                reader.onerror = () => reject(new Error(`Error reading ${file.name}`));
                reader.readAsText(file);
            });
        });

        try {
            const results = await Promise.all(readPromises);
            onDeckLoaded(results);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    }, [onDeckLoaded]);

    const handleFileInput = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
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
                multiple
                accept=".run,.backup,.save"
                style={{ display: 'none' }}
                onChange={handleFileInput}
            />
            <div style={{ pointerEvents: 'none' }}>
                <h2 style={{ marginBottom: '1rem', color: isDragging ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                    Drop Save/Run Files Here
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Select multiple .run or .backup files to view them all at once
                </p>
                <button className="btn-primary" style={{ pointerEvents: 'none' }}>Select Files</button>
            </div>
            {error && <div style={{ color: '#ff6b6b', marginTop: '1.5rem', fontWeight: 500 }}>{error}</div>}
        </div>
    );
}
