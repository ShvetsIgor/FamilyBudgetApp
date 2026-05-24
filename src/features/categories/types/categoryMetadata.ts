/**
 * LAYER: category metadata — lightweight annotation model for categories.
 *
 * Augments the base Category entity with:
 *   aliases   — alternate names / store names for matching (e.g. "еда", "rami levi")
 *   keywords  — item-level hints (e.g. "milk", "bread", "cheese")
 *   usageCount / lastUsedAt — lightweight usage tracking for ranking
 *
 * Architecture invariants:
 *   - All fields optional. Categories without metadata work identically to before.
 *   - Store names are NOT entities — they live as aliases/tags on categories.
 *   - No AI, no embeddings. Deterministic string matching only.
 */

export interface CategoryMetadata {
  aliases?: string[];
  keywords?: string[];
  usageCount?: number;
  lastUsedAt?: string; // ISO-8601 date string
}

export function emptyCategoryMetadata(): CategoryMetadata {
  return {};
}

/**
 * Merge two metadata snapshots. Arrays are deduplicated (normalized).
 * usageCount is summed. lastUsedAt takes the more recent value.
 */
export function mergeCategoryMetadata(
  base: CategoryMetadata,
  patch: Partial<CategoryMetadata>,
): CategoryMetadata {
  return {
    aliases: dedupeNormalized([...(base.aliases ?? []), ...(patch.aliases ?? [])]),
    keywords: dedupeNormalized([...(base.keywords ?? []), ...(patch.keywords ?? [])]),
    usageCount: (base.usageCount ?? 0) + (patch.usageCount ?? 0),
    lastUsedAt: chooseLater(base.lastUsedAt, patch.lastUsedAt),
  };
}

/**
 * Increment usage count and update lastUsedAt to now.
 */
export function recordCategoryUsage(meta: CategoryMetadata): CategoryMetadata {
  return {
    ...meta,
    usageCount: (meta.usageCount ?? 0) + 1,
    lastUsedAt: new Date().toISOString(),
  };
}

/**
 * Add a new alias without duplicating existing ones.
 * Returns the same array if alias already present.
 */
export function addAlias(meta: CategoryMetadata, alias: string): CategoryMetadata {
  const norm = alias.toLowerCase().trim();
  const existing = (meta.aliases ?? []).map((a) => a.toLowerCase().trim());
  if (existing.includes(norm)) return meta;
  return { ...meta, aliases: [...(meta.aliases ?? []), alias.trim()] };
}

/**
 * Add a keyword without duplicating.
 */
export function addKeyword(meta: CategoryMetadata, keyword: string): CategoryMetadata {
  const norm = keyword.toLowerCase().trim();
  const existing = (meta.keywords ?? []).map((k) => k.toLowerCase().trim());
  if (existing.includes(norm)) return meta;
  return { ...meta, keywords: [...(meta.keywords ?? []), keyword.trim()] };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function dedupeNormalized(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item.trim());
    }
  }
  return result;
}

function chooseLater(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}
