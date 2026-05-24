/**
 * LAYER: clarification presenter — builds ClarificationGroup[] for UX rendering.
 *
 * Transforms ClarificationHint[] + PolicyDecision[] into grouped, prioritized,
 * progressive-disclosure-ready view models for the clarification UI.
 *
 * Key behaviors:
 *   - Only hints with 'ask' or 'escalate' decisions are presented
 *   - Hints are grouped by kind (same-kind hints = one group)
 *   - Groups are sorted by priority (conflicting_signals first)
 *   - Each group can be collapsed when lower-priority
 *   - Options are derived from hint.candidates (or empty = free-text)
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Questions come from hint.message or generated defaults.
 *   - ambiguityScore in cards comes from scoreHintAmbiguity().
 */

import type { ClarificationHint } from './semanticFragment';
import type { PolicyDecision } from './runtimePolicy';
import type { ClarificationCardViewModel, ClarificationGroup, ClarificationOption } from './runtimeProjection';
import { scoreHintAmbiguity } from './ambiguityScorer';

// ── Priority map (mirrors clarificationOrchestrator) ─────────────────────────

const KIND_PRIORITY: Record<string, number> = {
  conflicting_signals: 0,
  unknown_merchant:    1,
  ambiguous_item:      2,
  multiple_categories: 3,
};

// ── Default questions ─────────────────────────────────────────────────────────

const DEFAULT_QUESTIONS: Record<string, string> = {
  conflicting_signals: 'Multiple merchants detected — which is the correct one?',
  unknown_merchant:    'This merchant is not recognized — what is it?',
  ambiguous_item:      'What category best fits this item?',
  multiple_categories: 'Multiple categories are possible — which applies?',
};

// ── Card builder ──────────────────────────────────────────────────────────────

export function buildClarificationCard(
  hint: ClarificationHint,
  decision: PolicyDecision,
): ClarificationCardViewModel {
  const score = scoreHintAmbiguity(hint);
  const options: ClarificationOption[] = hint.candidates.map((id) => ({
    id,
    label: id, // UI layer maps categoryId → display name
  }));

  return {
    hintId: hint.fragmentId,
    question: hint.message ?? DEFAULT_QUESTIONS[hint.kind] ?? `Clarify: ${hint.kind}`,
    options,
    hintKind: hint.kind,
    ambiguityScore: score.score,
    isRequired: !score.isAutoResolvable,
  };
}

// ── Group builder ─────────────────────────────────────────────────────────────

/**
 * Build ClarificationCardViewModel[] from hints, filtering to only those
 * with 'ask' or 'escalate' policy decisions.
 */
export function buildClarificationCards(
  hints: ClarificationHint[],
  decisions: PolicyDecision[],
): ClarificationCardViewModel[] {
  const visibleDecisionIds = new Set(
    decisions
      .filter((d) => d.action === 'ask' || d.action === 'escalate')
      .map((d) => d.targetId),
  );

  return hints
    .filter((h) => visibleDecisionIds.has(h.fragmentId))
    .map((h) => {
      const dec = decisions.find((d) => d.targetId === h.fragmentId)!;
      return buildClarificationCard(h, dec);
    });
}

/**
 * Group ClarificationCardViewModel[] by hint kind.
 * Groups are sorted by priority (conflicting_signals first).
 * Only groups with ≥1 card are returned.
 */
export function groupClarificationCards(
  cards: ClarificationCardViewModel[],
): ClarificationGroup[] {
  const byKind = new Map<string, ClarificationCardViewModel[]>();
  for (const card of cards) {
    const existing = byKind.get(card.hintKind) ?? [];
    existing.push(card);
    byKind.set(card.hintKind, existing);
  }

  return [...byKind.entries()]
    .map(([kind, kindCards], idx) => ({
      id: `cg_${kind}`,
      kind,
      cards: kindCards,
      priority: KIND_PRIORITY[kind] ?? 99,
      isCollapsible: (KIND_PRIORITY[kind] ?? 99) > 1, // only lower-priority groups collapse
      isExpanded: (KIND_PRIORITY[kind] ?? 99) <= 1,   // high-priority groups start expanded
    }))
    .sort((a, b) => a.priority - b.priority);
}

// ── Group state helpers ───────────────────────────────────────────────────────

export function collapseGroup(group: ClarificationGroup): ClarificationGroup {
  if (!group.isCollapsible) return group;
  return { ...group, isExpanded: false };
}

export function expandGroup(group: ClarificationGroup): ClarificationGroup {
  return { ...group, isExpanded: true };
}

/**
 * Returns true when this group should be shown given the current behavior.
 * High-priority groups are always shown. Lower-priority groups may be hidden.
 */
export function shouldShowGroup(
  group: ClarificationGroup,
  maxVisiblePriority: number,
): boolean {
  return group.priority <= maxVisiblePriority;
}

/**
 * Filter groups to only those that should be shown.
 * 'minimal' → only priority 0 (conflicting_signals)
 * 'ask_immediately' → all groups
 * 'defer_low_priority' → priority 0–1
 * 'suppress' → none
 */
export function filterGroupsForBehavior(
  groups: ClarificationGroup[],
  behavior: string,
): ClarificationGroup[] {
  switch (behavior) {
    case 'ask_immediately':
    case 'batch_by_kind':
      return groups;
    case 'minimal':
      return groups.filter((g) => shouldShowGroup(g, 0));
    case 'defer_low_priority':
      return groups.filter((g) => shouldShowGroup(g, 1));
    case 'suppress':
      return [];
    default:
      return groups;
  }
}

/**
 * Count total hints across all visible groups.
 */
export function countVisibleHints(groups: ClarificationGroup[]): number {
  return groups.reduce((sum, g) => sum + g.cards.length, 0);
}

/**
 * Get the highest-priority card from all groups (the one to show first).
 */
export function getPrimaryCard(groups: ClarificationGroup[]): ClarificationCardViewModel | undefined {
  return groups[0]?.cards[0];
}
