/**
 * LAYER: parser inspector — semantic explainability for pipeline output.
 *
 * Annotates ParserContext with human-readable explanations:
 *   - WHY a phrase matched (which dictionary rule fired)
 *   - WHY a fragment was typed (which phrase produced it)
 *   - WHY a clarification was triggered (which signal caused it)
 *   - WHY a scope formed (which phrases were grouped)
 *   - WHICH semantic rules applied (ordered by pipeline stage)
 *
 * Use cases:
 *   - Constructor UI "parser preview" panel
 *   - Debugging semantic dictionary coverage
 *   - Explaining ranking decisions to users
 *   - Automated regression inspection in tests
 *
 * Architecture invariants:
 *   - Pure functions: same ParserContext → same InspectionReport (deterministic).
 *   - Does NOT re-run the pipeline — works from existing ParserContext fields.
 *   - No side effects, no mutations.
 *   - No AI, no embeddings, no probabilistic logic.
 */

import type { ParserContext } from './inputPipeline';
import type { SemanticPhrase } from './semanticPhrase';
import type { SemanticFragment, ClarificationHint } from './semanticFragment';
import type { SemanticScope, ScopeHint } from './semanticScope';

// ── Explanation models ────────────────────────────────────────────────────────

/**
 * Explains why a single SemanticPhrase was extracted.
 * matchedRule = the pipeline step that produced it.
 */
export interface PhraseExplanation {
  phraseId: string;
  rawText: string;
  phraseType: string;
  /** Which dictionary/rule produced this phrase. */
  matchedRule: PhraseMatchRule;
  confidence: number;
  candidateCategories: string[];
  tokenSpan: number; // how many tokens this phrase covers
}

export type PhraseMatchRule =
  | 'amount_token'          // step 1: amount token
  | 'noise_token'           // step 2b: noise token (no modifier)
  | 'modifier_noise_prefix' // step 2a: noise token that is a modifier prefix
  | 'store_trigram'         // step 3: 3-token store name
  | 'store_bigram'          // step 4: 2-token store name
  | 'payment_phrase_table'  // step 5: payment bigram
  | 'item_bigram_table'     // step 6: item bigram
  | 'modifier_text_prefix'  // step 7: text modifier prefix bigram
  | 'store_single'          // step 8: single-token store name
  | 'memory_merchant'       // step 9: merchant recognized from usage memory
  | 'item_dictionary'       // step 10: single-token item keyword
  | 'standalone_modifier'   // step 11: standalone modifier adjective
  | 'unknown_fallback';     // step 12: unknown token → tag_phrase

/**
 * Derives the match rule from a SemanticPhrase's properties.
 * Deterministic: only inspects phrase.type, phrase.metadata, phrase.tokenIndexes.
 */
export function derivePhraseMatchRule(phrase: SemanticPhrase): PhraseMatchRule {
  const tokenCount = phrase.tokenIndexes.length;
  const meta = phrase.metadata ?? {};

  switch (phrase.type) {
    case 'amount_phrase':
      return 'amount_token';

    case 'noise_phrase':
      return 'noise_token';

    case 'merchant_phrase':
      if (meta.source === 'memory') return 'memory_merchant';
      if (tokenCount === 3) return 'store_trigram';
      if (tokenCount === 2) return 'store_bigram';
      return 'store_single';

    case 'payment_phrase':
      return 'payment_phrase_table';

    case 'item_phrase':
      if (tokenCount >= 2) return 'item_bigram_table';
      return 'item_dictionary';

    case 'modifier_phrase':
      if (tokenCount >= 2) {
        // Discriminate: noise prefix vs text prefix
        // noise prefix produces modifier from step 2a (rawText contains noise token)
        // text prefix produces modifier from step 7
        // We can't perfectly discriminate without re-running — use metadata hint if present
        const role = meta.prefixKind as string | undefined;
        if (role === 'noise') return 'modifier_noise_prefix';
        return 'modifier_text_prefix';
      }
      return 'standalone_modifier';

    case 'tag_phrase':
      return 'unknown_fallback';
  }
}

/** Explains why a SemanticFragment was typed. */
export interface FragmentExplanation {
  fragmentId: string;
  rawValue: string;
  fragmentType: string;
  derivedFromPhraseId: string;
  derivedFromPhraseType: string;
  confidence: number;
  note?: string; // e.g., 'payment:true metadata inherited'
}

/** Explains why a ClarificationHint was emitted. */
export interface ClarificationExplanation {
  hintKind: string;
  fragmentId: string;
  triggerReason: string;
  candidates: string[];
}

/** Explains why a SemanticScope formed and how modifiers attached. */
export interface ScopeExplanation {
  scopeId: string;
  rootPhraseId: string;
  rootRawText: string;
  scopeType: string;
  modifierAttachments: Array<{
    modifierPhraseId: string;
    modifierRawText: string;
    distanceInPhrases: number;
    wasAmbiguous: boolean;
  }>;
  relatedPhraseIds: string[];
}

/** Full inspection report for one parser run. */
export interface InspectionReport {
  raw: string;
  /** Which pipeline stages fired (in order). */
  appliedRules: PhraseMatchRule[];
  phraseExplanations: PhraseExplanation[];
  fragmentExplanations: FragmentExplanation[];
  clarificationExplanations: ClarificationExplanation[];
  scopeExplanations: ScopeExplanation[];
  /** Summary: confident vs. ambiguous outcome. */
  outcome: 'confident' | 'ambiguous' | 'empty';
}

// ── Builders ──────────────────────────────────────────────────────────────────

function buildPhraseExplanations(phrases: SemanticPhrase[]): PhraseExplanation[] {
  return phrases.map((phrase) => {
    const rule = derivePhraseMatchRule(phrase);
    const categoryIds =
      (phrase.metadata?.categoryIds as string[] | undefined) ??
      (phrase.metadata?.categoryId ? [phrase.metadata.categoryId as string] : []);
    return {
      phraseId: phrase.id,
      rawText: phrase.rawText,
      phraseType: phrase.type,
      matchedRule: rule,
      confidence: phrase.confidence,
      candidateCategories: categoryIds,
      tokenSpan: phrase.tokenIndexes.length,
    };
  });
}

function buildFragmentExplanations(
  fragments: SemanticFragment[],
  phrases: SemanticPhrase[],
): FragmentExplanation[] {
  return fragments.map((fragment, idx) => {
    // Fragment IDs are f0, f1, ... matching phrase order (after skipping noise_phrase)
    // Find the matching phrase by index correlation
    const nonNoisePhrases = phrases.filter((p) => p.type !== 'noise_phrase');
    const matchingPhrase = nonNoisePhrases[idx];

    const note =
      fragment.metadata?.payment === true
        ? 'payment:true metadata inherited'
        : undefined;

    return {
      fragmentId: fragment.id,
      rawValue: fragment.rawValue,
      fragmentType: fragment.type,
      derivedFromPhraseId: matchingPhrase?.id ?? 'unknown',
      derivedFromPhraseType: matchingPhrase?.type ?? 'unknown',
      confidence: fragment.confidence,
      note,
    };
  });
}

function buildClarificationExplanations(
  hints: ClarificationHint[],
): ClarificationExplanation[] {
  return hints.map((hint) => {
    let triggerReason: string;
    switch (hint.kind) {
      case 'unknown_merchant':
        triggerReason = 'первый значимый фрагмент — тег (не найден в словаре и памяти)';
        break;
      case 'ambiguous_item':
        triggerReason = 'магазин с needsContext:true и без категорий';
        break;
      case 'multiple_categories':
        triggerReason = '2+ товаров с разными категориями → возможен сплит';
        break;
      case 'conflicting_signals':
        triggerReason = '2+ вероятных магазина в одном вводе';
        break;
      default:
        triggerReason = 'неизвестный триггер';
    }
    return {
      hintKind: hint.kind,
      fragmentId: hint.fragmentId,
      triggerReason,
      candidates: hint.candidates,
    };
  });
}

function buildScopeExplanations(
  scopes: SemanticScope[],
  scopeHints: ScopeHint[],
  phrases: SemanticPhrase[],
): ScopeExplanation[] {
  const phraseById = new Map<string, SemanticPhrase>(phrases.map((p) => [p.id, p]));
  const ambiguousModifierIds = new Set(
    scopeHints
      .filter((h) => h.kind === 'ambiguous_modifier_target')
      .map((h) => h.phraseId),
  );

  return scopes.map((scope) => {
    const rootPhrase = phraseById.get(scope.rootPhraseId);
    const rootIdx = phrases.findIndex((p) => p.id === scope.rootPhraseId);

    const modifierAttachments = scope.modifierPhraseIds.map((mid) => {
      const modPhrase = phraseById.get(mid);
      const modIdx = phrases.findIndex((p) => p.id === mid);
      return {
        modifierPhraseId: mid,
        modifierRawText: modPhrase?.rawText ?? mid,
        distanceInPhrases: Math.abs(modIdx - rootIdx),
        wasAmbiguous: ambiguousModifierIds.has(mid),
      };
    });

    return {
      scopeId: scope.id,
      rootPhraseId: scope.rootPhraseId,
      rootRawText: rootPhrase?.rawText ?? scope.rootPhraseId,
      scopeType: scope.type,
      modifierAttachments,
      relatedPhraseIds: scope.relatedPhraseIds,
    };
  });
}

function computeOutcome(ctx: ParserContext): InspectionReport['outcome'] {
  if (!ctx.raw.trim()) return 'empty';
  if (ctx.clarificationHints.length > 0) return 'ambiguous';
  return 'confident';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a full InspectionReport from an already-computed ParserContext.
 *
 * Does NOT re-run the pipeline. All information is derived from ctx fields.
 * Safe to call multiple times — pure function.
 *
 * @param ctx  Output of parseInput() from inputPipeline.ts.
 * @returns    Human-readable explanations for every pipeline decision.
 */
export function inspectParserOutput(ctx: ParserContext): InspectionReport {
  const phraseExplanations = buildPhraseExplanations(ctx.phrases);
  const fragmentExplanations = buildFragmentExplanations(ctx.fragments, ctx.phrases);
  const clarificationExplanations = buildClarificationExplanations(ctx.clarificationHints);
  const scopeExplanations = buildScopeExplanations(ctx.scopes, ctx.scopeHints, ctx.phrases);

  const appliedRules = [...new Set(phraseExplanations.map((e) => e.matchedRule))];

  return {
    raw: ctx.raw,
    appliedRules,
    phraseExplanations,
    fragmentExplanations,
    clarificationExplanations,
    scopeExplanations,
    outcome: computeOutcome(ctx),
  };
}

/**
 * Quick helper: explain only the phrase matching for a given input.
 * Lighter than the full report — useful for the constructor preview panel.
 */
export function explainPhraseMatches(ctx: ParserContext): PhraseExplanation[] {
  return buildPhraseExplanations(ctx.phrases);
}

/**
 * Quick helper: list all semantic rules that fired for the given input.
 */
export function listAppliedRules(ctx: ParserContext): PhraseMatchRule[] {
  return [...new Set(ctx.phrases.map(derivePhraseMatchRule))];
}
