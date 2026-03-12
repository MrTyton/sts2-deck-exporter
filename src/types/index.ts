export interface CardData {
    id: string;
    count: number;
    upgraded: boolean;
    upgrades: number;
    enchantment: string | null;
}

export interface RawCardData {
    id: string;
    floor_added_to_deck?: number;
    current_upgrade_level?: number;
    upgrades?: number;
    enchantment?: { id: string };
    enchantmentId?: string;
    count?: number;
}

export interface PlayerRunData {
    characterName: string;
    cards: CardData[];
    relics?: string[];
}

export interface ImageExportMeta {
    characterName?: string;
    ascension?: string | number;
    outcome?: string;
    floor?: string | number;
    time?: string;
    relics?: string[]; // Legacy/single player support
}

export interface RunData {
    meta?: ImageExportMeta;
    players?: PlayerRunData[];
    cards?: CardData[]; // Legacy/single player support
}
