/**
 * Tests for Semantic Workflow & Runtime Validation System:
 *   - changesetValidator.ts    — validateChangeset(), isChangesetApplicable()
 *   - semanticSimulator.ts     — applyChangeset(), previewParserOutput()
 *   - regressionInspector.ts   — runRegressionCheck(), snapshotRegressionBaseline()
 *
 * Coverage:
 *   - Validation: valid ops pass, invalid ops produce correct error codes
 *   - Duplicate alias detection (error vs info)
 *   - Circular alias detection
 *   - Orphan alias warning
 *   - Invalid confidence / empty tokens
 *   - Entry not found for archive/change_precedence
 *   - Simulation: entries added to copy, original unchanged
 *   - Simulation: archive reduces precedence
 *   - Simulation: diff correctly identifies added/changed entries
 *   - Simulation: no new conflicts for non-overlapping add_phrase
 *   - Preview: phraseDiff populated when input matches added phrase
 *   - Regression: baseline snapshot + compare round-trip
 *   - Regression: failing case produces issues
 *   - Determinism across repeated calls
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateChangeset,
  isChangesetApplicable,
} from '@/features/expenses/engine/changesetValidator';
import {
  applyChangeset,
  previewParserOutput,
} from '@/features/expenses/engine/semanticSimulator';
import {
  runRegressionCheck,
  snapshotRegressionBaseline,
  compareToBaseline,
} from '@/features/expenses/engine/regressionInspector';
import {
  getSemanticRegistry,
  resetRegistry,
} from '@/features/expenses/engine/semanticRegistryBuilder';
import type {
  SemanticChangeSet,
  SemanticOperation,
} from '@/features/expenses/engine/semanticChangeset';

// ── Helpers ───────────────────────────────────────────────────────────────────

let opSeq = 0;
function op(
  type: SemanticOperation['type'],
  payload: SemanticOperation['payload'],
  description = 'test op',
): SemanticOperation {
  return { id: `op${opSeq++}`, type, payload, description };
}

function makeChangeset(operations: SemanticOperation[]): SemanticChangeSet {
  return { id: 'cs1', createdAt: 1000, operations, warnings: [] };
}

beforeEach(() => {
  opSeq = 0;
  resetRegistry();
});

// ── validateChangeset — valid operations ─────────────────────────────────────

describe('validateChangeset — valid operations', () => {
  it('add_phrase with valid tokens and confidence → no errors', () => {
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    const errors = results.filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('add_alias with unique variant → no errors', () => {
    const cs = makeChangeset([
      op('add_alias', { variant: 'uniquestore123', canonical: 'uniquestore' }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    const errors = results.filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('merge_aliases with 2 variants → no errors', () => {
    const cs = makeChangeset([
      op('merge_aliases', { variants: ['var1', 'var2'], canonical: 'canonical' }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    const errors = results.filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('change_precedence on existing entry → no errors', () => {
    const registry = getSemanticRegistry();
    const existingId = registry.entries[0].id;
    const cs = makeChangeset([
      op('change_precedence', { entryId: existingId, newPrecedence: 200 }),
    ]);
    const results = validateChangeset(cs, registry);
    const errors = results.filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('modify_normalization with non-circular values → no errors', () => {
    const cs = makeChangeset([
      op('modify_normalization', { variant: 'newvariant', canonical: 'targetstore' }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    const errors = results.filter((r) => r.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('isChangesetApplicable returns true for valid changeset', () => {
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    expect(isChangesetApplicable(cs, getSemanticRegistry())).toBe(true);
  });
});

// ── validateChangeset — errors ────────────────────────────────────────────────

describe('validateChangeset — error cases', () => {
  it('add_phrase with empty tokens → INVALID_TOKENS error', () => {
    const cs = makeChangeset([
      op('add_phrase', { tokens: [], phraseType: 'item', categoryIds: ['x'], confidence: 0.5 }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    expect(results.some((r) => r.code === 'INVALID_TOKENS' && r.severity === 'error')).toBe(true);
  });

  it('add_phrase with confidence > 1 → INVALID_CONFIDENCE error', () => {
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['milk'], phraseType: 'item', categoryIds: ['x'], confidence: 1.5 }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    expect(results.some((r) => r.code === 'INVALID_CONFIDENCE')).toBe(true);
  });

  it('add_phrase with confidence < 0 → INVALID_CONFIDENCE error', () => {
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['milk'], phraseType: 'item', categoryIds: ['x'], confidence: -0.1 }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    expect(results.some((r) => r.code === 'INVALID_CONFIDENCE')).toBe(true);
  });

  it('add_alias variant === canonical → CIRCULAR_ALIAS error', () => {
    const cs = makeChangeset([
      op('add_alias', { variant: 'store', canonical: 'store' }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    expect(results.some((r) => r.code === 'CIRCULAR_ALIAS' && r.severity === 'error')).toBe(true);
  });

  it('add_alias with existing variant pointing to different canonical → DUPLICATE_ALIAS error', () => {
    // 'dabah' already maps to 'dabbah' in the alias map
    const cs = makeChangeset([
      op('add_alias', { variant: 'dabah', canonical: 'different_store' }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    expect(results.some((r) => r.code === 'DUPLICATE_ALIAS' && r.severity === 'error')).toBe(true);
  });

  it('add_alias with existing variant pointing to same canonical → DUPLICATE_ALIAS info', () => {
    const cs = makeChangeset([
      op('add_alias', { variant: 'dabah', canonical: 'dabbah' }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    expect(results.some((r) => r.code === 'DUPLICATE_ALIAS' && r.severity === 'info')).toBe(true);
  });

  it('merge_aliases with 1 variant → MERGE_SINGLE_VARIANT error', () => {
    const cs = makeChangeset([
      op('merge_aliases', { variants: ['only_one'], canonical: 'target' }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    expect(results.some((r) => r.code === 'MERGE_SINGLE_VARIANT')).toBe(true);
  });

  it('archive_entry with non-existent id → ENTRY_NOT_FOUND error', () => {
    const cs = makeChangeset([
      op('archive_entry', { entryId: 'nonexistent_id_xyz' }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    expect(results.some((r) => r.code === 'ENTRY_NOT_FOUND' && r.severity === 'error')).toBe(true);
  });

  it('change_precedence with negative value → PRECEDENCE_UNDERFLOW error', () => {
    const registry = getSemanticRegistry();
    const existingId = registry.entries[0].id;
    const cs = makeChangeset([
      op('change_precedence', { entryId: existingId, newPrecedence: -10 }),
    ]);
    const results = validateChangeset(cs, registry);
    expect(results.some((r) => r.code === 'PRECEDENCE_UNDERFLOW')).toBe(true);
  });

  it('modify_normalization variant === canonical → CIRCULAR_ALIAS error', () => {
    const cs = makeChangeset([
      op('modify_normalization', { variant: 'same', canonical: 'same' }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    expect(results.some((r) => r.code === 'CIRCULAR_ALIAS')).toBe(true);
  });

  it('isChangesetApplicable returns false when error present', () => {
    const cs = makeChangeset([
      op('archive_entry', { entryId: 'nonexistent' }),
    ]);
    expect(isChangesetApplicable(cs, getSemanticRegistry())).toBe(false);
  });
});

// ── validateChangeset — warnings ──────────────────────────────────────────────

describe('validateChangeset — warnings', () => {
  it('add_phrase overlapping existing entry → CONFLICT_INTRODUCED warning', () => {
    // 'milk' is in the item dictionary → adding it again generates a warning
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.90 }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    expect(results.some((r) => r.code === 'CONFLICT_INTRODUCED' && r.severity === 'warning')).toBe(true);
  });

  it('add_alias with canonical not in registry → ORPHAN_ALIAS warning', () => {
    const cs = makeChangeset([
      op('add_alias', { variant: 'newvariant', canonical: 'completely_unknown_canonical_xyz' }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    expect(results.some((r) => r.code === 'ORPHAN_ALIAS' && r.severity === 'warning')).toBe(true);
  });

  it('results sorted: errors before warnings', () => {
    const cs = makeChangeset([
      // Warning: CONFLICT_INTRODUCED (milk exists)
      op('add_phrase', { tokens: ['milk'], phraseType: 'item', categoryIds: ['x'], confidence: 0.9 }),
      // Error: ENTRY_NOT_FOUND
      op('archive_entry', { entryId: 'nonexistent' }),
    ]);
    const results = validateChangeset(cs, getSemanticRegistry());
    const firstError = results.findIndex((r) => r.severity === 'error');
    const firstWarning = results.findIndex((r) => r.severity === 'warning');
    if (firstError !== -1 && firstWarning !== -1) {
      expect(firstError).toBeLessThan(firstWarning);
    }
  });
});

// ── applyChangeset — isolation ────────────────────────────────────────────────

describe('applyChangeset — isolation', () => {
  it('original registry entries count unchanged after simulation', () => {
    const registry = getSemanticRegistry();
    const originalCount = registry.entries.length;
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    applyChangeset(cs, registry);
    expect(getSemanticRegistry().entries.length).toBe(originalCount);
  });

  it('simulated registry has more entries than original after add_phrase', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    const { simulatedRegistry } = applyChangeset(cs, registry);
    expect(simulatedRegistry.entries.length).toBeGreaterThan(registry.entries.length);
  });

  it('add_phrase adds entry to simulated bigramIndex', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    const { simulatedRegistry } = applyChangeset(cs, registry);
    expect(simulatedRegistry.bigramIndex['oat milk']).toBeDefined();
  });

  it('add_alias populates simulated aliasIndex', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_alias', { variant: 'mynewstore', canonical: 'mystore' }),
    ]);
    const { simulatedRegistry } = applyChangeset(cs, registry);
    expect(simulatedRegistry.aliasIndex['mynewstore']).toBe('mystore');
  });

  it('archive_entry sets entry.archived = true in simulation', () => {
    const registry = getSemanticRegistry();
    const entryId = registry.entries[0].id;
    const cs = makeChangeset([
      op('archive_entry', { entryId }),
    ]);
    const { simulatedRegistry } = applyChangeset(cs, registry);
    const archivedEntry = simulatedRegistry.entries.find((e) => e.id === entryId);
    expect(archivedEntry?.archived).toBe(true);
  });

  it('archive_entry reduces precedence in simulation', () => {
    const registry = getSemanticRegistry();
    const originalEntry = registry.entries[0];
    const cs = makeChangeset([
      op('archive_entry', { entryId: originalEntry.id }),
    ]);
    const { simulatedRegistry } = applyChangeset(cs, registry);
    const after = simulatedRegistry.entries.find((e) => e.id === originalEntry.id)!;
    expect(after.precedence).toBeLessThan(originalEntry.precedence);
  });

  it('change_precedence updates precedence in simulation', () => {
    const registry = getSemanticRegistry();
    const entryId = registry.entries[0].id;
    const cs = makeChangeset([
      op('change_precedence', { entryId, newPrecedence: 999 }),
    ]);
    const { simulatedRegistry } = applyChangeset(cs, registry);
    const after = simulatedRegistry.entries.find((e) => e.id === entryId)!;
    expect(after.precedence).toBe(999);
  });
});

// ── applyChangeset — diff ─────────────────────────────────────────────────────

describe('applyChangeset — diff', () => {
  it('diff.addedEntries contains the new phrase entry', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    const { diff } = applyChangeset(cs, registry);
    expect(diff.addedEntries.length).toBeGreaterThan(0);
    expect(diff.addedEntries.some((e) => e.tokens.join(' ') === 'oat milk')).toBe(true);
  });

  it('diff.removedEntries empty when no entries removed', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['fresh', 'bread'], phraseType: 'item', categoryIds: ['bakery'], confidence: 0.8 }),
    ]);
    const { diff } = applyChangeset(cs, registry);
    expect(diff.removedEntries).toHaveLength(0);
  });

  it('diff.changedEntries contains archived entry', () => {
    const registry = getSemanticRegistry();
    const entryId = registry.entries[0].id;
    const cs = makeChangeset([
      op('archive_entry', { entryId }),
    ]);
    const { diff } = applyChangeset(cs, registry);
    const changed = diff.changedEntries.find((c) => c.after.id === entryId);
    expect(changed).toBeDefined();
    expect(changed!.after.archived).toBe(true);
  });

  it('diff.newConflicts empty when adding non-overlapping phrase', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['completely', 'unique', 'xyz'], phraseType: 'item', categoryIds: ['x'], confidence: 0.8 }),
    ]);
    // Note: trigram 'completely unique xyz' almost certainly not in registry
    const { diff } = applyChangeset(cs, registry);
    const newOverlap = diff.newConflicts.filter((c) => c.tokens.join(' ') === 'completely unique xyz');
    expect(newOverlap).toHaveLength(0);
  });

  it('multiple operations in one changeset all applied', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
      op('add_alias', { variant: 'specialstore', canonical: 'store' }),
    ]);
    const { diff } = applyChangeset(cs, registry);
    expect(diff.addedEntries.length).toBeGreaterThanOrEqual(2);
  });
});

// ── previewParserOutput ───────────────────────────────────────────────────────

describe('previewParserOutput', () => {
  it('returns array of length matching inputs', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    const results = previewParserOutput(['oat milk 100', 'coffee 50'], cs, registry);
    expect(results).toHaveLength(2);
  });

  it('preview result has inputText field', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    const results = previewParserOutput(['oat milk 100'], cs, registry);
    expect(results[0].inputText).toBe('oat milk 100');
  });

  it('preview result has beforePhrases array', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    const results = previewParserOutput(['oat milk 100'], cs, registry);
    expect(Array.isArray(results[0].beforePhrases)).toBe(true);
  });

  it('phraseDiff populated when input contains added phrase tokens', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    const results = previewParserOutput(['oat milk 100'], cs, registry);
    // 'oat milk' is in the input, so phraseDiff should have an 'added' entry
    expect(results[0].phraseDiff.some((d) => d.kind === 'added' && d.tokens.join(' ') === 'oat milk')).toBe(true);
  });

  it('phraseDiff empty when input does not contain added phrase tokens', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    const results = previewParserOutput(['coffee 50'], cs, registry);
    expect(results[0].phraseDiff).toHaveLength(0);
  });
});

// ── runRegressionCheck ────────────────────────────────────────────────────────

describe('runRegressionCheck', () => {
  it('passing case produces passed: true', () => {
    const ctx = parseInputForTest('молоко 100');
    const report = runRegressionCheck([{
      id: 'c1',
      input: 'молоко 100',
      expectedAmount: ctx.amount,
    }]);
    expect(report.cases[0].passed).toBe(true);
  });

  it('wrong expectedAmount → passed: false with issue', () => {
    const report = runRegressionCheck([{
      id: 'c1',
      input: 'молоко 100',
      expectedAmount: 999,
    }]);
    expect(report.cases[0].passed).toBe(false);
    expect(report.cases[0].issues.some((i) => i.field === 'amount')).toBe(true);
  });

  it('wrong expectedMerchant → passed: false', () => {
    const report = runRegressionCheck([{
      id: 'c1',
      input: 'rami levi 100',
      expectedMerchant: 'wrong store',
    }]);
    expect(report.cases[0].passed).toBe(false);
  });

  it('expectNoClarification: true with unknown word → fails if clarification triggered', () => {
    const report = runRegressionCheck([{
      id: 'c1',
      input: 'xyzunknown 350',
      expectNoClarification: true,
    }]);
    // If parser triggers clarification, case fails
    const ctx = parseInputForTest('xyzunknown 350');
    if (ctx.clarificationHints.length > 0) {
      expect(report.cases[0].passed).toBe(false);
    }
  });

  it('totalCases / passedCases / failedCases match', () => {
    const report = runRegressionCheck([
      { id: 'c1', input: 'milk 100', expectedAmount: 100 },
      { id: 'c2', input: 'milk 100', expectedAmount: 999 },
    ]);
    expect(report.totalCases).toBe(2);
    expect(report.passedCases).toBe(1);
    expect(report.failedCases).toBe(1);
    expect(report.allPassed).toBe(false);
  });

  it('empty cases → allPassed: true', () => {
    const report = runRegressionCheck([]);
    expect(report.allPassed).toBe(true);
    expect(report.totalCases).toBe(0);
  });

  it('each case result has actual snapshot', () => {
    const report = runRegressionCheck([{ id: 'c1', input: 'milk 100' }]);
    const actual = report.cases[0].actual;
    expect(Array.isArray(actual.phraseTypes)).toBe(true);
    expect(Array.isArray(actual.fragmentTypes)).toBe(true);
    expect(typeof actual.scopeCount).toBe('number');
  });
});

// ── snapshotRegressionBaseline + compareToBaseline ────────────────────────────

describe('snapshotRegressionBaseline', () => {
  it('snapshot produces one case per input', () => {
    const baseline = snapshotRegressionBaseline(['milk 100', 'coffee 50']);
    expect(baseline).toHaveLength(2);
  });

  it('snapshot baseline round-trip: compareToBaseline passes all', () => {
    const inputs = ['milk 100', 'ice cream 50', 'rami levi milk 200'];
    const baseline = snapshotRegressionBaseline(inputs);
    const report = compareToBaseline(baseline);
    expect(report.allPassed).toBe(true);
  });

  it('snapshot ids are snap_0, snap_1, ...', () => {
    const baseline = snapshotRegressionBaseline(['a', 'b', 'c']);
    expect(baseline.map((b) => b.id)).toEqual(['snap_0', 'snap_1', 'snap_2']);
  });

  it('snapshot captures phraseTypes', () => {
    const baseline = snapshotRegressionBaseline(['milk 100']);
    expect(Array.isArray(baseline[0].expectedPhraseTypes)).toBe(true);
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('validateChangeset same call → same result count', () => {
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    const r1 = validateChangeset(cs, getSemanticRegistry());
    opSeq = 0;
    const r2 = validateChangeset(cs, getSemanticRegistry());
    expect(r1.length).toBe(r2.length);
  });

  it('applyChangeset same call → same diff entry count', () => {
    const registry = getSemanticRegistry();
    const cs = makeChangeset([
      op('add_phrase', { tokens: ['oat', 'milk'], phraseType: 'item', categoryIds: ['groceries'], confidence: 0.85 }),
    ]);
    const { diff: d1 } = applyChangeset(cs, registry);
    const { diff: d2 } = applyChangeset(cs, registry);
    expect(d1.addedEntries.length).toBe(d2.addedEntries.length);
    expect(d1.changedEntries.length).toBe(d2.changedEntries.length);
  });

  it('runRegressionCheck deterministic', () => {
    const cases = [{ id: 'c1', input: 'milk 100', expectedAmount: 100 }];
    const r1 = runRegressionCheck(cases);
    const r2 = runRegressionCheck(cases);
    expect(r1.allPassed).toBe(r2.allPassed);
    expect(r1.passedCases).toBe(r2.passedCases);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

import { parseInput as parseInputForTest } from '@/features/expenses/engine/inputPipeline';
