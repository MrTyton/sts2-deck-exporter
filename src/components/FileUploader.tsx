import { useState, useCallback } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

export interface FileUploaderProps {
    onDeckLoaded: (results: any[]) => void;
    compact?: boolean;
}

export function FileUploader({ onDeckLoaded, compact = false }: FileUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDrag = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragIn = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragOut = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const processFiles = async (files: FileList | File[]) => {
        setError(null);
        if (!files || files.length === 0) return;

        const readPromises = Array.from(files).map(file => {
            return new Promise<any>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target?.result as string);
                        if (!json.players || !json.players[0] || !json.players[0].deck) {
                            reject(new Error(`Invalid format in ${file.name}`));
                            return;
                        }
                        resolve(json);
                    } catch (err: any) {
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
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    }, [onDeckLoaded]);

    const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
        }
    };

    const handleSelectFiles = () => {
        // Trigger the traditional file input
        // This is more compatible than showOpenFilePicker which blocks "system" folders like Program Files
        const input = document.getElementById('file-upload');
        if (input) {
            (input as HTMLInputElement).value = ''; // Reset to allow re-selecting same file
            input.click();
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
                padding: compact ? '0.5rem 1rem' : '3rem 2rem',
                textAlign: 'center',
                borderStyle: (compact || isDragging) ? 'dashed' : 'solid',
                borderWidth: compact ? '2.5px' : '1px',
                borderColor: (compact || isDragging) ? 'var(--accent-color)' : 'var(--surface-border)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                display: compact ? 'inline-flex' : 'block',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: compact ? '44px' : 'auto',
                width: compact ? 'auto' : '100%',
                margin: compact ? '0' : '0 auto' // Remove '0 auto' for left alignment in parent grid
            }}
            onClick={handleSelectFiles}
        >
            <input
                id="file-upload"
                type="file"
                multiple
                accept=".run,.backup,.save"
                style={{ display: 'none' }}
                onChange={handleFileInput}
            />
            {compact ? (
                <div style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.9rem', color: isDragging ? 'var(--accent-color)' : 'var(--text-primary)', fontWeight: 600 }}>
                        {isDragging ? 'Drop Files Here' : 'Upload More Runs'}
                    </span>
                </div>
            ) : (
                <div style={{ pointerEvents: 'none' }}>
                    <h2 style={{
                        marginBottom: '1rem',
                        fontSize: '2rem',
                        color: isDragging ? 'var(--accent-color)' : 'var(--text-primary)'
                    }}>
                        Drop Save/Run Files Here
                    </h2>
                    <p style={{
                        color: 'var(--text-secondary)',
                        marginBottom: '2rem',
                        fontSize: '1rem'
                    }}>
                        Select or drag and drop multiple .run or .backup files to add them to your collection
                    </p>
                    <button className="btn-primary" style={{
                        pointerEvents: 'none'
                    }}>Select Files</button>
                </div>
            )}
            {error && <div style={{ color: '#ff6b6b', marginTop: compact ? '0' : '1.5rem', marginLeft: compact ? '1rem' : '0', fontWeight: 500, fontSize: compact ? '0.8rem' : '1rem' }}>{error}</div>}
        </div>
    );
}
