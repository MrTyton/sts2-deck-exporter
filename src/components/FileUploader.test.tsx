import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, describe, it, vi } from 'vitest';
import { FileUploader } from './FileUploader';

describe('FileUploader', () => {
    it('renders the upload area correctly', () => {
        render(<FileUploader onDeckLoaded={() => { }} />);
        expect(screen.getByText('Drop Save/Run Files Here')).toBeInTheDocument();
        expect(screen.getByText('Select Files')).toBeInTheDocument();
    });

    it('changes styling on drag enter and leave', () => {
        const { container } = render(<FileUploader onDeckLoaded={() => { }} />);
        const uploaderDiv = container.firstChild as HTMLDivElement;

        expect(uploaderDiv.className).not.toContain('dragging');

        fireEvent.dragEnter(uploaderDiv);
        expect(uploaderDiv.className).toContain('dragging');

        fireEvent.dragLeave(uploaderDiv);
        expect(uploaderDiv!.className).not.toContain('dragging');
    });

    it('displays an error if the JSON is invalid', async () => {
        const file = new File(['invalid json text'], 'test.run', { type: 'text/plain' });

        const { container } = render(<FileUploader onDeckLoaded={() => { }} />);
        const input = container.querySelector('#file-upload');

        fireEvent.change(input!, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByText(/Parse error in test.run:/)).toBeInTheDocument();
        });
    });

    it('displays an error if the JSON format is unexpected (no players array)', async () => {
        const file = new File([JSON.stringify({ someKey: 'value' })], 'test.run', { type: 'application/json' });

        const { container } = render(<FileUploader onDeckLoaded={() => { }} />);
        const input = container.querySelector('#file-upload');

        fireEvent.change(input!, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByText(/Invalid format in test.run/)).toBeInTheDocument();
        });
    });

    it('successfully processes valid files and calls onDeckLoaded', async () => {
        const validJson = {
            players: [
                { deck: [{ id: "STRIKE" }] }
            ]
        };
        const file = new File([JSON.stringify(validJson)], 'test.run', { type: 'application/json' });
        const onDeckLoadedMock = vi.fn();

        const { container } = render(<FileUploader onDeckLoaded={onDeckLoadedMock} />);
        const input = container.querySelector('#file-upload');

        fireEvent.change(input!, { target: { files: [file] } });

        await waitFor(() => {
            expect(onDeckLoadedMock).toHaveBeenCalledTimes(1);
            expect(onDeckLoadedMock).toHaveBeenCalledWith([validJson]);
        });
    });

    it('applies compact styling when the compact prop is true', () => {
        const { container } = render(<FileUploader onDeckLoaded={() => { }} compact={true} />);
        const uploaderDiv = container.firstChild as HTMLDivElement;

        // Check for reduced padding (0.5rem 1rem)
        expect(uploaderDiv.style.padding).toBe('0.5rem 1rem');

        // Check for "Upload More Runs" text
        expect(screen.getByText('Upload More Runs')).toBeInTheDocument();
        // H2 should NOT be there in compact mode
        expect(screen.queryByText('Drop Save/Run Files Here')).not.toBeInTheDocument();
    });
});
