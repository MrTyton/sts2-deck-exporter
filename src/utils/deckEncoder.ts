import { idToNum, numToId, charToNum, numToChar } from './encoderDict';
import { BitWriter, BitReader } from './bitstream';
import type { RunData, PlayerRunData, ImageExportMeta } from '../types';

// Width Configuration
const BITS_VERSION = 3;
const BITS_ASCENSION = 5;
const BITS_FLOOR = 6;
const BITS_OUTCOME = 2; // 0=Victory, 1=Defeat, 2=Abandoned, 3=Unknown

const BITS_NUM_PLAYERS = 2;
const BITS_CHARACTER = 3;

const BITS_NUM_RELICS = 6;
const BITS_RELIC_ID = 11;

const BITS_NUM_CARDS = 6;
const BITS_CARD_ID = 11;
const BITS_UPGRADES = 1;
const BITS_HAS_ENCHANTMENT = 1;
const BITS_ENCHANTMENT_ID = 6;
const BITS_COUNT = 4;

const CURRENT_VERSION = 0;

export function encodeRun(run: RunData): string | null {
    try {
        const writer = new BitWriter();

        // Header
        writer.write(CURRENT_VERSION, BITS_VERSION);

        // Meta Block
        let ascension = 0;
        let floor = 0;
        let outcomeNum = 3;

        if (run.meta) {
            ascension = Math.min(31, parseInt(run.meta.ascension as string || '0', 10));
            floor = Math.min(63, run.meta.floor === '?' ? 0 : parseInt(run.meta.floor as string || '0', 10));
            if (run.meta.outcome === 'Victory') outcomeNum = 0;
            else if (run.meta.outcome === 'Defeat') outcomeNum = 1;
            else if (run.meta.outcome === 'Abandoned') outcomeNum = 2;
        }

        writer.write(ascension, BITS_ASCENSION);
        writer.write(floor, BITS_FLOOR);
        writer.write(outcomeNum, BITS_OUTCOME);

        // Normalize players vs legacy single run format
        let players: PlayerRunData[] = run.players || [];
        if (players.length === 0 && run.cards) {
            players = [{
                characterName: run.meta?.characterName || 'unknown',
                cards: run.cards,
                relics: run.meta?.relics || []
            }];
        }

        const numPlayers = Math.min(3, players.length); // Max 3 theoretically, game supports up to maybe 2
        writer.write(numPlayers, BITS_NUM_PLAYERS);

        for (let i = 0; i < numPlayers; i++) {
            const p = players[i];

            // Character
            let charIdNum = charToNum[p.characterName.toLowerCase()];
            if (charIdNum === undefined) charIdNum = 7; // Unknown char or overflow
            writer.write(charIdNum, BITS_CHARACTER);

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

                writer.write(card.upgraded ? 1 : 0, BITS_UPGRADES);

                if (card.enchantment) {
                    writer.writeBool(true);
                    let eNum = idToNum[card.enchantment.toLowerCase()];
                    writer.write(eNum || 0, BITS_ENCHANTMENT_ID);
                } else {
                    writer.writeBool(false);
                }

                writer.write(Math.min(15, card.count || 1), BITS_COUNT);
            }
        }

        // Convert Uint8Array to Base64Url
        const buffer = writer.getUint8Array();
        return arrayBufferToBase64Url(buffer);

    } catch (err) {
        console.error("Failed to bitpack run", err);
        return null;
    }
}


export function decodeRun(base64UrlStr: string): RunData | null {
    try {
        const buffer = base64UrlToArrayBuffer(base64UrlStr);
        const reader = new BitReader(buffer);

        const version = reader.read(BITS_VERSION);
        if (version !== 0) {
            console.warn("Attempting to parse an unsupported version bitpacked deck: " + version);
            // Could choose to throw or attempt anyway
        }

        // Meta Block
        const ascension = reader.read(BITS_ASCENSION);
        const floorNum = reader.read(BITS_FLOOR);
        const floor = floorNum === 0 ? '?' : floorNum;

        const outcomeNum = reader.read(BITS_OUTCOME);
        let outcome = 'Unknown';
        if (outcomeNum === 0) outcome = 'Victory';
        else if (outcomeNum === 1) outcome = 'Defeat';
        else if (outcomeNum === 2) outcome = 'Abandoned';

        let meta: ImageExportMeta = {
            ascension,
            floor,
            outcome
        };

        const numPlayers = reader.read(BITS_NUM_PLAYERS);
        const players: PlayerRunData[] = [];

        for (let i = 0; i < numPlayers; i++) {
            const charIdNum = reader.read(BITS_CHARACTER);
            let characterName = numToChar[charIdNum] || 'Unknown';
            if (characterName !== 'Unknown') {
                characterName = characterName.charAt(0).toUpperCase() + characterName.slice(1);
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

                const upgraded = reader.read(BITS_UPGRADES) === 1;
                const hasEnchantment = reader.readBool();
                let enchantment: string | null = null;

                if (hasEnchantment) {
                    const eNum = reader.read(BITS_ENCHANTMENT_ID);
                    enchantment = numToId[eNum] || null;
                }

                const count = reader.read(BITS_COUNT);

                cards.push({
                    id,
                    count,
                    upgraded,
                    upgrades: upgraded ? 1 : 0,
                    enchantment
                });
            }

            players.push({
                characterName,
                relics,
                cards
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

function arrayBufferToBase64Url(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlToArrayBuffer(base64url: string): Uint8Array {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
        base64 += '=';
    }
    const binary = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
