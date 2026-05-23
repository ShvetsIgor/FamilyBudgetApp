/**
 * LAYER: regression inspector — batch parser output validation.
 *
 * Runs a set of RegressionCase definitions against the current parser state
 * and reports which cases pass/fail. Designed to protect the semantic registry
 * from regressions when changeset operations are applied.
 *
 * Use cases:
 *   - Before applying a changeset: run regression suite to confirm current behavior
 *   - After a simulated change: compare results to detect breakage
 *   - CI-style snapshot testing of parser output
 *
 * A RegressionCase specifies expected parser outputs for one input string.
 * Every expectation is optional — only specified fields are asserted.
 *
 * Architecture invariants:
 *   - Pure function: same cases → same report (deterministic).
 *   - Calls parseInput() — shares the production parsing path.
 *   - No mutations, no side effects.
 *   - No AI, no embeddings, no probabilistic logic.
 */

import { parseInput } from './inputPipeline';
import type { ParserContext } from './inputPipeline';

// ── Case model ────────────────────────────────────────────────────────────────

/**
 * One regression assertion: what the parser is expected to produce for `input`.
 * All expectation fields are optional. Missing fields are not checked.
 */
export interface RegressionCase {
  id: string;
  input: string;
  /** Expected amount (exact match). */
  expectedAmount?: number;
  /** Expected merchant string (exact match). */
  expectedMerchant?: string;
  /** Expected merchantKey (exact match). */
  expectedMerchantKey?: string;
  /** Expected phrase types in order (array must be exact subset). */
  expectedPhraseTypes?: string[];
  /** Expected fragment types in order (partial match). */
  expectedFragmentTypes?: string[];
  /** Expected item candidates (all must be present). */
  expectedItemCandidates?: string[];
  /** Expected clarification kinds (all must be present). */
  expectedClarificationKinds?: string[];
  /** True if NO clarification hints should be present. */
  expectNoClarification?: boolean;
  /** Expected scope count. */
  expectedScopeCount?: number;
}

// ── Result model ──────────────────────────────────────────────────────────────

export interface RegressionIssue {
  field: string;
  expected: unknown;
  actual: unknown;
  message: string;
}

export interface RegressionCaseResult {
  caseId: string;
  input: string;
  passed: boolean;
  issues: RegressionIssue[];
  /** Snapshot of relevant parser output for this case. */
  actual: {
    amount: number | undefined;
    merchant: string | undefined;
    merchantKey: string | undefined;
    phraseTypes: string[];
    fragmentTypes: string[];
    itemCandidates: string[];
    clarificationKinds: string[];
    scopeCount: number;
  };
}

export interface RegressionReport {
  cases: RegressionCaseResult[];
  totalCases: number;
  passedCases: number;
  failedCases: number;
  /** True if all cases passed. */
  allPassed: boolean;
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

function assertExact<T>(
  field: string,
  expected: T | undefined,
  actual: T,
  issues: RegressionIssue[],
): void {
  if (expected === undefined) return;
  if (expected !== actual) {
    issues.push({
      field,
      expected,
      actual,
      message: `${field}: ожидалось ${JSON.stringify(expected)}, получено ${JSON.stringify(actual)}`,
    });
  }
}

function assertSubset(
  field: string,
  expected: string[] | undefined,
  actual: string[],
  issues: RegressionIssue[],
): void {
  if (!expected) return;
  const missing = expected.filter((e) => !actual.includes(e));
  if (missing.length > 0) {
    issues.push({
      field,
      expected,
      actual,
      message: `${field}: отсутствуют [${missing.join(', ')}]; получено [${actual.join(', ')}]`,
    });
  }
}

function assertOrderedTypes(
  field: string,
  expected: string[] | undefined,
  actual: string[],
  issues: RegressionIssue[],
): void {
  if (!expected) return;
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    issues.push({
      field,
      expected,
      actual,
      message: `${field}: ожидался порядок [${expected.join(', ')}], получен [${actual.join(', ')}]`,
    });
  }
}

// ── Case runner ───────────────────────────────────────────────────────────────

function runCase(testCase: RegressionCase): RegressionCaseResult {
  const ctx: ParserContext = parseInput(testCase.input);
  const issues: RegressionIssue[] = [];

  const actual = {
    amount: ctx.amount,
    merchant: ctx.merchant,
    merchantKey: ctx.merchantKey,
    phraseTypes: ctx.phrases.map((p) => p.type),
    fragmentTypes: ctx.fragments.map((f) => f.type),
    itemCandidates: ctx.itemCandidates,
    clarificationKinds: ctx.clarificationHints.map((h) => h.kind),
    scopeCount: ctx.scopes.length,
  };

  assertExact('amount', testCase.expectedAmount, actual.amount, issues);
  assertExact('merchant', testCase.expectedMerchant, actual.merchant, issues);
  assertExact('merchantKey', testCase.expectedMerchantKey, actual.merchantKey, issues);
  assertOrderedTypes('phraseTypes', testCase.expectedPhraseTypes, actual.phraseTypes, issues);
  assertSubset('fragmentTypes', testCase.expectedFragmentTypes, actual.fragmentTypes, issues);
  assertSubset('itemCandidates', testCase.expectedItemCandidates, actual.itemCandidates, issues);
  assertSubset('clarificationKinds', testCase.expectedClarificationKinds, actual.clarificationKinds, issues);

  if (testCase.expectNoClarification === true && actual.clarificationKinds.length > 0) {
    issues.push({
      field: 'clarification',
      expected: [],
      actual: actual.clarificationKinds,
      message: `ожидалось отсутствие clarification hints, получено: [${actual.clarificationKinds.join(', ')}]`,
    });
  }

  assertExact('scopeCount', testCase.expectedScopeCount, actual.scopeCount, issues);

  return {
    caseId: testCase.id,
    input: testCase.input,
    passed: issues.length === 0,
    issues,
    actual,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run a batch of regression cases against the current parser state.
 *
 * @param cases  Regression case definitions to assert.
 * @returns      Report with pass/fail breakdown and per-case details.
 */
export function runRegressionCheck(cases: RegressionCase[]): RegressionReport {
  const results = cases.map(runCase);
  const passedCases = results.filter((r) => r.passed).length;
  return {
    cases: results,
    totalCases: results.length,
    passedCases,
    failedCases: results.length - passedCases,
    allPassed: passedCases === results.length,
  };
}

/**
 * Snapshot the current parser output for a set of inputs.
 * Useful for generating a regression baseline to lock in current behavior.
 *
 * @param inputs  Input strings to snapshot.
 * @returns       RegressionCase[] with expectedX fields populated from current output.
 */
export function snapshotRegressionBaseline(inputs: string[]): RegressionCase[] {
  return inputs.map((input, idx) => {
    const ctx = parseInput(input);
    return {
      id: `snap_${idx}`,
      input,
      expectedAmount: ctx.amount,
      expectedMerchant: ctx.merchant,
      expectedMerchantKey: ctx.merchantKey,
      expectedPhraseTypes: ctx.phrases.map((p) => p.type),
      expectedFragmentTypes: ctx.fragments.map((f) => f.type),
      expectedItemCandidates: ctx.itemCandidates,
      expectedClarificationKinds: ctx.clarificationHints.map((h) => h.kind),
      expectedScopeCount: ctx.scopes.length,
    };
  });
}

/**
 * Compare parser outputs before and after a registry change.
 * Returns a diff string listing changed fields per input.
 *
 * @param baseline  Snapshot taken before the change (from snapshotRegressionBaseline).
 * @returns         Regression report against the current parser state.
 */
export function compareToBaseline(baseline: RegressionCase[]): RegressionReport {
  return runRegressionCheck(baseline);
}
