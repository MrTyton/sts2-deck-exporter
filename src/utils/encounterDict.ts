/**
 * Encounter ID ↔ number mapping for the V9 bit-stream encoder.
 *
 * Keys must exactly match model_id values from the run JSON with the
 * 'ENCOUNTER.' prefix stripped and lowercased.
 *
 * APPEND-ONLY: never reorder or remove existing entries — doing so would
 * corrupt all encoded URLs that reference these numbers.
 */
export const encounterToNum: Record<string, number> = {
    // ── Bosses (1–12) ─────────────────────────────────────────────────────────
    'ceremonial_beast_boss':    1,
    'doormaker_boss':           2,
    'kaiser_crab_boss':         3,
    'knowledge_demon_boss':     4,
    'lagavulin_matriarch_boss': 5,
    'queen_boss':               6,
    'soul_fysh_boss':           7,
    'test_subject_boss':        8,
    'the_insatiable_boss':      9,
    'the_kin_boss':            10,
    'vantom_boss':             11,
    'waterfall_giant_boss':    12,

    // ── Elites (13–24) ────────────────────────────────────────────────────────
    'bygone_effigy_elite':         13,
    'byrdonis_elite':              14,
    'decimillipede_elite':         15,
    'entomancer_elite':            16,
    'infested_prisms_elite':       17,
    'knights_elite':               18,
    'mecha_knight_elite':          19,
    'phantasmal_gardeners_elite':  20,
    'phrog_parasite_elite':        21,
    'skulking_colony_elite':       22,
    'soul_nexus_elite':            23,
    'terror_eel_elite':            24,

    // ── Normal / weak enemies (25–87) ─────────────────────────────────────────
    'axebots_normal':                        25,
    'battleworn_dummy_event_encounter':      26,
    'bowlbugs_normal':                       27,
    'bowlbugs_weak':                         28,
    'chompers_normal':                       29,
    'construct_menagerie_normal':            30,
    'corpse_slugs_normal':                   31,
    'corpse_slugs_weak':                     32,
    'cubex_construct_normal':                33,
    'cultists_normal':                       34,
    'dense_vegetation_event_encounter':      35,
    'devoted_sculptor_weak':                 36,
    'exoskeletons_normal':                   37,
    'exoskeletons_weak':                     38,
    'fabricator_normal':                     39,
    'fake_merchant_event_encounter':         40,
    'flyconid_normal':                       41,
    'fogmog_normal':                         42,
    'fossil_stalker_normal':                 43,
    'frog_knight_normal':                    44,
    'fuzzy_wurm_crawler_weak':               45,
    'globe_head_normal':                     46,
    'gremlin_merc_normal':                   47,
    'haunted_ship_normal':                   48,
    'hunter_killer_normal':                  49,
    'inklets_normal':                        50,
    'living_fog_normal':                     51,
    'louse_progenitor_normal':               52,
    'mawler_normal':                         53,
    'mysterious_knight_event_encounter':     54,
    'mytes_normal':                          55,
    'nibbits_normal':                        56,
    'nibbits_weak':                          57,
    'overgrowth_crawlers':                   58,
    'ovicepter_normal':                      59,   // class: OvicopterNormal
    'owl_magistrate_normal':                 60,
    'punch_construct_normal':                61,
    'punch_off_event_encounter':             62,
    'ruby_raiders_normal':                   63,
    'scrolls_of_biting_normal':              64,
    'scrolls_of_biting_weak':               65,
    'seapunk_weak':                          66,
    'sewer_clam_normal':                     67,
    'shrinker_beetle_weak':                  68,
    'slimed_berserker_normal':               69,
    'slimes_normal':                         70,
    'slimes_weak':                           71,
    'slithering_strangler_normal':           72,
    'sludge_spinner_weak':                   73,
    'slumbering_beetle_normal':              74,
    'snapping_jaxfruit_normal':              75,
    'spiny_toad_normal':                     76,
    'the_architect_event_encounter':         77,
    'the_lost_and_forgotten_normal':         78,
    'the_obscura_normal':                    79,
    'thieving_hopper_weak':                  80,
    'toadpoles_normal':                      81,
    'toadpoles_weak':                        82,
    'tunneler_normal':                       83,
    'tunneler_weak':                         84,
    'turret_operator_weak':                  85,
    'two_tailed_rats_normal':                86,
    'vine_shambler_normal':                  87,
};

export const numToEncounter: Record<number, string> = Object.fromEntries(
    Object.entries(encounterToNum).map(([k, v]) => [v, k])
);

/**
 * Sentinel value for "killed by an event" — stored as encounter number 255
 * in the encoder since event IDs don't have their own dictionary.
 */
export const KILLED_BY_EVENT_NUM = 255;
export const KILLED_BY_EVENT_ID  = 'event_kill';

/**
 * Strip type suffix and convert to Title Case for human-readable display.
 *
 * Examples:
 *   'waterfall_giant_boss'   → 'Waterfall Giant'
 *   'terror_eel_elite'       → 'Terror Eel'
 *   'corpse_slugs_weak'      → 'Corpse Slugs'
 *   'fake_merchant_event_encounter' → 'Fake Merchant'
 *   'event_kill'             → 'Event'
 */
export function formatEncounterName(id: string): string {
    if (id === KILLED_BY_EVENT_ID) return 'Event';
    return id
        .replace(/_event_encounter$/i, '')
        .replace(/_(?:boss|elite|normal|weak)$/i, '')
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/** Returns 'boss', 'elite', or 'normal' based on the encounter ID suffix. */
export function getEncounterType(id: string): 'boss' | 'elite' | 'normal' {
    if (/_boss$/i.test(id)) return 'boss';
    if (/_elite$/i.test(id)) return 'elite';
    return 'normal';
}

/**
 * Maps encounter IDs to the act number (1, 2, or 3) in which they appear.
 *
 * Act 1 covers both Overgrowth and Underdocks worlds.
 * Act 2 = Hive, Act 3 = Glory.
 * Sourced from BossDiscoveryOrder / AllElites / AllNormals in each ActModel.
 */
export const encounterAct: Readonly<Record<string, number>> = {
    // ── Act 1: Overgrowth ─────────────────────────────────────────────────────
    'vantom_boss':                          1,
    'ceremonial_beast_boss':                1,
    'the_kin_boss':                         1,
    'bygone_effigy_elite':                  1,
    'byrdonis_elite':                       1,
    'phrog_parasite_elite':                 1,
    'cubex_construct_normal':               1,
    'flyconid_normal':                      1,
    'fogmog_normal':                        1,
    'fuzzy_wurm_crawler_weak':              1,
    'inklets_normal':                       1,
    'mawler_normal':                        1,
    'nibbits_normal':                       1,
    'nibbits_weak':                         1,
    'ruby_raiders_normal':                  1,
    'shrinker_beetle_weak':                 1,
    'slimes_normal':                        1,
    'slimes_weak':                          1,
    'slithering_strangler_normal':          1,
    'snapping_jaxfruit_normal':             1,
    'vine_shambler_normal':                 1,
    'dense_vegetation_event_encounter':     1,
    'overgrowth_crawlers':                  1,
    // ── Act 1: Underdocks ─────────────────────────────────────────────────────
    'waterfall_giant_boss':                 1,
    'soul_fysh_boss':                       1,
    'lagavulin_matriarch_boss':             1,
    'skulking_colony_elite':                1,
    'phantasmal_gardeners_elite':           1,
    'terror_eel_elite':                     1,
    'corpse_slugs_normal':                  1,
    'corpse_slugs_weak':                    1,
    'cultists_normal':                      1,
    'living_fog_normal':                    1,
    'fossil_stalker_normal':                1,
    'gremlin_merc_normal':                  1,
    'haunted_ship_normal':                  1,
    'punch_construct_normal':               1,
    'seapunk_weak':                         1,
    'sewer_clam_normal':                    1,
    'sludge_spinner_weak':                  1,
    'toadpoles_normal':                     1,
    'toadpoles_weak':                       1,
    'two_tailed_rats_normal':               1,
    'punch_off_event_encounter':            1,
    // ── Act 2: Hive ───────────────────────────────────────────────────────────
    'the_insatiable_boss':                  2,
    'knowledge_demon_boss':                 2,
    'kaiser_crab_boss':                     2,
    'decimillipede_elite':                  2,
    'entomancer_elite':                     2,
    'infested_prisms_elite':                2,
    'bowlbugs_normal':                      2,
    'bowlbugs_weak':                        2,
    'chompers_normal':                      2,
    'exoskeletons_normal':                  2,
    'exoskeletons_weak':                    2,
    'hunter_killer_normal':                 2,
    'louse_progenitor_normal':              2,
    'mytes_normal':                         2,
    'ovicepter_normal':                     2,
    'slumbering_beetle_normal':             2,
    'spiny_toad_normal':                    2,
    'the_obscura_normal':                   2,
    'thieving_hopper_weak':                 2,
    'tunneler_normal':                      2,
    'tunneler_weak':                        2,
    // ── Act 3: Glory ──────────────────────────────────────────────────────────
    'queen_boss':                           3,
    'test_subject_boss':                    3,
    'doormaker_boss':                       3,
    'knights_elite':                        3,
    'mecha_knight_elite':                   3,
    'soul_nexus_elite':                     3,
    'axebots_normal':                       3,
    'construct_menagerie_normal':           3,
    'devoted_sculptor_weak':                3,
    'fabricator_normal':                    3,
    'frog_knight_normal':                   3,
    'globe_head_normal':                    3,
    'owl_magistrate_normal':                3,
    'scrolls_of_biting_normal':             3,
    'scrolls_of_biting_weak':              3,
    'slimed_berserker_normal':              3,
    'the_lost_and_forgotten_normal':        3,
    'turret_operator_weak':                 3,
    'battleworn_dummy_event_encounter':     3,
};

/** Returns the act number (1, 2, or 3) for the given encounter, or null if unknown. */
export function getEncounterAct(id: string): number | null {
    return encounterAct[id] ?? null;
}
