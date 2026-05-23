/**
 * LAYER: semantic registry builder — builds a unified SemanticRegistry.
 *
 * Aggregates all scattered semantic knowledge sources into one inspectable
 * registry. Built once at module load (lazy singleton). Sources:
 *
 *   store_dictionary  — STORES from chat/parser/dictionaries
 *   item_dictionary   — ITEMS from chat/parser/dictionaries
 *   alias_map         — MERCHANT_ALIAS_MAP from inputNormalizer
 *   phrase_table      — ITEM_BIGRAM_TABLE + PAYMENT_PHRASE_TABLE from semanticDictionary
 *   modifier_set      — MODIFIER_PREFIXES + STANDALONE_MODIFIERS from phraseExtractor
 *
 * Architecture invariants:
 *   - Pure function: same sources → same registry (deterministic).
 *   - No side effects — registry is read-only after construction.
 *   - Does NOT modify existing lookup tables — additive only.
 *   - Conflict detection runs automatically during build.
 */

import { STORES, ITEMS } from '@/features/chat/parser/dictionaries';
import { MERCHANT_ALIAS_MAP } from './inputNormalizer';
import { ITEM_BIGRAM_TABLE, PAYMENT_PHRASE_TABLE } from './semanticDictionary';
import { MODIFIER_PREFIXES, STANDALONE_MODIFIERS } from './phraseExtractor';
import {
  computePrecedence,
  type AnyRegistryEntry,
  type MerchantEntry,
  type AliasEntry,
  type PhraseEntry,
  type ItemEntry,
  type ModifierEntry,
  type SemanticRegistry,
  type RegistryConflict,
} from './semanticRegistry';

// ── ID generation ─────────────────────────────────────────────────────────────

let _idSeq = 0;
function nextId(prefix: string): string {
  return `${prefix}${_idSeq++}`;
}

// ── Phase 1: Build raw entries ────────────────────────────────────────────────

function buildMerchantEntries(): MerchantEntry[] {
  const entries: MerchantEntry[] = [];

  for (const store of STORES) {
    const singleAliases = store.aliases.filter((a) => !a.includes(' '));
    const bigramAliases = store.aliases.filter((a) => a.split(' ').length === 2);
    const trigramAliases = store.aliases.filter((a) => a.split(' ').length === 3);

    // One entry per distinct token-count group so precedence differs
    for (const [aliasGroup, tokenCount] of [
      [trigramAliases, 3],
      [bigramAliases, 2],
      [singleAliases, 1],
    ] as [string[], number][]) {
      if (aliasGroup.length === 0) continue;

      for (const alias of aliasGroup) {
        const tokens = alias.toLowerCase().split(' ');
        const entry: MerchantEntry = {
          id: nextId('m'),
          kind: 'merchant',
          source: 'store_dictionary',
          tokens,
          categoryIds: store.categoryId ? [store.categoryId] : [],
          confidence: store.needsContext ? 0.95 : 1.0,
          precedence: computePrecedence('merchant', 'store_dictionary', tokenCount),
          archived: false,
          storeId: store.id,
          storeGroup: store.storeGroup,
          needsContext: !!store.needsContext,
          aliases: aliasGroup.map((a) => a.toLowerCase()),
          metadata: { storeId: store.id, storeGroup: store.storeGroup },
        };
        entries.push(entry);
      }
    }
  }

  return entries;
}

function buildAliasEntries(): AliasEntry[] {
  return Object.entries(MERCHANT_ALIAS_MAP).map(([variant, canonical]) => {
    const tokens = variant.split(' ');
    return {
      id: nextId('a'),
      kind: 'alias',
      source: 'alias_map',
      tokens,
      categoryIds: [],
      confidence: 1.0,
      precedence: computePrecedence('alias', 'alias_map', tokens.length),
      archived: false,
      canonical,
    } satisfies AliasEntry;
  });
}

function buildPhraseEntries(): PhraseEntry[] {
  const entries: PhraseEntry[] = [];

  // Payment phrases (higher precedence than item phrases)
  for (const [key, value] of Object.entries(PAYMENT_PHRASE_TABLE)) {
    const tokens = key.split(' ');
    entries.push({
      id: nextId('pp'),
      kind: 'phrase',
      source: 'phrase_table',
      tokens,
      categoryIds: value.categoryIds,
      confidence: value.confidence,
      precedence: computePrecedence('phrase', 'phrase_table', tokens.length, {
        isPaymentPhrase: true,
      }),
      archived: false,
      phraseType: 'payment',
    });
  }

  // Item bigrams — includes backward-compat duplicates of payment phrases; conflict detector reports overlaps
  for (const [key, value] of Object.entries(ITEM_BIGRAM_TABLE)) {
    const tokens = key.split(' ');
    entries.push({
      id: nextId('pi'),
      kind: 'phrase',
      source: 'phrase_table',
      tokens,
      categoryIds: value.categoryIds,
      confidence: value.confidence,
      precedence: computePrecedence('phrase', 'phrase_table', tokens.length),
      archived: false,
      phraseType: 'item',
    });
  }

  return entries;
}

function buildItemEntries(): ItemEntry[] {
  return Object.entries(ITEMS).map(([token, entry]) => ({
    id: nextId('i'),
    kind: 'item',
    source: 'item_dictionary',
    tokens: [token],
    categoryIds: [entry.categoryId],
    confidence: 0.85,
    precedence: computePrecedence('item', 'item_dictionary', 1),
    archived: false,
  } satisfies ItemEntry));
}

function buildModifierEntries(): ModifierEntry[] {
  const entries: ModifierEntry[] = [];

  for (const token of MODIFIER_PREFIXES) {
    entries.push({
      id: nextId('mp'),
      kind: 'modifier',
      source: 'modifier_set',
      tokens: [token],
      categoryIds: [],
      confidence: 0.70,
      precedence: computePrecedence('modifier', 'modifier_set', 1),
      archived: false,
      modifierRole: 'prefix',
    });
  }

  for (const token of STANDALONE_MODIFIERS) {
    entries.push({
      id: nextId('ms'),
      kind: 'modifier',
      source: 'modifier_set',
      tokens: [token],
      categoryIds: [],
      confidence: 0.60,
      precedence: computePrecedence('modifier', 'modifier_set', 1),
      archived: false,
      modifierRole: 'standalone',
    });
  }

  return entries;
}

// ── Phase 2: Build indexes ────────────────────────────────────────────────────

function insertByPrecedence(
  index: Record<string, AnyRegistryEntry>,
  key: string,
  entry: AnyRegistryEntry,
): void {
  const existing = index[key];
  if (!existing || entry.precedence > existing.precedence) {
    index[key] = entry;
  }
}

function buildIndexes(entries: AnyRegistryEntry[]): {
  singleIndex: Record<string, AnyRegistryEntry>;
  bigramIndex: Record<string, AnyRegistryEntry>;
  trigramIndex: Record<string, AnyRegistryEntry>;
  aliasIndex: Record<string, string>;
} {
  const singleIndex: Record<string, AnyRegistryEntry> = {};
  const bigramIndex: Record<string, AnyRegistryEntry> = {};
  const trigramIndex: Record<string, AnyRegistryEntry> = {};
  const aliasIndex: Record<string, string> = {};

  for (const entry of entries) {
    const key = entry.tokens.join(' ');

    if (entry.tokens.length === 1) {
      insertByPrecedence(singleIndex, key, entry);
    } else if (entry.tokens.length === 2) {
      insertByPrecedence(bigramIndex, key, entry);
    } else if (entry.tokens.length === 3) {
      insertByPrecedence(trigramIndex, key, entry);
    }

    if (entry.kind === 'alias') {
      aliasIndex[entry.tokens.join(' ')] = (entry as AliasEntry).canonical;
    }
  }

  return { singleIndex, bigramIndex, trigramIndex, aliasIndex };
}

// ── Phase 3: Conflict detection ───────────────────────────────────────────────

function detectConflicts(
  entries: AnyRegistryEntry[],
  singleIndex: Record<string, AnyRegistryEntry>,
): RegistryConflict[] {
  const conflicts: RegistryConflict[] = [];

  // phrase_overlap: multiple entries for same token sequence (winner = higher precedence)
  const seenKeys = new Map<string, AnyRegistryEntry[]>();
  for (const entry of entries) {
    const key = entry.tokens.join(' ');
    const group = seenKeys.get(key) ?? [];
    group.push(entry);
    seenKeys.set(key, group);
  }
  for (const [key, group] of seenKeys) {
    if (group.length > 1) {
      const sorted = [...group].sort((a, b) => b.precedence - a.precedence);
      conflicts.push({
        kind: 'phrase_overlap',
        entryIds: group.map((e) => e.id),
        tokens: key.split(' '),
        message: `"${key}" — ${group.length} записей (${group.map((e) => e.kind).join(', ')}); победитель: ${sorted[0].id}`,
        winnerId: sorted[0].id,
      });
    }
  }

  // merchant_item_conflict: same single token is both merchant and item
  const merchantTokens = new Set(
    entries
      .filter((e) => e.kind === 'merchant' && e.tokens.length === 1)
      .map((e) => e.tokens[0]),
  );
  const itemTokens = new Set(
    entries
      .filter((e) => e.kind === 'item')
      .map((e) => e.tokens[0]),
  );
  for (const token of merchantTokens) {
    if (itemTokens.has(token)) {
      const merchantEntry = singleIndex[token];
      const itemEntry = entries.find((e) => e.kind === 'item' && e.tokens[0] === token);
      conflicts.push({
        kind: 'merchant_item_conflict',
        entryIds: [merchantEntry?.id ?? '', itemEntry?.id ?? ''].filter(Boolean),
        tokens: [token],
        message: `"${token}" — зарегистрирован и как магазин, и как товар; магазин имеет приоритет`,
        winnerId: merchantEntry?.id,
      });
    }
  }

  // modifier_item_conflict: modifier prefix is also an item keyword
  for (const token of MODIFIER_PREFIXES) {
    if (token in ITEMS) {
      const itemEntry = entries.find((e) => e.kind === 'item' && e.tokens[0] === token);
      const modEntry = entries.find(
        (e) => e.kind === 'modifier' && e.tokens[0] === token,
      );
      conflicts.push({
        kind: 'modifier_item_conflict',
        entryIds: [modEntry?.id ?? '', itemEntry?.id ?? ''].filter(Boolean),
        tokens: [token],
        message: `"${token}" — модификатор-префикс и токен товара; модификатор имеет приоритет в контексте префикса`,
        winnerId: modEntry?.id,
      });
    }
  }

  // orphan_alias: alias key has no matching merchant in registry
  const storeIds = new Set(
    entries
      .filter((e) => e.kind === 'merchant')
      .map((e) => (e as MerchantEntry).storeId),
  );
  const aliasEntries = entries.filter((e) => e.kind === 'alias') as AliasEntry[];
  for (const alias of aliasEntries) {
    const matchesMerchant = entries.some(
      (e) =>
        e.kind === 'merchant' &&
        (e as MerchantEntry).aliases.includes(alias.canonical),
    );
    const canonicalExists =
      alias.canonical in ITEMS ||
      entries.some((e) => e.tokens.join(' ') === alias.canonical);
    if (!matchesMerchant && !canonicalExists) {
      conflicts.push({
        kind: 'orphan_alias',
        entryIds: [alias.id],
        tokens: alias.tokens,
        message: `"${alias.tokens.join(' ')}" → "${alias.canonical}" — канонический ключ не найден в реестре магазинов`,
      });
    }
  }

  return conflicts;
}

// ── Registry singleton ────────────────────────────────────────────────────────

let _registry: SemanticRegistry | null = null;

/**
 * Build (or return cached) the global SemanticRegistry.
 *
 * The registry aggregates all semantic knowledge from existing sources and
 * computes a conflict report. It is read-only after construction.
 *
 * Call resetRegistry() in tests that need a fresh build after modifying state.
 */
export function getSemanticRegistry(): SemanticRegistry {
  if (_registry) return _registry;

  _idSeq = 0; // reset for deterministic IDs across test runs

  const merchantEntries = buildMerchantEntries();
  const aliasEntries = buildAliasEntries();
  const phraseEntries = buildPhraseEntries();
  const itemEntries = buildItemEntries();
  const modifierEntries = buildModifierEntries();

  const entries: AnyRegistryEntry[] = [
    ...merchantEntries,
    ...aliasEntries,
    ...phraseEntries,
    ...itemEntries,
    ...modifierEntries,
  ];

  const { singleIndex, bigramIndex, trigramIndex, aliasIndex } = buildIndexes(entries);
  const conflicts = detectConflicts(entries, singleIndex);

  _registry = { entries, conflicts, singleIndex, bigramIndex, trigramIndex, aliasIndex };
  return _registry;
}

/** Reset cached registry — for testing only. */
export function resetRegistry(): void {
  _registry = null;
  _idSeq = 0;
}
