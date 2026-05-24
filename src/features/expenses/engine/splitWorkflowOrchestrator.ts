/**
 * LAYER: split workflow orchestrator — extended split review orchestration.
 *
 * Extends splitReviewOrchestrator.ts with:
 *   - Grouped multi-group split review
 *   - Partial split approval (some items accepted, others deferred)
 *   - Deferred split clarification (hint within a split deferred separately)
 *   - Semantic correction during split review (change category inline)
 *   - Grouped modifier review
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Builds on SplitProjection from splitReviewOrchestrator.ts.
 *   - Returns new objects; never modifies existing projections.
 */

import type { ParserContext } from './inputPipeline';
import type { PurchaseGroup } from './purchaseGroup';
import type { SplitProjection, SplitItemProjection } from './runtimeProjection';
import type { DeferredItem } from './runtimeWorkflow';
import { buildSplitProjection } from './splitReviewOrchestrator';
import { deferItem } from './workflowOrchestrator';

// ── Grouped split review ──────────────────────────────────────────────────────

export interface GroupedSplitReview {
  groups: SplitGroupReview[];
  totalItems: number;
  totalResolved: number;
  totalDeferred: number;
  canConfirmAll: boolean;
}

export interface SplitGroupReview {
  groupId: string;
  projection: SplitProjection;
  isApproved: boolean;
  isDeferred: boolean;
  approvedItemIds: string[];
  deferredItemIds: string[];
}

/**
 * Build a grouped split review from multiple pending groups.
 * Includes per-group approval and deferral tracking.
 */
export function buildGroupedSplitReview(
  groups: PurchaseGroup[],
  ctx: ParserContext,
  approvedGroups: Set<string> = new Set(),
  deferredItems: DeferredItem[] = [],
): GroupedSplitReview {
  const deferredIds = new Set(deferredItems.map((d) => d.id));

  const groupReviews: SplitGroupReview[] = groups.map((group) => {
    const projection = buildSplitProjection(group, ctx);
    const isDeferred = deferredIds.has(group.id);
    const isApproved = approvedGroups.has(group.id);

    const approvedItemIds = isApproved ? group.itemFragmentIds : [];
    const deferredItemIds = group.itemFragmentIds.filter((id) => deferredIds.has(id));

    return {
      groupId: group.id,
      projection,
      isApproved,
      isDeferred,
      approvedItemIds,
      deferredItemIds,
    };
  });

  const totalItems = groupReviews.reduce((sum, g) => sum + g.projection.items.length, 0);
  const totalResolved = groupReviews.reduce(
    (sum, g) => sum + g.projection.items.filter((i) => i.categoryId !== undefined).length,
    0,
  );
  const totalDeferred = deferredItems.filter((d) => d.kind === 'group').length;
  const canConfirmAll = groupReviews.every((g) => g.isApproved || g.isDeferred || g.projection.canConfirm);

  return { groups: groupReviews, totalItems, totalResolved, totalDeferred, canConfirmAll };
}

// ── Partial split approval ────────────────────────────────────────────────────

export interface PartialSplitApprovalResult {
  groupId: string;
  approvedItems: SplitItemProjection[];
  deferredItems: SplitItemProjection[];
  updatedProjection: SplitProjection;
  canConfirmApproved: boolean;
}

/**
 * Approve only a subset of split items.
 * Deferred items are removed from the projection temporarily.
 */
export function approvePartialSplit(
  projection: SplitProjection,
  approvedItemIds: string[],
): PartialSplitApprovalResult {
  const approved = projection.items.filter((i) => approvedItemIds.includes(i.fragmentId));
  const deferred = projection.items.filter((i) => !approvedItemIds.includes(i.fragmentId));

  const updatedProjection: SplitProjection = {
    ...projection,
    items: approved,
    canConfirm: approved.length > 0 && approved.every((i) => i.categoryId !== undefined),
  };

  return {
    groupId: projection.groupId,
    approvedItems: approved,
    deferredItems: deferred,
    updatedProjection,
    canConfirmApproved: updatedProjection.canConfirm,
  };
}

// ── Deferred split clarification ──────────────────────────────────────────────

/**
 * Defer a specific split item's clarification hint.
 * Returns updated deferredItems list.
 */
export function deferSplitClarification(
  deferredItems: DeferredItem[],
  groupId: string,
  hintId: string,
): DeferredItem[] {
  // Defer both the hint and record the group context
  let updated = deferItem(deferredItems, hintId, 'hint', 'user_skipped');
  // Also track that this hint belongs to a split group (store group as deferred if not already)
  updated = deferItem(updated, `${groupId}:${hintId}`, 'hint', 'auto_deferred');
  return updated;
}

// ── Semantic correction during split review ───────────────────────────────────

export interface SplitCorrectionResult {
  groupId: string;
  fragmentId: string;
  previousCategoryId: string | undefined;
  newCategoryId: string;
  updatedProjection: SplitProjection;
}

/**
 * Apply an inline category correction to a split item.
 * Returns updated projection with the corrected item.
 */
export function applySplitCorrection(
  projection: SplitProjection,
  fragmentId: string,
  categoryId: string,
): SplitCorrectionResult {
  const item = projection.items.find((i) => i.fragmentId === fragmentId);
  const previousCategoryId = item?.categoryId;

  const updatedItems: SplitItemProjection[] = projection.items.map((i) =>
    i.fragmentId === fragmentId ? { ...i, categoryId } : i,
  );

  const updatedProjection: SplitProjection = {
    ...projection,
    items: updatedItems,
    canConfirm: updatedItems.length > 0 && updatedItems.every((i) => i.categoryId !== undefined),
  };

  return {
    groupId: projection.groupId,
    fragmentId,
    previousCategoryId,
    newCategoryId: categoryId,
    updatedProjection,
  };
}

// ── Grouped modifier review ───────────────────────────────────────────────────

export interface ModifierReview {
  groupId: string;
  modifiers: ModifierItemVM[];
  totalModifiers: number;
  unresolvedModifiers: number;
}

export interface ModifierItemVM {
  fragmentId: string;
  rawText: string;
  targetItemId?: string;
  isAmbiguous: boolean;
}

/**
 * Build a modifier review view model for a split group.
 * Identifies ambiguous modifiers (those with no clear target item).
 */
export function buildModifierReview(
  group: PurchaseGroup,
  ctx: ParserContext,
): ModifierReview {
  const modifiers: ModifierItemVM[] = group.modifierFragmentIds.map((fragId) => {
    const frag = ctx.fragments.find((f) => f.id === fragId);
    const rawText = frag?.rawValue ?? fragId;

    // Find if there's a scope assigning this modifier to an item
    const scope = ctx.scopes.find((s) => s.modifierPhraseIds.length > 0);
    const hasTarget = scope !== undefined && group.itemFragmentIds.length > 0;

    return {
      fragmentId: fragId,
      rawText,
      targetItemId: hasTarget ? group.itemFragmentIds[0] : undefined,
      isAmbiguous: !hasTarget || group.itemFragmentIds.length > 1,
    };
  });

  const unresolvedModifiers = modifiers.filter((m) => m.isAmbiguous).length;

  return {
    groupId: group.id,
    modifiers,
    totalModifiers: modifiers.length,
    unresolvedModifiers,
  };
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * True when a group review has all items resolved or explicitly deferred.
 */
export function isGroupReviewComplete(review: SplitGroupReview): boolean {
  return (
    review.isApproved ||
    review.isDeferred ||
    review.projection.canConfirm
  );
}

/**
 * Get all group reviews that are not yet complete.
 */
export function pendingGroupReviews(grouped: GroupedSplitReview): SplitGroupReview[] {
  return grouped.groups.filter((g) => !isGroupReviewComplete(g));
}

/**
 * Build a human-readable summary of the grouped split review.
 */
export function buildGroupedSplitSummary(grouped: GroupedSplitReview): string {
  const total = grouped.groups.length;
  const done = grouped.groups.filter(isGroupReviewComplete).length;
  if (done === total) return `All ${total} split group(s) reviewed.`;
  return `${done}/${total} groups reviewed — ${total - done} remaining.`;
}
