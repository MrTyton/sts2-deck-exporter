import { useState, useCallback } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

export interface FileUploaderProps {
    onDeckLoaded: (results: any[]) => void;
}

export function FileUploader({ onDeckLoaded }: FileUploaderProps) {
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

    const handleSelectFiles = async () => {
        // Use File System Access API if available
        if ('showOpenFilePicker' in window) {
            try {
                const fileHandles = await (window as any).showOpenFilePicker({
                    multiple: true,
                    id: 'sts2-runs', // Remember the last directory for this specific picker
                    types: [
                        {
                            description: 'Slay the Spire 2 Run/Save Files',
                            accept: {
                                'application/json': ['.run', '.backup', '.save']
                            }
                        }
                    ]
                });

                const files = await Promise.all(fileHandles.map((handle: any) => handle.getFile()));
                processFiles(files);
            } catch (err: any) {
                // User cancelled or other error
                if (err.name !== 'AbortError') {
                    console.error('File picker error:', err);
                    // Fallback to traditional input if something went wrong
                    const input = document.getElementById('file-upload');
                    if (input) input.click();
                }
            }
        } else {
            // Fallback for browsers without File System Access API (like Firefox)
            const input = document.getElementById('file-upload');
            if (input) input.click();
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
            <div style={{ pointerEvents: 'none' }}>
                <h2 style={{ marginBottom: '1rem', color: isDragging ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                    Drop Save/Run Files Here
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Select or drag and drop multiple .run or .backup files to view them all at once
                </p>
                <button className="btn-primary" style={{ pointerEvents: 'none' }}>Select Files</button>
            </div>
            {error && <div style={{ color: '#ff6b6b', marginTop: '1.5rem', fontWeight: 500 }}>{error}</div>}
        </div>
    );
}
