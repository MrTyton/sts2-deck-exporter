/**
 * tooltipUtils.ts
 *
 * Resolves card/relic/enchantment data into structured tooltip content by
 * combining localization text (gameData.json) with numerical values
 * (cardValues.json).
 *
 * Placeholder formats handled:
 *   {VarName:diff()}         – show numerical value; highlight if upgraded
 *   {VarName:energyIcons()}  – show as number (energy amount)
 *   {VarName:starIcons()}    – show as number (star amount)
 *   {VarName:plural:s|p}     – singular or plural based on value
 *   {IfUpgraded:show:A|B}    – show A if upgraded, else B
 *   {InCombat:text|}         – in-combat block; stripped from tooltips
 *   {VarName}                – raw numeric value
 *
 * Color tags handled:
 *   [gold]...[/gold]  [blue]...[/blue]  [green]...[/green]  [red]...[/red]
 */

import rawGameData from '../data/gameData.json';
import rawCardValues from '../data/cardValues.json';

// ── Type declarations ────────────────────────────────────────────────────────

interface GameDataFile {
  cards: Record<string, string>;
  relics: Record<string, string>;
  enchantments: Record<string, string>;
  keywords: Record<string, string>;
}

interface VarEntry {
  base: number;
}

interface CardValueEntry {
  category: string;
  vars: Record<string, VarEntry>;
  stringVars?: Record<string, string>;
  upgrades: Record<string, number | string>;
  energyCost?: number | string | null;
  cardType?: string;
  cardRarity?: string;
  keywords?: string[];
}

export interface TooltipSegment {
  text: string;
  /** CSS color variable name or literal hex, e.g. 'var(--tooltip-gold)' */
  color?: string;
  /** True if this is a numerical value that changed on upgrade */
  upgraded?: boolean;
  /** Render as an inline energy orb icon */
  isEnergy?: boolean;
  /** Render as an inline star icon */
  isStar?: boolean;
}

export type TooltipDescription = TooltipSegment[];

export interface TooltipContent {
  title: string;
  description: TooltipDescription;
  flavor?: TooltipDescription;
  /** For cards: energy cost as string ('0', '1', '2', '3', 'X', 'Unplayable') */
  energyCost?: string;
  /** 'Attack' | 'Skill' | 'Power' | 'Status' | 'Curse' */
  cardType?: string;
  cardRarity?: string;
  /** Enchantment title if the card has one */
  enchantmentTitle?: string;
  enchantmentDescription?: TooltipDescription;
}

// ── Static data ──────────────────────────────────────────────────────────────

const gameData = rawGameData as unknown as GameDataFile;
const cardValues = rawCardValues as unknown as Record<string, CardValueEntry>;

// ── Helper: look up a localization string ────────────────────────────────────

/** ID is always lowercase when it reaches us from the parser. */
function locCard(id: string, field: string): string {
  return gameData.cards[`${id}.${field}`] ?? '';
}

function locRelic(id: string, field: string): string {
  return gameData.relics[`${id}.${field}`] ?? '';
}

function locEnchantment(id: string, field: string): string {
  // Enchantment IDs come through as e.g. 'SHARP' (uppercase, no prefix)
  const key = `${id.toLowerCase()}.${field}`;
  return gameData.enchantments[key] ?? '';
}

/** Build a description TooltipDescription from a card's CanonicalKeywords when
 *  the card has no localised description text (e.g. most Curses). */
function keywordsToDescription(keywords: string[]): TooltipDescription {
  const segments: TooltipSegment[] = [];
  keywords.forEach((kw, i) => {
    const title = gameData.keywords[`${kw}.title`] ?? '';
    const desc  = gameData.keywords[`${kw}.description`] ?? '';
    if (!title && !desc) return;
    if (i > 0) segments.push({ text: '\n' });
    // Bold keyword title in gold, then em-dash and description
    segments.push({ text: title, color: 'var(--tooltip-gold)' });
    if (desc) {
      segments.push({ text: ' — ' });
      // desc may itself contain [gold]...[/gold] tags; parse it
      const inner = parseDescription(desc, undefined, false, 0);
      segments.push(...inner);
    }
  });
  return segments;
}

// ── Helper: resolve numerical value for a var ────────────────────────────────

// Some vars are computed at runtime (e.g. CalculatedDamageVar multiplies a base by an
// exhaust-pile count). For static display we fall back to simpler base vars.
const VAR_FALLBACKS: Record<string, string[]> = {
  CalculatedDamage:   ['CalculationBase', 'Damage'],
  CalculatedBlock:    ['CalculationBase', 'Block'],
  CalculatedCards:    ['CalculationBase', 'Cards'],
  CalculatedForge:    ['CalculationBase', 'Forge'],
  CalculatedEnergy:   ['CalculationBase', 'Energy'],
  CalculatedFocus:    ['CalculationBase', 'Focus'],
  CalculatedChannels: ['CalculationBase', 'Channels'],
  CalculatedHits:     ['CalculationBase', 'Hits'],
  CalculatedShivs:    ['CalculationBase', 'Shivs'],
  CalculatedDoom:     ['CalculationBase', 'Doom'],
};

function resolveVar(
  varName: string,
  vals: CardValueEntry | undefined,
  isUpgraded: boolean,
  upgradeLevel: number
): { value: number; changed: boolean } | { stringValue: string } | null {
  if (!vals) return null;
  // Try the direct var first, then any registered fallbacks
  const candidates = [varName, ...(VAR_FALLBACKS[varName] ?? [])];
  let varEntry: VarEntry | undefined;
  let resolvedName = varName;
  for (const name of candidates) {
    if (vals.vars[name] != null) {
      varEntry = vals.vars[name];
      resolvedName = name;
      break;
    }
  }
  if (varEntry == null) {
    // Fall back to stringVars (e.g. EnchantmentName = 'Goopy')
    const strVal = vals.stringVars?.[varName];
    if (strVal != null) return { stringValue: strVal };
    return null;
  }

  const base = varEntry.base;
  const delta = vals.upgrades[resolvedName];

  if (!isUpgraded || delta == null) {
    return { value: base, changed: false };
  }

  let upgraded: number;
  if (typeof delta === 'string' && delta.startsWith('=')) {
    // Absolute upgraded value, e.g. "=0"
    upgraded = parseFloat(delta.slice(1));
  } else {
    upgraded = base + (delta as number) * upgradeLevel;
  }

  return { value: upgraded, changed: upgraded !== base };
}

type VarResult = { value: number; changed: boolean } | { stringValue: string } | null;

/** Type guard: true when resolveVar returned a numeric result */
function isNumericResult(r: VarResult): r is { value: number; changed: boolean } {
  return r != null && 'value' in r;
}

/** Build the VAR marker string from a numeric result */
function varMarker(r: { value: number; changed: boolean }): string {
  return `\x01VAR\x02${r.value}\x02${r.changed ? '1' : '0'}\x01`;
}

// ── Runtime-block helpers ────────────────────────────────────────────────────

/**
 * Strip every occurrence of `{keyword:...}` (with any nesting depth) from text.
 * Used to remove blocks like {HasRider:...} that are only meaningful at runtime.
 * When keepInner=true the outer {Keyword:...} wrapper is removed but the inner
 * content is preserved (used to unwrap {HasRider:...} when a rider is known).
 */
function stripKeywordBlock(text: string, keyword: string, keepInner = false): string {
  const prefix = `{${keyword}:`;
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith(prefix, i)) {
      let depth = 1;
      let j = i + prefix.length;
      const innerStart = j;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      if (keepInner) {
        // Keep everything between the prefix and the closing }, exclusive
        result += text.slice(innerStart, j - 1);
      }
      i = j; // skip past the closing }
    } else {
      result += text[i++];
    }
  }
  return result;
}

/**
 * Resolves a boolean conditional block `{Keyword:content|}`.
 * If active=true, the content (before the first `|` at depth 1) is kept.
 * If active=false, the whole block is stripped.
 * Handles nested `{...}` correctly.
 */
function resolveConditionalBlock(text: string, keyword: string, active: boolean): string {
  const prefix = `{${keyword}:`;
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (!text.startsWith(prefix, i)) { result += text[i++]; continue; }
    let depth = 1;
    let j = i + prefix.length;
    const contentStart = j;
    let pipeAt = -1; // position of first `|` at depth 1
    while (j < text.length && depth > 0) {
      if (text[j] === '{') { depth++; j++; continue; }
      if (text[j] === '}') { depth--; if (depth === 0) { j++; break; } j++; continue; }
      if (text[j] === '|' && depth === 1 && pipeAt < 0) pipeAt = j;
      j++;
    }
    if (active) {
      // Keep content up to the first pipe (or end if no pipe)
      const end = pipeAt >= 0 ? pipeAt : j - 1;
      result += text.slice(contentStart, end);
    }
    i = j; // skip whole block
  }
  return result;
}

/**
 * Resolve `{CardType:choose(T1|T2|T3):branchA|branchB|branchC}` by selecting
 * the branch whose type matches cardType.  Uses bracket-counting so nested
 * `{...}` blocks inside branches don't confuse the `|` split.
 */
function resolveCardTypeChoose(text: string, cardType: string | undefined): string {
  const prefix = '{CardType:choose(';
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (!text.startsWith(prefix, i)) { result += text[i++]; continue; }
    const closeP = text.indexOf('):', i + prefix.length);
    if (closeP < 0) { result += text[i++]; continue; }
    const types = text.slice(i + prefix.length, closeP).split('|');
    const contentStart = closeP + 2; // after "):"
    // Walk forward collecting branches separated by '|' at depth 1
    const branches: string[] = [];
    let depth = 1;
    let branchStart = contentStart;
    let j = contentStart;
    while (j < text.length) {
      const ch = text[j];
      if (ch === '{') { depth++; j++; continue; }
      if (ch === '}') {
        depth--;
        if (depth === 0) { branches.push(text.slice(branchStart, j)); i = j + 1; break; }
        j++; continue;
      }
      if (ch === '|' && depth === 1) { branches.push(text.slice(branchStart, j)); branchStart = j + 1; }
      j++;
    }
    if (depth > 0) { result += text[i++]; continue; } // unmatched brace
    const idx = cardType ? types.indexOf(cardType) : -1;
    result += idx >= 0 && idx < branches.length ? branches[idx] : '';
  }
  return result;
}

// ── Placeholder resolver ─────────────────────────────────────────────────────

/**
 * Parses a raw description string and returns an array of TooltipSegments.
 * Variables that resolve to numbers are coloured; keywords get gold colour.
 */
function parseDescription(
  raw: string,
  vals: CardValueEntry | undefined,
  isUpgraded: boolean,
  upgradeLevel: number,
  tinkerTimeRider?: string
): TooltipDescription {
  if (!raw) return [];

  // 0. Resolve {HasRider:...} block.
  //    If we know the active rider, unwrap the block and keep only the matching
  //    sub-block (e.g. {Choking:content|}). Otherwise strip the whole block.
  let text: string;
  if (tinkerTimeRider) {
    // {HasRider:riderContent|fallback} — keep only riderContent when rider is known
    text = resolveConditionalBlock(raw, 'HasRider', true);
    // Now resolve individual rider sub-blocks.
    // Format: {RiderName:content|} — keep content for active rider, strip others.
    const allRiders = ['Sapping','Violence','Choking','Energized','Wisdom','Chaos',
                       'Expertise','Curious','Improvement'];
    for (const rider of allRiders) {
      const active = rider.toLowerCase() === tinkerTimeRider;
      text = resolveConditionalBlock(text, rider, active);
    }
  } else {
    text = stripKeywordBlock(raw, 'HasRider');
  }

  // 1. Remove runtime-only conditional blocks (InCombat, IsTargeting).
  //    Rider sub-blocks (Violence/Sapping/etc.) are handled above in step 0
  //    when a rider is known; they only appear inside {HasRider:...} anyway.
  text = text.replace(
    /\{(?:InCombat|IsTargeting|Swift|StartOfTurn|StartOfCombat|CharacterOnly)[^|]*\|?\}/g,
    ''
  );

  // 2. Handle {IfUpgraded:show:A|B}, {IfUpgraded:show:A} (no pipe), {IfUpgraded:show:|B} (empty A)
  //   A = text shown when upgraded, B = text shown when NOT upgraded. B defaults to '' if omitted.
  //   A-branch may contain nested {VarName} placeholders, e.g. {IfUpgraded:show:{Cards} copies|a copy}
  text = text.replace(
    /\{IfUpgraded:show:((?:[^|}{}]|\{[^{}]*\})*)(?:\|((?:[^{}]|\{[^{}]*\})*))?\}/g,
    (_, a, b) => (isUpgraded ? a : (b ?? ''))
  );

  // 2.3 Handle {VarName.StringValue:cond:trueBranch|fallbackBranch}
  //   StringValue is populated at runtime (e.g. a character or card name).
  //   We always use the fallback branch for static display.
  text = text.replace(
    /\{[\w]+\.StringValue:cond:(?:[^{}]|\{[^{}]*\})*\|([^}]*)\}/g,
    (_, fallback) => fallback
  );

  // 2.5 Handle {CardType:choose(T1|T2|T3):A|B|C} – pick branch matching cardType
  text = resolveCardTypeChoose(text, vals?.cardType);

  // 2.7 Handle {varName:cond:>N?trueContent|falseContent}
  text = text.replace(
    /\{(\w+):cond:>(\d+)\?((?:[^{}]|\{[^{}]*\})*)\|((?:[^{}]|\{[^{}]*\})*)\}/g,
    (_, varName, nStr, trueContent, falseContent) => {
      const res = resolveVar(varName, vals, isUpgraded, upgradeLevel);
      const val = isNumericResult(res) ? res.value : 0;
      return val > parseInt(nStr, 10) ? trueContent : falseContent;
    }
  );

  // 3. Replace variable placeholders with resolved numbers
  //    We embed a special marker <VAR:value:changed> that we'll parse below.
  text = text.replace(
    /\{(\w+):diff\(\)\}/g,
    (_, varName) => {
      const res = resolveVar(varName, vals, isUpgraded, upgradeLevel);
      if (res == null) return '\x01UNRESOLVED\x01';
      if (!isNumericResult(res)) return `\x01STR\x02${res.stringValue}\x01`;
      return varMarker(res);
    }
  );

  // {varName:energyIcons(N)} – literal count, e.g. {energyPrefix:energyIcons(1)}
  text = text.replace(/\{[^}]*:energyIcons\((\d+)\)\}/g, (_, n) =>
    '\x01ENERGY\x01'.repeat(parseInt(n, 10))
  );

  // {varName:energyIcons()} – count from var
  text = text.replace(
    /\{(\w+):energyIcons\(\)\}/g,
    (_, varName) => {
      const res = resolveVar(varName, vals, isUpgraded, upgradeLevel);
      if (res == null || !isNumericResult(res)) return '\x01UNRESOLVED\x01';
      return '\x01ENERGY\x01'.repeat(Math.max(1, Math.round(res.value)));
    }
  );

  // {singleStarIcon} – exactly one star
  text = text.replace(/\{singleStarIcon\}/g, '\x01STAR\x01');

  // {varName:starIcons(N)} – literal count
  text = text.replace(/\{[^}]*:starIcons\((\d+)\)\}/g, (_, n) =>
    '\x01STAR\x01'.repeat(parseInt(n, 10))
  );

  // {varName:starIcons()} – count from var
  text = text.replace(
    /\{(\w+):starIcons\(\)\}/g,
    (_, varName) => {
      const res = resolveVar(varName, vals, isUpgraded, upgradeLevel);
      if (res == null || !isNumericResult(res)) return '\x01UNRESOLVED\x01';
      return '\x01STAR\x01'.repeat(Math.max(1, Math.round(res.value)));
    }
  );

  // {varName:inverseDiff()} – treat like diff() (shows magnitude)
  text = text.replace(
    /\{(\w+):inverseDiff\(\)\}/g,
    (_, varName) => {
      const res = resolveVar(varName, vals, isUpgraded, upgradeLevel);
      if (res == null) return '\x01UNRESOLVED\x01';
      if (!isNumericResult(res)) return `\x01STR\x02${res.stringValue}\x01`;
      return varMarker(res);
    }
  );

  // Plural: {VarName:plural:singular|plural}
  // Both branches may contain {} or {:diff()} as a self-reference to the outer var.
  text = text.replace(
    /\{(\w+):plural:((?:[^|{}]|\{[^{}]*\})*)\|((?:[^{}]|\{[^{}]*\})*)\}/g,
    (_, varName, singular, pluralBranch) => {
      const res = resolveVar(varName, vals, isUpgraded, upgradeLevel);
      const val = isNumericResult(res) ? res.value : 1;
      let branch = val === 1 ? singular : pluralBranch;
      // {} and {:diff()} are both self-references to the outer var
      if (isNumericResult(res)) {
        const marker = varMarker(res);
        branch = branch.replace(/\{:diff\(\)\}|\{\}/g, marker);
      }
      return branch;
    }
  );

  // Bare {VarName} – unresolvable vars render as '?'
  text = text.replace(
    /\{(\w+)\}/g,
    (_, varName) => {
      const res = resolveVar(varName, vals, isUpgraded, upgradeLevel);
      if (res == null) return '\x01UNRESOLVED\x01';
      if (!isNumericResult(res)) return `\x01STR\x02${res.stringValue}\x01`;
      return varMarker(res);
    }
  );

  // 4. Now split on [tag] / VAR markers into segments
  //    Tags and markers are interleaved – we process linearly.
  const segments: TooltipSegment[] = [];

  // Build a single regex that matches all special tokens
  const TOKEN_RE = /\[(\w+)\](.*?)\[\/\1\]|\x01VAR\x02([\d.]+)\x02([01])\x01|\x01ENERGY\x01|\x01STAR\x01|\x01UNRESOLVED\x01|\x01STR\x02([^\x01]*)\x01/gs;

  let lastIndex = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const [fullMatch, tagName, tagContent, varValue, varChanged, strValue] = match;
    const idx = match.index!;

    // Plain text before this match
    if (idx > lastIndex) {
      const plain = text.slice(lastIndex, idx);
      if (plain) pushText(segments, plain);
    }

    if (tagName) {
      // [tag]content[/tag] – recurse to handle nested vars inside tags
      const inner = parseDescription(tagContent, vals, isUpgraded, upgradeLevel);
      const color = TAG_COLOR[tagName.toLowerCase()];
      inner.forEach(seg => {
        segments.push({ ...seg, color: seg.color ?? color });
      });
    } else if (varValue !== undefined) {
      // VAR marker
      const num = parseFloat(varValue);
      const displayVal = Number.isInteger(num) ? String(num) : num.toFixed(1);
      segments.push({
        text: displayVal,
        color: varChanged === '1' ? 'var(--tooltip-upgraded)' : 'var(--tooltip-value)',
        upgraded: varChanged === '1',
      });
    } else if (fullMatch === '\x01ENERGY\x01') {
      segments.push({ text: '⚡', isEnergy: true });
    } else if (fullMatch === '\x01STAR\x01') {
      segments.push({ text: '★', isStar: true });
    } else if (strValue != null) {
      // STR marker – string var (e.g. enchantment name), render as purple text
      segments.push({ text: strValue, color: 'var(--tooltip-purple)' });
    } else {
      // UNRESOLVED – var exists in text but has no static value
      segments.push({ text: '?', color: 'var(--tooltip-value)' });
    }

    lastIndex = idx + fullMatch.length;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    pushText(segments, text.slice(lastIndex));
  }

  return segments;
}

function pushText(segments: TooltipSegment[], text: string) {
  if (!text) return;
  // Split on newlines so callers can render <br> etc.
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) segments.push({ text: '\n' });
    if (line) segments.push({ text: line });
  });
}

const TAG_COLOR: Record<string, string> = {
  gold:  'var(--tooltip-gold)',
  blue:  'var(--tooltip-blue)',
  green: 'var(--tooltip-green)',
  red:   'var(--tooltip-red)',
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getCardTooltip(
  id: string,           // lowercase, e.g. 'bash'
  isUpgraded: boolean,
  upgradeLevel: number,
  enchantmentId: string | null,
  enchantmentAmount?: number,
  cardTypeOverride?: string,   // e.g. 'Attack' | 'Skill' | 'Power' for Mad Science
  tinkerTimeRider?: string     // lowercase rider name, e.g. 'choking', 'wisdom'
): TooltipContent {
  const locId = id;  // already lowercase; keys in gameData are lowercase
  const valKey = id.toUpperCase();
  const vals = cardValues[valKey];

  // If the card has a runtime-chosen type (e.g. Mad Science), override the static cardType
  // so that {CardType:choose(...)} resolves to the correct branch.
  const effectiveVals: CardValueEntry | undefined = (cardTypeOverride && vals)
    ? { ...vals, cardType: cardTypeOverride }
    : vals;

  const title = locCard(locId, 'title') || formatFallbackName(id);
  const rawDesc = locCard(locId, 'description');
  const description = rawDesc
    ? parseDescription(rawDesc, effectiveVals, isUpgraded, upgradeLevel, tinkerTimeRider)
    : keywordsToDescription(effectiveVals?.keywords ?? []);

  // Energy cost
  // Curses use -1 as their cost literal; Unplayable cards are also suppressed.
  let energyCost: string | undefined;
  if (effectiveVals?.energyCost != null) {
    const ec = effectiveVals.energyCost;
    if (ec === 'X') {
      energyCost = 'X';
    } else if (ec === 'CardEnergyCost.Unplayable' || (typeof ec === 'number' && ec < 0)) {
      energyCost = undefined;
    } else {
      let costNum = typeof ec === 'number' ? ec : parseInt(String(ec), 10);
      if (isUpgraded && effectiveVals.upgrades.EnergyCost != null) {
        const delta = effectiveVals.upgrades.EnergyCost;
        if (typeof delta === 'string' && delta.startsWith('=')) {
          costNum = parseFloat(delta.slice(1));
        } else {
          costNum = costNum + (delta as number) * upgradeLevel;
        }
      }
      energyCost = String(Math.max(0, costNum));
    }
  }

  const content: TooltipContent = {
    title,
    description,
    energyCost,
    cardType: cardTypeOverride ?? vals?.cardType,
    cardRarity: vals?.cardRarity,
  };

  // Enchantment
  if (enchantmentId) {
    const enchId = enchantmentId.toLowerCase();
    const enchTitle = locEnchantment(enchId, 'title');
    const enchRawDesc = locEnchantment(enchId, 'description');
    const enchVals = cardValues[enchantmentId.toUpperCase()];
    if (enchTitle) {
      content.enchantmentTitle = enchTitle;
      // Inject {Amount} = enchantmentAmount (or 1 as default) so e.g. Sharp shows its level
      const amount = enchantmentAmount ?? 1;
      const enchValsWithAmount: CardValueEntry = {
        category: 'enchantments',
        vars: { ...(enchVals?.vars ?? {}), Amount: { base: amount } },
        upgrades: enchVals?.upgrades ?? {},
      };
      content.enchantmentDescription = parseDescription(enchRawDesc, enchValsWithAmount, false, 0);
    }
  }

  return content;
}

export function getRelicTooltip(id: string): TooltipContent {
  const locId = id;  // lowercase
  const valKey = id.toUpperCase();
  const vals = cardValues[valKey];

  const title = locRelic(locId, 'title') || formatFallbackName(id);
  const rawDesc = locRelic(locId, 'description');
  const rawFlavor = locRelic(locId, 'flavor');

  const description = parseDescription(rawDesc, vals, false, 0);
  // Skip the early-access placeholder flavor text
  const flavor = (rawFlavor && !rawFlavor.includes('will be revealed'))
    ? parseDescription(rawFlavor, vals, false, 0)
    : undefined;

  return { title, description, flavor };
}

export function getEnchantmentTooltip(id: string): TooltipContent {
  const locId = id.toLowerCase();
  const valKey = id.toUpperCase();
  const vals = cardValues[valKey];

  const title = locEnchantment(locId, 'title') || formatFallbackName(id);
  const rawDesc = locEnchantment(locId, 'description');
  const description = parseDescription(rawDesc, vals, false, 0);

  return { title, description };
}

// ── Fallback name formatter ──────────────────────────────────────────────────

function formatFallbackName(id: string): string {
  return id
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
