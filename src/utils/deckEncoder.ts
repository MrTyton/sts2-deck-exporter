import { idToNum, numToId, charToNum, numToChar } from './encoderDict';
import { BitWriter, BitReader } from './bitstream';
import { getCharacterName } from './characterMapper';
import { decompressBytes, compressBytesBrotli, decompressBytesBrotli } from './compression';
import { toBase81, fromBase81 } from './base81';
import type { RunData, PlayerRunData, ImageExportMeta } from '../types';
import { PATCH_LIST, CURRENT_PATCH_INDEX } from './patchUtils';

// Width Configuration (Version 0)
const V0_BITS_NUM_PLAYERS = 2;
const V0_BITS_CHARACTER = 3;

// Width Configuration (Version 1+)
const V1_BITS_NUM_PLAYERS = 3;
const V1_BITS_CHARACTER = 4;

// v8+: 8-bit version field supports up to 255 encoder versions.
// Strings using this width are prefixed with '~~' to distinguish them from
// the legacy 3-bit v7 strings that used a single '~' prefix.
const BITS_VERSION        = 8; // new format (~~)
const BITS_VERSION_LEGACY = 3; // old brotli format (~), always version 7

const BITS_ASCENSION = 5;
const BITS_FLOOR = 6;
const BITS_OUTCOME = 2; // 0=Victory, 1=Defeat, 2=Abandoned, 3=Unknown
const BITS_TIME = 16;   // Up to 65535 seconds (~18 hours)
const BITS_TIMESTAMP = 32;

const BITS_NUM_RELICS = 6;
const BITS_RELIC_ID = 11;

const BITS_NUM_CARDS = 6;
const BITS_CARD_ID = 11;
const BITS_UPGRADES = 1;           // v0-v2: 1-bit upgraded boolean
const BITS_UPGRADE_LEVEL = 4;      // v3+:  0-15 upgrade level
const BITS_ENCHANTMENT_ID = 11;
const BITS_ENCHANTMENT_AMOUNT = 5; // v3+:  0-31 enchantment amount
const BITS_COUNT = 4;       // v0-v6: 4 bits (max 15 copies)
const BITS_COUNT_V7 = 8;    // v7+:  8 bits (max 255 copies)

// v4+: Mad Science variant props (only written/read when card id === 'mad_science')
const BITS_TINKER_TIME_TYPE = 2; // CardType: 1=Attack, 2=Skill, 3=Power (fits in 2 bits)
const BITS_TINKER_TIME_RIDER = 4; // RiderEffect: 0-9 (fits in 4 bits)

// v8+: game patch index (0-127, maps to patchList.json)
const BITS_PATCH_INDEX = 7; // supports up to 128 distinct game patches

const CURRENT_VERSION = 8;

export async function encodeRun(run: RunData): Promise<string | null> {
    try {
        const writer = new BitWriter();

        // Header
        writer.write(CURRENT_VERSION, BITS_VERSION);

        // Meta Block
        let ascension = 0;
        let floor = 0;
        let outcomeNum = 3;
        let timeSeconds = 0;

        if (run.meta) {
            ascension = Math.min(31, parseInt(String(run.meta.ascension || '0'), 10));
            floor = Math.min(63, run.meta.floor === '?' ? 0 : parseInt(String(run.meta.floor || '0'), 10));
            if (run.meta.outcome === 'Victory') outcomeNum = 0;
            else if (run.meta.outcome === 'Defeat') outcomeNum = 1;
            else if (run.meta.outcome === 'Abandoned') outcomeNum = 2;

            if (run.meta.time) {
                timeSeconds = Math.min(65535, parseTimeToSeconds(run.meta.time));
            }
        }

        writer.write(ascension, BITS_ASCENSION);
        writer.write(floor, BITS_FLOOR);
        writer.write(outcomeNum, BITS_OUTCOME);
        writer.write(timeSeconds, BITS_TIME);
        writer.write(run.meta?.timestamp || 0, BITS_TIMESTAMP);

        // v8+: game patch index (0-127)
        const patchIndex = Math.min(127, run.meta?.patchIndex ?? CURRENT_PATCH_INDEX);
        writer.write(patchIndex, BITS_PATCH_INDEX);

        // Normalize players vs legacy single run format
        let players: PlayerRunData[] = run.players || [];
        if (players.length === 0 && run.cards) {
            players = [{
                characterName: run.meta?.characterName || 'unknown',
                cards: run.cards,
                relics: run.meta?.relics || []
            }];
        }

        const numPlayers = Math.min(7, players.length); // Max 7 for 3 bits
        writer.write(numPlayers, V1_BITS_NUM_PLAYERS);

        for (let i = 0; i < numPlayers; i++) {
            const p = players[i];

            // Character
            const normalizedCharName = p.characterName.toLowerCase().replace(/^the\s+/, '');
            let charIdNum = charToNum[normalizedCharName];
            if (charIdNum === undefined) charIdNum = 15; // 15 is the new 'unknown' for 4 bits
            writer.write(charIdNum, V1_BITS_CHARACTER);

            // v5+: isLocalPlayer flag (1 bit; marks the file-owner player for co-op run filtering)
            writer.writeBool(p.isLocalPlayer === true);

            // Relics
            const relics = p.relics || [];
            writer.write(Math.min(63, relics.length), BITS_NUM_RELICS);

            for (let r = 0; r < Math.min(63, relics.length); r++) {
                let rNum = idToNum[relics[r].toLowerCase()];
                writer.write(rNum || 0, BITS_RELIC_ID);
            }

            // Cards
            const cards = p.cards || [];
            writer.write(Math.min(63, cards.length), BITS_NUM_CARDS);

            for (let c = 0; c < Math.min(63, cards.length); c++) {
                const card = cards[c];
                let cNum = idToNum[card.id.toLowerCase()];
                writer.write(cNum || 0, BITS_CARD_ID);

                // v3: store full upgrade level (0-15) instead of a 1-bit bool
                writer.write(Math.min(15, card.upgrades ?? (card.upgraded ? 1 : 0)), BITS_UPGRADE_LEVEL);

                if (card.enchantment) {
                    writer.writeBool(true);
                    let eNum = idToNum[card.enchantment.toLowerCase()];
                    writer.write(eNum || 0, BITS_ENCHANTMENT_ID);
                    // v3: store enchantment amount so the tooltip shows the correct value
                    writer.write(Math.min(31, card.enchantmentAmount ?? 1), BITS_ENCHANTMENT_AMOUNT);
                } else {
                    writer.writeBool(false);
                }

                writer.write(Math.min(255, card.count || 1), BITS_COUNT_V7);

                // v4+: write Mad Science variant props so shared links decode correctly
                if (card.id.toLowerCase() === 'mad_science') {
                    const typeMap: Record<string, number> = { attack: 1, skill: 2, power: 3 };
                    const riderMap: Record<string, number> = {
                        sapping: 1, violence: 2, choking: 3, energized: 4,
                        wisdom: 5, chaos: 6, expertise: 7, curious: 8, improvement: 9,
                    };
                    const typeNum = typeMap[(card.cardType ?? 'attack').toLowerCase()] ?? 1;
                    const riderNum = riderMap[(card.tinkerTimeRider ?? '').toLowerCase()] ?? 0;
                    writer.write(typeNum, BITS_TINKER_TIME_TYPE);
                    writer.write(riderNum, BITS_TINKER_TIME_RIDER);
                }
            }
        }

        const rawBytes = writer.getUint8Array();
        // Brotli-compress at quality 11, then encode with base81.
        // '~~' prefix marks v8+ format (8-bit version field).
        // Legacy v7 strings used a single '~' prefix (3-bit version field).
        const compressed = await compressBytesBrotli(rawBytes);
        return '~~' + toBase81(compressed);

    } catch (err) {
        console.error("Failed to bitpack run", err);
        return null;
    }
}


export async function decodeRun(base64UrlStr: string): Promise<RunData | null> {
    try {
        let buffer: Uint8Array;
        let legacyFormat = false;
        if (base64UrlStr.startsWith('~~')) {
            // v8+: '~~' prefix + base81-encoded + brotli-compressed, 8-bit version field
            buffer = await decompressBytesBrotli(fromBase81(base64UrlStr.slice(2)));
        } else if (base64UrlStr.startsWith('~')) {
            // v7 legacy: single '~' prefix + base81-encoded + brotli, 3-bit version field
            buffer = await decompressBytesBrotli(fromBase81(base64UrlStr.slice(1)));
            legacyFormat = true;
        } else {
            const rawBuffer = base64UrlToArrayBuffer(base64UrlStr);
            if (rawBuffer.length > 0 && (rawBuffer[0] >> 5) === 6) {
                // V6+: sentinel byte 0xC0 — deflate-compressed
                buffer = await decompressBytes(rawBuffer.slice(1));
            } else {
                // Pre-v6: uncompressed raw bitstream
                buffer = rawBuffer;
            }
            legacyFormat = true;
        }
        const reader = new BitReader(buffer);

        // Legacy strings (v0-v7) used a 3-bit version field; v8+ uses 8 bits.
        const version = reader.read(legacyFormat ? BITS_VERSION_LEGACY : BITS_VERSION);
        if (version > CURRENT_VERSION) {
            console.warn("Attempting to parse an unsupported version bitpacked deck: " + version);
        }

        const ascension = reader.read(BITS_ASCENSION);
        const floorNum = reader.read(BITS_FLOOR);
        const floor = floorNum === 0 ? '?' : floorNum;

        const outcomeNum = reader.read(BITS_OUTCOME);
        let outcome = 'Unknown';
        if (outcomeNum === 0) outcome = 'Victory';
        else if (outcomeNum === 1) outcome = 'Defeat';
        else if (outcomeNum === 2) outcome = 'Abandoned';

        const timeSeconds = reader.read(BITS_TIME);
        const time = formatSecondsToTime(timeSeconds);

        let timestamp: number | undefined = undefined;
        if (version >= 2) {
            timestamp = reader.read(BITS_TIMESTAMP);
        }

        // v8+: patch index (7 bits, 0-127)
        let patchIndex: number | undefined;
        if (version >= 8) {
            patchIndex = reader.read(BITS_PATCH_INDEX);
        }

        const buildId = patchIndex !== undefined ? (PATCH_LIST[patchIndex] ?? undefined) : undefined;

        let meta: ImageExportMeta = {
            ascension,
            floor,
            outcome,
            time,
            timestamp,
            buildId,
            patchIndex,
        };

        const numPlayersBits = (version === 0) ? V0_BITS_NUM_PLAYERS : V1_BITS_NUM_PLAYERS;
        const charBits = (version === 0) ? V0_BITS_CHARACTER : V1_BITS_CHARACTER;

        const numPlayers = reader.read(numPlayersBits);
        const players: PlayerRunData[] = [];

        for (let i = 0; i < numPlayers; i++) {
            const charIdNum = reader.read(charBits);
            const rawCharName = numToChar[charIdNum];
            const characterName = getCharacterName(rawCharName) || 'Unknown';

            // v5+: isLocalPlayer flag; for older solo runs auto-mark the only player as local
            let isLocalPlayer: boolean | undefined;
            if (version >= 5) {
                isLocalPlayer = reader.readBool() ? true : undefined;
            } else if (numPlayers === 1) {
                isLocalPlayer = true;
            }

            const numRelics = reader.read(BITS_NUM_RELICS);
            const relics: string[] = [];
            for (let r = 0; r < numRelics; r++) {
                const rNum = reader.read(BITS_RELIC_ID);
                const rStr = numToId[rNum];
                if (rStr) relics.push(rStr);
            }

            const numCards = reader.read(BITS_NUM_CARDS);
            const cards = [];
            for (let c = 0; c < numCards; c++) {
                const cNum = reader.read(BITS_CARD_ID);
                const id = numToId[cNum] || 'unknown';

                // v3+: full upgrade level; v0-v2: 1-bit bool
                let upgraded: boolean;
                let upgrades: number;
                if (version >= 3) {
                    upgrades = reader.read(BITS_UPGRADE_LEVEL);
                    upgraded = upgrades > 0;
                } else {
                    upgraded = reader.read(BITS_UPGRADES) === 1;
                    upgrades = upgraded ? 1 : 0;
                }

                const hasEnchantment = reader.readBool();
                let enchantment: string | null = null;
                let enchantmentAmount: number | undefined = undefined;

                if (hasEnchantment) {
                    const eNum = reader.read(BITS_ENCHANTMENT_ID);
                    enchantment = numToId[eNum] || null;
                    // v3+: enchantment amount is encoded; older versions default to 1
                    enchantmentAmount = version >= 3 ? reader.read(BITS_ENCHANTMENT_AMOUNT) : 1;
                }

                const count = version >= 7 ? reader.read(BITS_COUNT_V7) : reader.read(BITS_COUNT);

                // v4+: read Mad Science variant props
                let portraitId: string | undefined;
                let cardType: string | undefined;
                let tinkerTimeRider: string | undefined;
                if (id === 'mad_science' && version >= 4) {
                    const typeNum = reader.read(BITS_TINKER_TIME_TYPE);
                    const riderNum = reader.read(BITS_TINKER_TIME_RIDER);
                    const typeNames: Record<number, string> = { 1: 'Attack', 2: 'Skill', 3: 'Power' };
                    const riderNames: Record<number, string> = {
                        1: 'sapping', 2: 'violence', 3: 'choking', 4: 'energized',
                        5: 'wisdom', 6: 'chaos', 7: 'expertise', 8: 'curious', 9: 'improvement',
                    };
                    cardType = typeNames[typeNum] ?? 'Attack';
                    portraitId = `mad_science_${cardType.toLowerCase()}`;
                    tinkerTimeRider = riderNames[riderNum];
                }

                cards.push({
                    id,
                    count,
                    upgraded,
                    upgrades,
                    enchantment,
                    enchantmentAmount,
                    portraitId,
                    cardType,
                    tinkerTimeRider,
                });
            }

            players.push({
                characterName,
                relics,
                cards,
                isLocalPlayer,
            });
        }

        meta.characterName = players.map(p => p.characterName).join(' & ');

        return {
            meta,
            players
        };

    } catch (err) {
        console.error("Failed to unpack bitpacked run", err);
        return null;
    }
}

function parseTimeToSeconds(timeStr: string): number {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return isNaN(parts[0]) ? 0 : parts[0];
}

function formatSecondsToTime(totalSeconds: number): string {
    if (totalSeconds === 0) return '';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

function base64UrlToArrayBuffer(base64url: string): Uint8Array {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
        base64 += '=';
    }
    const binary = (typeof atob !== 'undefined')
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
