/**
 * LAYER: session memory — isolation between global and session-scoped memory.
 *
 * Problem: split memory and parser memory were starting to mix together.
 * Solution: explicit two-tier memory model.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Global Memory (SuggestionMemoryState) — persisted      │
 * │    merchants, category history, split combos, tags      │
 * │    Written only on expense confirmation.                │
 * └─────────────────────────────────────────────────────────┘
 *       ↑  only via buildGlobalMemoryPatch() + explicit dispatch
 * ┌─────────────────────────────────────────────────────────┐
 * │  Session Memory — transient, current session only       │
 * │    tentative merchant, tentative categories, tags       │
 * │    contextual referents ("еще tools" → current split)  │
 * │    Expires at session end. Never auto-persisted.        │
 * └─────────────────────────────────────────────────────────┘
 *
 * Architecture invariants:
 *   - Pure functions. No mutations. No Redux.
 *   - Session memory is created fresh per session.
 *   - buildGlobalMemoryPatch() is the ONLY bridge from session → global.
 *   - Contextual referents expire at session end — never stored globally.
 *   - Tentative data is only promoted to global on explicit confirmation.
 */

// ── Contextual referent ───────────────────────────────────────────────────────

/**
 * Tracks what "that" / "еще X" refers to within the current session context.
 * Used to resolve implicit references without storing them in global memory.
 */
export interface ContextualReferent {
  kind: 'split_item' | 'merchant' | 'category' | 'amount';
  referentId: string;
  label: string;
  addedAt: string;
}

// ── Session memory model ──────────────────────────────────────────────────────

export interface SessionMemory {
  sessionId: string;
  createdAt: string;

  /** Merchant detected this session — not persisted until expense confirmed. */
  tentativeMerchant?: string;
  tentativeMerchantKey?: string;

  /** Category IDs selected this session — not written to global until confirmed. */
  tentativeCategories: string[];

  /** Tags observed this session — not written to tagAssociations until confirmed. */
  tentativeTags: string[];

  /** Split preset IDs considered this session (for future ranking hints). */
  referencedSplitIds: string[];

  /** Contextual referents — what the user's implicit references point to. */
  contextualReferents: ContextualReferent[];
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createSessionMemory(
  sessionId: string,
  now = new Date().toISOString(),
): SessionMemory {
  return {
    sessionId,
    createdAt: now,
    tentativeMerchant: undefined,
    tentativeMerchantKey: undefined,
    tentativeCategories: [],
    tentativeTags: [],
    referencedSplitIds: [],
    contextualReferents: [],
  };
}

// ── Mutation helpers (all return new objects) ─────────────────────────────────

export function setTentativeMerchant(
  mem: SessionMemory,
  merchant: string,
  merchantKey: string,
): SessionMemory {
  return { ...mem, tentativeMerchant: merchant, tentativeMerchantKey: merchantKey };
}

export function addTentativeCategory(mem: SessionMemory, categoryId: string): SessionMemory {
  if (mem.tentativeCategories.includes(categoryId)) return mem;
  return { ...mem, tentativeCategories: [...mem.tentativeCategories, categoryId] };
}

export function addTentativeTag(mem: SessionMemory, tag: string): SessionMemory {
  const normalized = tag.toLowerCase().trim();
  if (mem.tentativeTags.includes(normalized)) return mem;
  return { ...mem, tentativeTags: [...mem.tentativeTags, normalized] };
}

export function addReferencedSplitId(mem: SessionMemory, splitPresetId: string): SessionMemory {
  if (mem.referencedSplitIds.includes(splitPresetId)) return mem;
  return { ...mem, referencedSplitIds: [...mem.referencedSplitIds, splitPresetId] };
}

export function addContextualReferent(
  mem: SessionMemory,
  referent: ContextualReferent,
): SessionMemory {
  return { ...mem, contextualReferents: [...mem.contextualReferents, referent] };
}

export function removeContextualReferent(
  mem: SessionMemory,
  referentId: string,
): SessionMemory {
  return {
    ...mem,
    contextualReferents: mem.contextualReferents.filter((r) => r.referentId !== referentId),
  };
}

// ── Global memory flush ───────────────────────────────────────────────────────

/**
 * Fields from session memory to apply to global memory on expense confirmation.
 * Caller applies this to SuggestionMemoryState via Redux dispatch.
 */
export interface GlobalMemoryPatch {
  merchantKey?: string;
  merchantDisplay?: string;
  confirmedCategoryIds: string[];
  confirmedTags: string[];
}

/**
 * Extract the global memory patch from a completed session memory.
 * Call this ONLY when the expense has been explicitly confirmed.
 */
export function buildGlobalMemoryPatch(mem: SessionMemory): GlobalMemoryPatch {
  return {
    merchantKey: mem.tentativeMerchantKey,
    merchantDisplay: mem.tentativeMerchant,
    confirmedCategoryIds: [...mem.tentativeCategories],
    confirmedTags: [...mem.tentativeTags],
  };
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function resolveReferent(
  mem: SessionMemory,
  referentId: string,
): ContextualReferent | undefined {
  return mem.contextualReferents.find((r) => r.referentId === referentId);
}

export function getLatestReferent(mem: SessionMemory): ContextualReferent | undefined {
  return mem.contextualReferents[mem.contextualReferents.length - 1];
}

export function hasContextualReferents(mem: SessionMemory): boolean {
  return mem.contextualReferents.length > 0;
}

export function hasTentativeData(mem: SessionMemory): boolean {
  return (
    mem.tentativeMerchant !== undefined ||
    mem.tentativeCategories.length > 0 ||
    mem.tentativeTags.length > 0
  );
}
