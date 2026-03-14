import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to this script
const LOCALIZATION_DIR = path.resolve(__dirname, '../../extraction_tools/GodotExtracted_New/localization/eng');
const OUTPUT_FILE = path.resolve(__dirname, '../data/gameData.json');

interface GameData {
  cards: Record<string, any>;
  relics: Record<string, any>;
  enchantments: Record<string, any>;
  keywords: Record<string, any>;
}

function loadJson(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return {};
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return {};
  }
}

console.log('Starting game data extraction...');
console.log(`Localization Source: ${LOCALIZATION_DIR}`);

const cards = loadJson(path.join(LOCALIZATION_DIR, 'cards.json'));
const relics = loadJson(path.join(LOCALIZATION_DIR, 'relics.json'));
const enchantments = loadJson(path.join(LOCALIZATION_DIR, 'enchantments.json'));
const keywords = loadJson(path.join(LOCALIZATION_DIR, 'card_keywords.json'));

const gameData: GameData = {
  cards: {},
  relics: {},
  enchantments: {},
  keywords: {},
};

// Normalize keys to lowercase for easier lookup in the frontend
// The game use MixedCase IDs like 'Strike_R', but the exporter often normalizes these.
Object.entries(cards).forEach(([key, value]) => {
  gameData.cards[key.toLowerCase()] = value;
});

Object.entries(relics).forEach(([key, value]) => {
  gameData.relics[key.toLowerCase()] = value;
});

Object.entries(enchantments).forEach(([key, value]) => {
  gameData.enchantments[key.toLowerCase()] = value;
});

Object.entries(keywords).forEach(([key, value]) => {
  gameData.keywords[key.toLowerCase()] = value;
});

// Create output directory if it doesn't exist
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(gameData, null, 2));

console.log(`\nExtraction Summary:`);
console.log(`- Cards: ${Object.keys(gameData.cards).length}`);
console.log(`- Relics: ${Object.keys(gameData.relics).length}`);
console.log(`- Enchantments: ${Object.keys(gameData.enchantments).length}`);
console.log(`- Keywords: ${Object.keys(gameData.keywords).length}`);
console.log(`\nGame data successfully written to ${OUTPUT_FILE}`);
