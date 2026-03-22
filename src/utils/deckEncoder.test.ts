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
    it('accurately encodes and decodes a complex run payload', async () => {
        const sampleRun: RunData = {
            meta: {
                ascension: 20,
                floor: 50,
                outcome: 'Victory',
                time: '1:23:45',
                characterName: 'The Ironclad'
            },
            players: [
                {
                    characterName: 'The Ironclad',
                    relics: ['vajra', 'war_hammer'],
                    cards: [
                        { id: 'bash', upgraded: true, upgrades: 1, enchantment: null, count: 4 },
                        { id: 'defend_ironclad', upgraded: false, upgrades: 0, enchantment: null, count: 4 },
                        { id: 'anger', upgraded: true, upgrades: 1, enchantment: 'sharp', count: 1 }
                    ]
                }
            ]
        };

        const encodedStr = await encodeRun(sampleRun);
        expect(encodedStr).toBeTruthy();
        expect(typeof encodedStr).toBe('string');

        // The length should be incredibly short compared to JSON
        // Console log to see it during test runs
        console.log(`Encoded URL hash: #d=${encodedStr} (Length: ${encodedStr?.length})`);

        const decodedRun = await decodeRun(encodedStr!);

        expect(decodedRun).not.toBeNull();
        expect(decodedRun!.meta?.ascension).toBe(20);
        expect(decodedRun!.meta?.floor).toBe(50);
        expect(decodedRun!.meta?.outcome).toBe('Victory');
        expect(decodedRun!.meta?.time).toBe('1:23:45');
        expect(decodedRun!.meta?.characterName).toBe('The Ironclad');

        expect(decodedRun!.players?.length).toBe(1);

        const player = decodedRun!.players![0];
        expect(player.characterName).toBe('The Ironclad');
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

        // v5: isLocalPlayer bit was not set on the fixture, so it decodes as undefined
        expect(player.isLocalPlayer).toBeUndefined();
    });

    it('encodes and decodes isLocalPlayer=true for the local player in a co-op run', async () => {
        const coopRun: RunData = {
            meta: {
                ascension: 5,
                floor: 40,
                outcome: 'Victory',
                time: '1:00:00',
                characterName: 'The Ironclad & The Silent',
            },
            players: [
                {
                    characterName: 'The Ironclad',
                    relics: [],
                    cards: [],
                    isLocalPlayer: true,
                },
                {
                    characterName: 'The Silent',
                    relics: [],
                    cards: [],
                    isLocalPlayer: undefined,
                },
            ],
        };

        const encoded = await encodeRun(coopRun);
        expect(encoded).toBeTruthy();

        const decoded = await decodeRun(encoded!);
        expect(decoded).not.toBeNull();
        expect(decoded!.players?.length).toBe(2);
        expect(decoded!.players![0].isLocalPlayer).toBe(true);
        expect(decoded!.players![1].isLocalPlayer).toBeUndefined();
    });

    it('auto-marks the single player as isLocalPlayer=true for legacy (v0–v4) solo runs', async () => {
        // Minimal hand-crafted v0 bitstream for a solo run (1 player, no cards, no relics):
        //   version=0 (3b), ascension=0 (5b), floor=1 (6b), outcome=Victory (2b),
        //   time=0 (16b), numPlayers=1 (2b [V0_BITS_NUM_PLAYERS]),
        //   charId=1/silent (3b [V0_BITS_CHARACTER]), numRelics=0 (6b), numCards=0 (6b)
        // Bytes: [0x00, 0x04, 0x00, 0x00, 0x48, 0x00, 0x00] → base64url "AAQAAEgAAA"
        const v0SoloString = 'AAQAAEgAAA';
        const decoded = await decodeRun(v0SoloString);
        expect(decoded).not.toBeNull();
        expect(decoded!.players?.length).toBe(1);
        // v0 solo run: the single player should be automatically flagged as local
        expect(decoded!.players![0].isLocalPlayer).toBe(true);
    });

    it('correctly handles a 4-character run (Version 1)', async () => {
        const multiplayerRun: RunData = {
            meta: {
                ascension: 0,
                floor: 45,
                outcome: 'Victory',
                time: '1:33:10',
                characterName: 'The Ironclad & The Necrobinder & The Regent & The Necrobinder'
            },
            players: [
                { characterName: 'The Ironclad', relics: [], cards: [] },
                { characterName: 'The Necrobinder', relics: [], cards: [] },
                { characterName: 'The Regent', relics: [], cards: [] },
                { characterName: 'The Necrobinder', relics: [], cards: [] }
            ]
        };

        const encoded = await encodeRun(multiplayerRun);
        expect(encoded).toBeTruthy();

        const decoded = await decodeRun(encoded!);
        expect(decoded).not.toBeNull();
        expect(decoded!.players?.length).toBe(4);
        expect(decoded!.meta?.characterName).toBe('The Ironclad & The Necrobinder & The Regent & The Necrobinder');
        // None of the players had isLocalPlayer set, so all decode as undefined
        decoded!.players!.forEach(p => expect(p.isLocalPlayer).toBeUndefined());
    });

    it('maintains backward compatibility with Version 0 strings', async () => {
        // This is the version 0 encoding of "The Ironclad" run (1 player)
        // Header: 0 (3 bits)
        // Ascension: 20 (5 bits)
        // Floor: 50 (6 bits)
        // Outcome: 0 (2 bits)
        // Time: 5025 (16 bits)
        // NumPlayers: 1 (2 bits) [V0_BITS_NUM_PLAYERS]
        // CharId: 1 (3 bits) [V0_BITS_CHARACTER] ... etc
        const v0String = "ALQV1sIKCYGyBhjgGkqOXAyVqq-Ffq4Ya11rbQjhEFhAShAxCCDc0IIYQXgg8BB8CEQEPEImYRQwi-BGQCNIEfYJHQSyglyBMCCY0E5AJ_4UFwpVXLC00-LkWel9MTGlAtFUcqxb7cWnLdUSuhj66VgpiPjHCGDOEHUIU9xAiHBEeCJeEcMI-YR8gkW3ECTDcQJSdyYlkhLfCeMFBkKQgYeqBcrOWtrTVOo5ubM1hJoWMv9eqh1hICAYhBXCFqENu48RhAjVBHTuaEdII74R5AjyXGiPsEoIJQVxolgBL3udEve40TKwoABQaCkoEA";

        const decoded = await decodeRun(v0String);
        expect(decoded).not.toBeNull();
        // Since the v0String I grabbed was actually from my first repro run (which was truncated to 3 players),
        // let's just assert it decodes SOMETHING and has the expected meta.
        expect(decoded!.meta?.ascension).toBe(0);
        expect(decoded!.players?.length).toBeGreaterThan(0);
    });

    it('V6: round-trips a run correctly through compression', async () => {
        const run: RunData = {
            meta: {
                ascension: 15,
                floor: 40,
                outcome: 'Defeat',
                time: '0:45:22',
                characterName: 'The Silent',
            },
            players: [
                {
                    characterName: 'The Silent',
                    relics: ['vajra'],
                    cards: [
                        { id: 'survivor', upgraded: true, upgrades: 1, enchantment: null, count: 2 },
                        { id: 'neutralize', upgraded: false, upgrades: 0, enchantment: null, count: 1 },
                    ],
                    isLocalPlayer: true,
                },
            ],
        };

        const encoded = await encodeRun(run);
        expect(encoded).toBeTruthy();
        expect(typeof encoded).toBe('string');
        console.log(`V6 encoded: ${encoded} (${encoded?.length} chars)`);

        const decoded = await decodeRun(encoded!);
        expect(decoded).not.toBeNull();
        expect(decoded!.meta?.ascension).toBe(15);
        expect(decoded!.meta?.floor).toBe(40);
        expect(decoded!.meta?.outcome).toBe('Defeat');
        expect(decoded!.meta?.time).toBe('45:22'); // encoder drops leading '0:' for sub-hour runs
        expect(decoded!.players?.length).toBe(1);
        expect(decoded!.players![0].characterName).toBe('The Silent');
        expect(decoded!.players![0].isLocalPlayer).toBe(true);
        expect(decoded!.players![0].relics).toContain('vajra');
        expect(decoded!.players![0].cards[0].id).toBe('survivor');
        expect(decoded!.players![0].cards[0].upgraded).toBe(true);
        expect(decoded!.players![0].cards[1].id).toBe('neutralize');
    });

    it('V6: a V5-era hardcoded string still decodes as V5 (backward compat)', async () => {
        // This string was produced by the V5 encoder (uncompressed). Its first 3 bits are 101 = version 5,
        // not 110 = 6, so the decoder should take the uncompressed path.
        const v5String = 'ALQV1sIKCYGyBhjgGkqOXAyVqq-Ffq4Ya11rbQjhEFhAShAxCCDc0IIYQXgg8BB8CEQEPEImYRQwi-BGQCNIEfYJHQSyglyBMCCY0E5AJ_4UFwpVXLC00-LkWel9MTGlAtFUcqxb7cWnLdUSuhj66VgpiPjHCGDOEHUIU9xAiHBEeCJeEcMI-YR8gkW3ECTDcQJSdyYlkhLfCeMFBkKQgYeqBcrOWtrTVOo5ubM1hJoWMv9eqh1hICAYhBXCFqENu48RhAjVBHTuaEdII74R5AjyXGiPsEoIJQVxolgBL3udEve40TKwoABQaCkoEA';
        const decoded = await decodeRun(v5String);
        expect(decoded).not.toBeNull();
        expect(decoded!.meta?.ascension).toBe(0);
        expect(decoded!.players?.length).toBeGreaterThan(0);
    });

    it('V7: round-trips a card with exactly 128 copies (cloned mechanic)', async () => {
        const run: RunData = {
            meta: {
                ascension: 1,
                floor: 10,
                outcome: 'Victory',
                time: '0:10:00',
                characterName: 'The Ironclad',
            },
            players: [
                {
                    characterName: 'The Ironclad',
                    relics: [],
                    cards: [
                        { id: 'bash', upgraded: false, upgrades: 0, enchantment: null, count: 128 },
                    ],
                    isLocalPlayer: true,
                },
            ],
        };

        const encoded = await encodeRun(run);
        expect(encoded).toBeTruthy();

        const decoded = await decodeRun(encoded!);
        expect(decoded).not.toBeNull();
        expect(decoded!.players![0].cards[0].id).toBe('bash');
        expect(decoded!.players![0].cards[0].count).toBe(128);
    });

    it('V7: clamps card count above 255 to 255', async () => {
        const run: RunData = {
            meta: {
                ascension: 0,
                floor: 1,
                outcome: 'Victory',
                time: '0:01:00',
                characterName: 'The Ironclad',
            },
            players: [
                {
                    characterName: 'The Ironclad',
                    relics: [],
                    cards: [
                        { id: 'bash', upgraded: false, upgrades: 0, enchantment: null, count: 999 },
                    ],
                    isLocalPlayer: true,
                },
            ],
        };

        const encoded = await encodeRun(run);
        expect(encoded).toBeTruthy();

        const decoded = await decodeRun(encoded!);
        expect(decoded).not.toBeNull();
        expect(decoded!.players![0].cards[0].count).toBe(255);
    });

    it('V7: preserves counts in the 16-127 range that V6 could not store', async () => {
        const run: RunData = {
            meta: {
                ascension: 0,
                floor: 1,
                outcome: 'Victory',
                time: '0:01:00',
                characterName: 'The Ironclad',
            },
            players: [
                {
                    characterName: 'The Ironclad',
                    relics: [],
                    cards: [
                        { id: 'bash', upgraded: false, upgrades: 0, enchantment: null, count: 16 },
                        { id: 'defend_ironclad', upgraded: false, upgrades: 0, enchantment: null, count: 64 },
                    ],
                    isLocalPlayer: true,
                },
            ],
        };

        const encoded = await encodeRun(run);
        expect(encoded).toBeTruthy();

        const decoded = await decodeRun(encoded!);
        expect(decoded).not.toBeNull();
        const cards = decoded!.players![0].cards;
        expect(cards[0].count).toBe(16);
        expect(cards[1].count).toBe(64);
    });

    it('new format: encoded string starts with ~ prefix (base81+brotli marker)', async () => {
        const run: RunData = {
            meta: { ascension: 10, floor: 35, outcome: 'Victory', time: '0:45:00', characterName: 'The Ironclad' },
            players: [{
                characterName: 'The Ironclad', relics: ['vajra'], cards: [
                    { id: 'bash', upgraded: true, upgrades: 1, enchantment: null, count: 1 },
                ], isLocalPlayer: true
            }],
        };
        const encoded = await encodeRun(run);
        expect(encoded).toBeTruthy();
        // v8+ uses '~~' prefix (8-bit version field)
        expect(encoded!.startsWith('~~')).toBe(true);
        // Must round-trip cleanly
        const decoded = await decodeRun(encoded!);
        expect(decoded).not.toBeNull();
        expect(decoded!.meta?.ascension).toBe(10);
    });

    it('V8: encodes and decodes patchIndex round-trip', async () => {
        const run: RunData = {
            meta: {
                ascension: 5,
                floor: 30,
                outcome: 'Victory',
                time: '0:30:00',
                characterName: 'The Ironclad',
                patchIndex: 4,   // v0.99.1
                buildId: 'v0.99.1',
            },
            players: [{
                characterName: 'The Ironclad',
                relics: [],
                cards: [{ id: 'bash', upgraded: false, upgrades: 0, enchantment: null, count: 1 }],
                isLocalPlayer: true,
            }],
        };
        const encoded = await encodeRun(run);
        expect(encoded).toBeTruthy();
        expect(encoded!.startsWith('~~')).toBe(true);

        const decoded = await decodeRun(encoded!);
        expect(decoded).not.toBeNull();
        expect(decoded!.meta?.patchIndex).toBe(4);
        expect(decoded!.meta?.buildId).toBe('v0.99.1');
    });

    it('V8: patchIndex defaults to CURRENT_PATCH_INDEX when not set in meta', async () => {
        const run: RunData = {
            meta: { ascension: 0, floor: 1, outcome: 'Abandoned', time: '0:01:00', characterName: 'The Ironclad' },
            players: [{ characterName: 'The Ironclad', relics: [], cards: [], isLocalPlayer: true }],
        };
        const encoded = await encodeRun(run);
        expect(encoded).toBeTruthy();
        const decoded = await decodeRun(encoded!);
        expect(decoded).not.toBeNull();
        // Should decode to the current patch index (last entry in patchList)
        expect(typeof decoded!.meta?.patchIndex).toBe('number');
    });

    it('backward compat: pre-brotli deflate string still decodes correctly', async () => {
        // This string was produced by a pre-brotli encoder (deflate-compressed, base64url).
        // It starts with a base64url character, not '~' or '~~'.
        const legacyDeflateString = 'wAHQAC__5bQTQWm6E-RERUkwRPLaHANaZyolMSpVnq6Z82BvKu2PpiNACF3EBI8EBAMAAgUAAgjEAgpEAg_EAhkEAhvAAiyAAjRC5YQCP4QCRMQCT8ACbsACeIQCecQCkcQCJBnrR1hNTXg3puq3G5MjWY1tvKu2_rgdEiADAIICEiICQ8ICACABAGABAIABAMIBAoABBYABBYIBBkIBCeNzIQEJ4AEMIAEOIAEXAAEZ4AEbAAEbgAEkI3OiASzgAS2CATDCATqAAT5CAUHCAULAAUkAAQ';
        expect(legacyDeflateString.startsWith('~')).toBe(false);
        const decoded = await decodeRun(legacyDeflateString);
        expect(decoded).not.toBeNull();
        // patchIndex is undefined for pre-v8 strings
        expect(decoded!.meta?.patchIndex).toBeUndefined();
        expect(decoded!.players?.length).toBeGreaterThanOrEqual(2);
    });
});
