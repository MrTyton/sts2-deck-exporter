import fs from 'fs';
import path from 'path';

// Define the root of the project to find the extraction tools folder
const rootDir = process.cwd();
const extPath = path.join(rootDir, 'extraction_tools', 'GodotExtracted', 'localization', 'eng');

// Load localization files
const cards = JSON.parse(fs.readFileSync(path.join(extPath, 'cards.json'), 'utf8'));
const relics = JSON.parse(fs.readFileSync(path.join(extPath, 'relics.json'), 'utf8'));
const enchantments = JSON.parse(fs.readFileSync(path.join(extPath, 'enchantments.json'), 'utf8'));

const existingDictPath = path.join(rootDir, 'src', 'utils', 'encoderDict.ts');

let currentDict: string[] = [];

// Try to load the existing dictionary to preserve order
if (fs.existsSync(existingDictPath)) {
    console.log("Found existing encoderDict.ts, loading to preserve IDs...");
    const content = fs.readFileSync(existingDictPath, 'utf8');
    // Basic regex to rip the array out of the file
    const match = content.match(/export const numToId: string\[] = \[([\s\S]*?)\];/);
    if (match) {
        // Clean and parse the strings
        const items = match[1].split(',')
            .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(s => s.length > 0);
        currentDict = items;
    }
}

// Ensure the 0th element is an empty string (could be used for 'none')
if (currentDict.length === 0 || currentDict[0] !== '') {
    currentDict = ['', ...currentDict.filter(id => id !== '')];
}

const addNewIds = (sourceObj: Record<string, string>) => {
    Object.keys(sourceObj).forEach(key => {
        // Example key: "ABRASIVE.description" -> we just want "abrasive"
        if (key.startsWith('ENEMY_') || key.startsWith('DEBUG_')) return;

        const baseId = key.split('.')[0].toLowerCase();

        if (!currentDict.includes(baseId)) {
            currentDict.push(baseId);
        }
    });
};

console.log(`Starting with ${currentDict.length} items in dictionary...`);

addNewIds(cards);
addNewIds(relics);
addNewIds(enchantments);

console.log(`Finished processing. Total unique items: ${currentDict.length}`);

// We also need some characters. Let's manually add the 5 characters if they aren't in there
// We want them at the very beginning of the dictionary or handled separately.
// For compactness, characters will be their own 3-bit enum anyway in the encoder logic.
// So we just need them in the main enum if they ever appear as cards (which they don't).
// We will export a separate characters map to be safe.

const characterMap = [
    "ironclad",
    "silent",
    "defect",
    "necromancer",
    "regent"
];

// Generate the TypeScript file content
let tsContent = `// AUTO-GENERATED FILE. DO NOT EDIT BY HAND.
// Generated via \`npm run build-dict\` (src/scripts/buildDict.ts)
// This file is append-only to ensure backward compatibility for bitpacking!

export const numToId: string[] = [\n`;

currentDict.forEach((id, index) => {
    tsContent += `    "${id}", // ${index}\n`;
});

tsContent += `];\n\n`;

tsContent += `export const idToNum: Record<string, number> = {};\n`;
tsContent += `numToId.forEach((id, num) => {\n`;
tsContent += `    if (id !== '') idToNum[id] = num;\n`;
tsContent += `});\n\n`;

tsContent += `export const charToNum: Record<string, number> = {\n`;
characterMap.forEach((char, index) => {
    tsContent += `    "${char}": ${index},\n`;
});
tsContent += `};\n\n`;

tsContent += `export const numToChar: string[] = [\n`;
characterMap.forEach((char, index) => {
    tsContent += `    "${char}", // ${index}\n`;
});
tsContent += `];\n`;


fs.writeFileSync(existingDictPath, tsContent, 'utf8');

console.log(`Successfully wrote to ${existingDictPath}`);
