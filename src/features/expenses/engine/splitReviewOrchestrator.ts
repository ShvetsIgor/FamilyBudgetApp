/**
 * LAYER: split review orchestrator — UX-ready split purchase view models.
 *
 * Converts a PurchaseGroup + ParserContext into a SplitProjection that the UI
 * can render as a review card with item rows, modifier labels, and a confirm button.
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Uses fragment rawValue as item label (display-safe).
 *   - Modifier associations: group-level (all modifiers listed as modifierSummary).
 *   - canConfirm: true when every item has at least one candidateCategory.
 */

import type { ParserContext } from './inputPipeline';
import type { PurchaseGroup } from './purchaseGroup';
import type { SplitProjection, SplitItemProjection } from './runtimeProjection';

// ── Item projection ───────────────────────────────────────────────────────────

export function buildSplitItemProjection(
  fragmentId: string,
  ctx: ParserContext,
): SplitItemProjection {
  const fragment = ctx.fragments.find((f) => f.id === fragmentId);
  const modifiers: string[] = [];

  if (fragment) {
    // Find modifier fragments that are close to this item in scope
    const itemScope = ctx.scopes.find(
      (s) => s.type === 'item_scope' && s.rootPhraseId,
    );
    // Collect modifiers from the same scope as this fragment's phrase
    for (const scope of ctx.scopes) {
      if (scope.modifierPhraseIds.length === 0) continue;
      // Find modifier fragments belonging to scopes that contain our item's phrase
      for (const modPhId of scope.modifierPhraseIds) {
        const modPhrase = ctx.phrases.find((p) => p.id === modPhId);
        if (modPhrase) {
          // Check if this modifier's position is near the item
          const isNear = Math.abs(
            (modPhrase.tokenIndexes[0] ?? 0) -
            (fragment.id.charCodeAt(1) || 0),
          ) < 5;
          if (isNear && modPhrase.text) {
            modifiers.push(modPhrase.text);
          }
        }
      }
    }
  }

  return {
    fragmentId,
    label: fragment?.rawValue ?? fragmentId,
    categoryId: fragment?.candidateCategories?.[0],
    modifiers: [...new Set(modifiers)], // deduplicate
  };
}

// ── Group modifiers ───────────────────────────────────────────────────────────

function buildModifierSummary(group: PurchaseGroup, ctx: ParserContext): string[] {
  return group.modifierFragmentIds
    .map((id) => ctx.fragments.find((f) => f.id === id)?.rawValue ?? id)
    .filter(Boolean);
}

// ── Split projection ──────────────────────────────────────────────────────────

export function buildSplitProjection(
  group: PurchaseGroup,
  ctx: ParserContext,
): SplitProjection {
  const items = group.itemFragmentIds.map((id) => buildSplitItemProjection(id, ctx));
  const canConfirm = items.length > 0 && items.every((item) => item.categoryId !== undefined);
  const modifierSummary = buildModifierSummary(group, ctx);

  return {
    groupId: group.id,
    items,
    totalAmount: ctx.amount,
    canConfirm,
    modifierSummary,
  };
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * True when any item in the projection is missing a categoryId.
 */
export function hasMissingCategories(projection: SplitProjection): boolean {
  return projection.items.some((i) => i.categoryId === undefined);
}

/**
 * Count items with a resolved category.
 */
export function resolvedItemCount(projection: SplitProjection): number {
  return projection.items.filter((i) => i.categoryId !== undefined).length;
}

/**
 * Build a human-readable summary of the split.
 * E.g., "2 items · 1 without category · ₪ 300"
 */
export function buildSplitSummary(projection: SplitProjection): string {
  const total = projection.items.length;
  const missing = total - resolvedItemCount(projection);
  const parts = [`${total} item${total !== 1 ? 's' : ''}`];
  if (missing > 0) parts.push(`${missing} without category`);
  if (projection.totalAmount !== undefined) parts.push(`₪ ${projection.totalAmount}`);
  return parts.join(' · ');
}
