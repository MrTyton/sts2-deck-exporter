export interface CardData {
    id: string;
    count: number;
    upgraded: boolean;
    upgrades: number;
    enchantment: string | null;
    enchantmentAmount?: number;
    /** Overrides the portrait filename (without extension) for variant cards like Mad Science. */
    portraitId?: string;
    /** Overrides the card type for variant cards like Mad Science (e.g. 'Attack' | 'Skill' | 'Power'). */
    cardType?: string;
    /** Active rider effect for Mad Science (lowercase enum name, e.g. 'choking', 'wisdom'). */
    tinkerTimeRider?: string;
}

export interface RawCardData {
    id: string;
    floor_added_to_deck?: number;
    current_upgrade_level?: number;
    upgrades?: number;
    enchantment?: { id: string; amount?: number };
    enchantmentId?: string;
    count?: number;
    /** Runtime card properties stored in save files (e.g. TinkerTimeType for Mad Science). */
    props?: {
        ints?: Array<{ name: string; value: number }>;
    };
}

export interface PlayerRunData {
    characterName: string;
    cards: CardData[];
    relics?: string[];
    /** Steam64 ID from the raw JSON 'id' field, stored as a string to avoid ulong precision loss. Only present on freshly-parsed runs. */
    netId?: string;
    /** True when this player has been identified as the local player (the file owner). */
    isLocalPlayer?: boolean;
}

export interface ImageExportMeta {
    characterName?: string;
    ascension?: string | number;
    outcome?: string;
    floor?: string | number;
    time?: string;
    timestamp?: number;
    relics?: string[]; // Legacy/single player support
    /** Game build/patch version string (e.g. "v0.99.1") from the run file's build_id field. */
    buildId?: string;
    /** Index into patchList.json (0-based). Used to look up patch-specific card values and text. */
    patchIndex?: number;
}

export interface RunData {
    meta?: ImageExportMeta;
    players?: PlayerRunData[];
    cards?: CardData[]; // Legacy/single player support
}
