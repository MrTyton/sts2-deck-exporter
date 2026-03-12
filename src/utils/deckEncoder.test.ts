import { describe, it, expect } from 'vitest';
import { BitWriter, BitReader } from './bitstream';
import { encodeRun, decodeRun } from './deckEncoder';
import type { RunData } from '../types';

describe('Bitstream Utility', () => {
    it('writes and reads basic integers accurately across byte boundaries', () => {
        const writer = new BitWriter();

        // Write 3 bits, then 11 bits, then 5 bits
        writer.write(5, 3); // 101
        writer.write(1023, 11);
        writer.write(15, 5);
        writer.write(0, 1); // False boolean
        writer.write(1, 1); // True boolean

        const buffer = writer.getUint8Array();
        const reader = new BitReader(buffer);

        expect(reader.read(3)).toBe(5);
        expect(reader.read(11)).toBe(1023);
        expect(reader.read(5)).toBe(15);
        expect(reader.readBool()).toBe(false);
        expect(reader.readBool()).toBe(true);
    });
});

describe('Deck Encoder', () => {
    it('accurately encodes and decodes a complex run payload', () => {
        const sampleRun: RunData = {
            meta: {
                ascension: 20,
                floor: 50,
                outcome: 'Victory',
                time: '1:23:45',
                characterName: 'Ironclad'
            },
            players: [
                {
                    characterName: 'ironclad',
                    relics: ['vajra', 'war_hammer'],
                    cards: [
                        { id: 'bash', upgraded: true, upgrades: 1, enchantment: null, count: 4 },
                        { id: 'defend_ironclad', upgraded: false, upgrades: 0, enchantment: null, count: 4 },
                        { id: 'anger', upgraded: true, upgrades: 1, enchantment: 'sharp', count: 1 }
                    ]
                }
            ]
        };

        const encodedStr = encodeRun(sampleRun);
        expect(encodedStr).toBeTruthy();
        expect(typeof encodedStr).toBe('string');

        // The length should be incredibly short compared to JSON
        // Console log to see it during test runs
        console.log(`Encoded URL hash: #d=${encodedStr} (Length: ${encodedStr?.length})`);

        const decodedRun = decodeRun(encodedStr!);

        expect(decodedRun).not.toBeNull();
        expect(decodedRun!.meta?.ascension).toBe(20);
        expect(decodedRun!.meta?.floor).toBe(50);
        expect(decodedRun!.meta?.outcome).toBe('Victory');
        expect(decodedRun!.meta?.time).toBe('1:23:45');
        expect(decodedRun!.meta?.characterName).toBe('Ironclad');

        expect(decodedRun!.players?.length).toBe(1);

        const player = decodedRun!.players![0];
        expect(player.characterName.toLowerCase()).toBe('ironclad');
        expect(player.relics).toContain('vajra');
        expect(player.relics).toContain('war_hammer');

        expect(player.cards.length).toBe(3);
        expect(player.cards[0].id).toBe('bash');
        expect(player.cards[0].upgraded).toBe(true);
        expect(player.cards[0].count).toBe(4);

        expect(player.cards[1].id).toBe('defend_ironclad');

        expect(player.cards[2].id).toBe('anger');
        expect(player.cards[2].upgraded).toBe(true);
        expect(player.cards[2].enchantment).toBe('sharp');
    });
});
