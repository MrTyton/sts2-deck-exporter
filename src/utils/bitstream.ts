export class BitWriter {
    private bytes: number[] = [];
    private currentByte: number = 0;
    private bitsInCurrentByte: number = 0;

    /**
     * Write an integer `value` using exactly `numBits`.
     */
    write(value: number, numBits: number) {
        // Mask the value to ensure it fits in numBits
        const mask = (1 << numBits) - 1;
        value = value & mask;

        let bitsLeftToWrite = numBits;

        while (bitsLeftToWrite > 0) {
            const spaceInCurrent = 8 - this.bitsInCurrentByte;

            if (bitsLeftToWrite <= spaceInCurrent) {
                // We can fit all remaining bits in the current byte
                // Shift them up to their position
                this.currentByte |= (value << (spaceInCurrent - bitsLeftToWrite));
                this.bitsInCurrentByte += bitsLeftToWrite;
                bitsLeftToWrite = 0;
            } else {
                // We need to write across a byte boundary
                const bitsToWriteToCurrent = spaceInCurrent;
                const bitsLeftOver = bitsLeftToWrite - bitsToWriteToCurrent;

                // Shift down so only the top bits fit in the current byte
                const topBits = (value >>> bitsLeftOver) & ((1 << bitsToWriteToCurrent) - 1);
                this.currentByte |= topBits;

                this.flush();
                bitsLeftToWrite = bitsLeftOver;
                // Keep only the remaining bits in `value`
                value &= (1 << bitsLeftToWrite) - 1;
            }

            if (this.bitsInCurrentByte === 8) {
                this.flush();
            }
        }
    }

    /**
     * Write a boolean as 1 bit
     */
    writeBool(value: boolean) {
        this.write(value ? 1 : 0, 1);
    }

    private flush() {
        if (this.bitsInCurrentByte > 0) {
            this.bytes.push(this.currentByte);
            this.currentByte = 0;
            this.bitsInCurrentByte = 0;
        }
    }

    getUint8Array(): Uint8Array {
        // Flush any trailing bits aligned to the top
        if (this.bitsInCurrentByte > 0) {
            this.bytes.push(this.currentByte);
        }
        return new Uint8Array(this.bytes);
    }
}

export class BitReader {
    private bytes: Uint8Array;
    private byteIndex: number = 0;
    private bitIndex: number = 0;

    constructor(bytes: Uint8Array) {
        this.bytes = bytes;
    }

    /**
     * Read an integer value from the next `numBits`
     */
    read(numBits: number): number {
        let result = 0;
        let bitsLeftToRead = numBits;

        while (bitsLeftToRead > 0) {
            if (this.byteIndex >= this.bytes.length) {
                // End of stream, return what we have so far
                // In a perfect system this wouldn't trigger unless corrupted
                return result << bitsLeftToRead;
            }

            const bitsAvailableInCurrent = 8 - this.bitIndex;
            const currentByte = this.bytes[this.byteIndex];

            if (bitsLeftToRead <= bitsAvailableInCurrent) {
                // We can read all remaining bits from this byte
                // Shift down to drop the trailing bits we don't need
                const shiftDown = bitsAvailableInCurrent - bitsLeftToRead;
                const mask = ((1 << bitsLeftToRead) - 1) << shiftDown;
                const extracted = (currentByte & mask) >>> shiftDown;

                result = (result << bitsLeftToRead) | extracted;
                this.bitIndex += bitsLeftToRead;
                bitsLeftToRead = 0;
            } else {
                // We need more bits than this byte has left
                // Take all remaining bits in this byte
                const mask = (1 << bitsAvailableInCurrent) - 1;
                const extracted = currentByte & mask;

                result = (result << bitsAvailableInCurrent) | extracted;

                // Move to next byte
                this.byteIndex++;
                this.bitIndex = 0;
                bitsLeftToRead -= bitsAvailableInCurrent;
            }

            if (this.bitIndex === 8) {
                this.byteIndex++;
                this.bitIndex = 0;
            }
        }

        return result;
    }

    readBool(): boolean {
        return this.read(1) === 1;
    }
}
