export class BitWriter {
    private bytes: number[] = [];
    private buffer: number = 0; // 32-bit buffer
    private count: number = 0;  // number of bits in buffer

    /**
     * Write an integer `value` using exactly `numBits`.
     */
    write(value: number, numBits: number) {
        if (numBits === 0) return;

        // Mask the value to ensure it fits in numBits
        const mask = numBits >= 32 ? 0xffffffff : (1 << numBits) - 1;
        value = (value & mask) >>> 0; // Ensure unsigned 32-bit

        // Add to buffer
        // We fill the buffer from left to right (top bits first)
        // This is easier if we just maintain 'count' bits and push out from the top
        for (let i = numBits - 1; i >= 0; i--) {
            const bit = (value >>> i) & 1;
            this.buffer = (this.buffer << 1) | bit;
            this.count++;

            if (this.count === 8) {
                this.bytes.push(this.buffer & 0xff);
                this.buffer = 0;
                this.count = 0;
            }
        }
    }

    writeBool(value: boolean) {
        this.write(value ? 1 : 0, 1);
    }

    getUint8Array(): Uint8Array {
        if (this.count > 0) {
            // Shift remaining bits to the left to align with byte boundary
            const finalByte = (this.buffer << (8 - this.count)) & 0xff;
            this.bytes.push(finalByte);
            this.buffer = 0;
            this.count = 0;
        }
        const arr = new Uint8Array(this.bytes);
        this.bytes = [];
        return arr;
    }
}

export class BitReader {
    private bytes: Uint8Array;
    private byteIndex: number = 0;
    private bitIndex: number = 0; // 0 to 7, from MSB to LSB

    constructor(bytes: Uint8Array) {
        this.bytes = bytes;
    }

    read(numBits: number): number {
        if (numBits === 0) return 0;

        let result = 0;
        for (let i = 0; i < numBits; i++) {
            if (this.byteIndex >= this.bytes.length) {
                // End of stream
                return result << (numBits - i);
            }

            const currentByte = this.bytes[this.byteIndex];
            const bit = (currentByte >>> (7 - this.bitIndex)) & 1;

            result = (result << 1) | bit;

            this.bitIndex++;
            if (this.bitIndex === 8) {
                this.byteIndex++;
                this.bitIndex = 0;
            }
        }

        return result >>> 0; // Ensure unsigned
    }

    readBool(): boolean {
        return this.read(1) === 1;
    }
}
