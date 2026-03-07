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
}

export interface RunData {
    win_rate?: number;
    character_chosen: string;
    playtime: number;
    score: number;
    timestamp: number;
    victory: boolean;
    floor_reached: number;
    ascension_level: number;
    relics?: string[];
    master_deck?: RawCardData[];
    seed?: number;
}

export interface ImageExportMeta {
    characterName?: string;
    ascension?: string | number;
    outcome?: string;
    floor?: string | number;
    relics?: string[];
}
