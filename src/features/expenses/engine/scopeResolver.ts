/**
 * LAYER: scope resolver — phrase ownership assignment.
 *
 * Takes a SemanticPhrase[] (output of phraseExtractor) and produces:
 *   - SemanticScope[]  — each root phrase (item/payment/merchant) becomes a scope
 *   - ScopeHint[]      — ambiguity signals about modifier attachment
 *
 * Algorithm (deterministic, left-to-right):
 *   Step 1: Collect scope roots — item_phrase, payment_phrase, merchant_phrase
 *           each becomes one SemanticScope (in phrase-array order).
 *   Step 2: Assign modifier_phrase entries to the nearest root by phrase-array
 *           index distance. Lower-index root wins on exact tie.
 *           If no roots exist, emit orphan_modifier hint.
 *           If exactly equidistant (same distance to 2+ roots), emit
 *           ambiguous_modifier_target hint AND still attach to lower-index root.
 *   Step 3: Assign tag_phrase entries to nearest scope root as relatedPhraseIds
 *           (same nearest-by-index logic; no ambiguity hints for tags).
 *   amount_phrase and noise_phrase are ignored — they never anchor or join scopes.
 *
 * Architecture invariants:
 *   - Pure function: same inputs → same output, always (deterministic).
 *   - No AI, no embeddings, no probabilistic logic.
 *   - Only imports SemanticPhrase and scope types.
 */

import type { SemanticPhrase } from './semanticPhrase';
import type { SemanticScope, ScopeHint, ScopeType } from './semanticScope';

// ── Scope ID helper ───────────────────────────────────────────────────────────

function sid(index: number): string {
  return `s${index}`;
}

// ── Root phrase → scope type mapping ─────────────────────────────────────────

function phraseTypeToScopeType(phraseType: SemanticPhrase['type']): ScopeType | null {
  switch (phraseType) {
    case 'item_phrase':    return 'item_scope';
    case 'payment_phrase': return 'payment_scope';
    case 'merchant_phrase':return 'merchant_scope';
    default:               return null;
  }
}

// ── Nearest scope finder ──────────────────────────────────────────────────────

/**
 * Find the scope(s) nearest to phraseIndex by absolute distance.
 * Returns all scopes tied for minimum distance.
 * Scope roots are identified by their phraseIndex in the original array.
 */
function findNearestScopes(
  phraseIndex: number,
  scopeRoots: Array<{ scope: SemanticScope; rootIndex: number }>,
): Array<{ scope: SemanticScope; rootIndex: number }> {
  if (scopeRoots.length === 0) return [];

  let minDist = Infinity;
  for (const { rootIndex } of scopeRoots) {
    const dist = Math.abs(phraseIndex - rootIndex);
    if (dist < minDist) minDist = dist;
  }

  return scopeRoots.filter(({ rootIndex }) => Math.abs(phraseIndex - rootIndex) === minDist);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ScopeResolutionResult {
  scopes: SemanticScope[];
  scopeHints: ScopeHint[];
}

/**
 * Build SemanticScopes and ScopeHints from a phrase sequence.
 *
 * @param phrases  Output of extractPhrases() from phraseExtractor.ts.
 * @returns        Scope groups + ambiguity hints for the orchestration layer.
 */
export function buildSemanticScopes(phrases: SemanticPhrase[]): ScopeResolutionResult {
  const scopes: SemanticScope[] = [];
  const scopeHints: ScopeHint[] = [];

  // Step 1: collect scope roots (item / payment / merchant phrases)
  const scopeRoots: Array<{ scope: SemanticScope; rootIndex: number }> = [];

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    const scopeType = phraseTypeToScopeType(phrase.type);
    if (scopeType !== null) {
      const scope: SemanticScope = {
        id: sid(scopeRoots.length),
        rootPhraseId: phrase.id,
        modifierPhraseIds: [],
        relatedPhraseIds: [],
        type: scopeType,
        confidence: phrase.confidence,
      };
      scopeRoots.push({ scope, rootIndex: i });
      scopes.push(scope);
    }
  }

  // Step 2: assign modifier phrases to nearest root
  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    if (phrase.type !== 'modifier_phrase') continue;

    if (scopeRoots.length === 0) {
      scopeHints.push({
        kind: 'orphan_modifier',
        phraseId: phrase.id,
        candidates: [],
        message: `"${phrase.rawText}" — модификатор без контекста (нет элемента)`,
      });
      continue;
    }

    const nearest = findNearestScopes(i, scopeRoots);

    if (nearest.length > 1) {
      // Equidistant — emit hint, attach to lower-index root (first in array = earlier phrase)
      const sortedNearest = [...nearest].sort((a, b) => a.rootIndex - b.rootIndex);
      const winner = sortedNearest[0];
      winner.scope.modifierPhraseIds.push(phrase.id);
      scopeHints.push({
        kind: 'ambiguous_modifier_target',
        phraseId: phrase.id,
        candidates: nearest.map(({ scope }) => scope.rootPhraseId),
        message: `"${phrase.rawText}" — модификатор на равном расстоянии от нескольких элементов`,
      });
    } else {
      nearest[0].scope.modifierPhraseIds.push(phrase.id);
    }
  }

  // Step 3: assign tag phrases to nearest scope as relatedPhraseIds
  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    if (phrase.type !== 'tag_phrase') continue;
    if (scopeRoots.length === 0) continue;

    const nearest = findNearestScopes(i, scopeRoots);
    if (nearest.length === 0) continue;

    // Lower-index root wins on tie (same as modifier logic)
    const sortedNearest = [...nearest].sort((a, b) => a.rootIndex - b.rootIndex);
    sortedNearest[0].scope.relatedPhraseIds.push(phrase.id);
  }

  return { scopes, scopeHints };
}
