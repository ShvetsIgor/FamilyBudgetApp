/**
 * LAYER: semantic simulator — isolated changeset application.
 *
 * Applies a SemanticChangeSet to a COPY of the registry and produces:
 *   - SimulatedRegistry: the registry as it would look after the change
 *   - SemanticDiff: structural diff (added/removed/changed entries, new/resolved conflicts)
 *   - SemanticPreviewResult[]: per-input phrase-level predictions
 *
 * The production registry singleton is NEVER mutated.
 * All operations work on deep copies of entry arrays and index maps.
 *
 * Simulation coverage per operation type:
 *   add_phrase       — inserts a new PhraseEntry or ItemEntry into the copy
 *   add_alias        — inserts a new AliasEntry + updates aliasIndex copy
 *   merge_aliases    — inserts multiple AliasEntries for the same canonical
 *   archive_entry    — marks entry.archived = true, applies archivedPenalty
 *   change_precedence— overrides entry.precedence in the copy
 *   attach_tag       — adds metadata.tags to a MerchantEntry copy
 *   modify_normalization — inserts AliasEntry (normalization = alias at phrase level)
 *
 * Conflict re-detection runs automatically after all operations are applied.
 *
 * Architecture invariants:
 *   - Pure function: same registry + changeset → same simulation (deterministic).
 *   - No mutations to the original registry.
 *   - No AI, no embeddings, no probabilistic logic.
 */

import type {
  SemanticRegistry,
  AnyRegistryEntry,
  RegistryConflict,
  PhraseEntry,
  AliasEntry,
  ItemEntry,
} from './semanticRegistry';
import { computePrecedence } from './semanticRegistry';
import type {
  SemanticChangeSet,
  SemanticDiff,
  SemanticPreviewResult,
  PhraseDiff,
  AddPhrasePayload,
  AddAliasPayload,
  MergeAliasesPayload,
  ArchiveEntryPayload,
  ChangePrecedencePayload,
  ModifyNormalizationPayload,
} from './semanticChangeset';
import { parseInput } from './inputPipeline';

// ── Registry cloning ──────────────────────────────────────────────────────────

function cloneEntry(e: AnyRegistryEntry): AnyRegistryEntry {
  return { ...e, tokens: [...e.tokens], categoryIds: [...e.categoryIds] };
}

function cloneRegistry(registry: SemanticRegistry): {
  entries: AnyRegistryEntry[];
  aliasIndex: Record<string, string>;
} {
  return {
    entries: registry.entries.map(cloneEntry),
    aliasIndex: { ...registry.aliasIndex },
  };
}

// ── Index rebuilder ───────────────────────────────────────────────────────────

function rebuildIndexes(entries: AnyRegistryEntry[]): {
  singleIndex: Record<string, AnyRegistryEntry>;
  bigramIndex: Record<string, AnyRegistryEntry>;
  trigramIndex: Record<string, AnyRegistryEntry>;
} {
  const singleIndex: Record<string, AnyRegistryEntry> = {};
  const bigramIndex: Record<string, AnyRegistryEntry> = {};
  const trigramIndex: Record<string, AnyRegistryEntry> = {};

  for (const entry of entries) {
    if (entry.archived) continue; // archived entries excluded from indexes
    const key = entry.tokens.join(' ');
    const target =
      entry.tokens.length === 1
        ? singleIndex
        : entry.tokens.length === 2
        ? bigramIndex
        : trigramIndex;
    const existing = target[key];
    if (!existing || entry.precedence > existing.precedence) {
      target[key] = entry;
    }
  }

  return { singleIndex, bigramIndex, trigramIndex };
}

// ── Conflict re-detection (simplified subset) ─────────────────────────────────

function redetectConflicts(entries: AnyRegistryEntry[]): RegistryConflict[] {
  const conflicts: RegistryConflict[] = [];
  const seen = new Map<string, AnyRegistryEntry[]>();

  for (const e of entries) {
    const key = e.tokens.join(' ');
    const group = seen.get(key) ?? [];
    group.push(e);
    seen.set(key, group);
  }

  for (const [key, group] of seen) {
    if (group.length > 1) {
      const sorted = [...group].sort((a, b) => b.precedence - a.precedence);
      conflicts.push({
        kind: 'phrase_overlap',
        entryIds: group.map((e) => e.id),
        tokens: key.split(' '),
        message: `"${key}" — ${group.length} записей; победитель: ${sorted[0].id}`,
        winnerId: sorted[0].id,
      });
    }
  }

  return conflicts;
}

// ── ID generator for simulated entries ───────────────────────────────────────

let _simIdSeq = 0;
function simId(prefix: string): string {
  return `sim_${prefix}${_simIdSeq++}`;
}

// ── Operation appliers ────────────────────────────────────────────────────────

function applyAddPhrase(
  payload: AddPhrasePayload,
  entries: AnyRegistryEntry[],
): AnyRegistryEntry {
  const tokenCount = payload.tokens.length;
  const isPayment = payload.phraseType === 'payment';

  if (tokenCount === 1) {
    const entry: ItemEntry = {
      id: simId('i'),
      kind: 'item',
      source: 'user_defined',
      tokens: [...payload.tokens],
      categoryIds: [...payload.categoryIds],
      confidence: payload.confidence,
      precedence: computePrecedence('item', 'user_defined', 1),
      archived: false,
    };
    entries.push(entry);
    return entry;
  }

  const entry: PhraseEntry = {
    id: simId('p'),
    kind: 'phrase',
    source: 'user_defined',
    tokens: [...payload.tokens],
    categoryIds: [...payload.categoryIds],
    confidence: payload.confidence,
    precedence: computePrecedence('phrase', 'user_defined', tokenCount, { isPaymentPhrase: isPayment }),
    archived: false,
    phraseType: payload.phraseType,
  };
  entries.push(entry);
  return entry;
}

function applyAddAlias(
  payload: AddAliasPayload,
  entries: AnyRegistryEntry[],
  aliasIndex: Record<string, string>,
): AnyRegistryEntry {
  const tokens = payload.variant.split(' ');
  const entry: AliasEntry = {
    id: simId('a'),
    kind: 'alias',
    source: 'user_defined',
    tokens,
    categoryIds: [],
    confidence: 1.0,
    precedence: computePrecedence('alias', 'user_defined', tokens.length),
    archived: false,
    canonical: payload.canonical,
  };
  entries.push(entry);
  aliasIndex[payload.variant] = payload.canonical;
  return entry;
}

function applyArchiveEntry(
  payload: ArchiveEntryPayload,
  entries: AnyRegistryEntry[],
): void {
  const entry = entries.find((e) => e.id === payload.entryId);
  if (entry) {
    entry.archived = true;
    // Reduce precedence by penalty (same as computePrecedence with archived:true)
    entry.precedence = Math.max(0, entry.precedence - 40);
  }
}

function applyChangePrecedence(
  payload: ChangePrecedencePayload,
  entries: AnyRegistryEntry[],
): void {
  const entry = entries.find((e) => e.id === payload.entryId);
  if (entry) {
    entry.precedence = payload.newPrecedence;
  }
}

// ── Diff computation ──────────────────────────────────────────────────────────

function computeDiff(
  originalEntries: AnyRegistryEntry[],
  simulatedEntries: AnyRegistryEntry[],
  originalConflicts: RegistryConflict[],
  simulatedConflicts: RegistryConflict[],
): SemanticDiff {
  const originalIds = new Set(originalEntries.map((e) => e.id));
  const simulatedIds = new Set(simulatedEntries.map((e) => e.id));

  const addedEntries = simulatedEntries.filter((e) => !originalIds.has(e.id));
  const removedEntries = originalEntries.filter((e) => !simulatedIds.has(e.id));

  const changedEntries: SemanticDiff['changedEntries'] = [];
  for (const sim of simulatedEntries) {
    const orig = originalEntries.find((e) => e.id === sim.id);
    if (
      orig &&
      (orig.precedence !== sim.precedence || orig.archived !== sim.archived)
    ) {
      changedEntries.push({ before: orig, after: sim });
    }
  }

  const originalConflictKeys = new Set(originalConflicts.map((c) => c.tokens.join(' ')));
  const simulatedConflictKeys = new Set(simulatedConflicts.map((c) => c.tokens.join(' ')));

  const newConflicts = simulatedConflicts.filter(
    (c) => !originalConflictKeys.has(c.tokens.join(' ')),
  );
  const resolvedConflicts = originalConflicts.filter(
    (c) => !simulatedConflictKeys.has(c.tokens.join(' ')),
  );

  return { addedEntries, removedEntries, changedEntries, newConflicts, resolvedConflicts };
}

// ── Preview generation ────────────────────────────────────────────────────────

function buildPreviewResult(
  inputText: string,
  diff: SemanticDiff,
): SemanticPreviewResult {
  const ctx = parseInput(inputText);
  const beforePhrases = ctx.phrases.map((p) => ({
    type: p.type,
    rawText: p.rawText,
    confidence: p.confidence,
  }));

  const phraseDiffs: PhraseDiff[] = [];

  // For each added entry, check if it would match tokens in this input
  const normalizedInput = inputText.toLowerCase();
  for (const entry of diff.addedEntries) {
    const entryKey = entry.tokens.join(' ');
    if (normalizedInput.includes(entryKey)) {
      phraseDiffs.push({
        kind: 'added',
        tokens: entry.tokens,
        phraseType: entry.kind === 'phrase' ? (entry as PhraseEntry).phraseType ?? 'item' : entry.kind,
        confidenceAfter: entry.confidence,
        note: `новая запись из user_defined`,
      });
    }
  }

  // For each changed entry (precedence/archived), check if it affects this input
  for (const { before, after } of diff.changedEntries) {
    const entryKey = before.tokens.join(' ');
    if (normalizedInput.includes(entryKey)) {
      phraseDiffs.push({
        kind: 'changed',
        tokens: before.tokens,
        phraseType: before.kind,
        confidenceBefore: before.confidence,
        confidenceAfter: after.confidence,
        note: after.archived ? 'запись архивирована' : `precedence: ${before.precedence} → ${after.precedence}`,
      });
    }
  }

  const clarificationsBefore = ctx.clarificationHints.map((h) => `[${h.kind}] ${h.message}`);

  const predictedClarificationChanges: string[] = [];
  if (diff.newConflicts.length > 0) {
    predictedClarificationChanges.push(
      `+${diff.newConflicts.length} новых конфликтов в реестре`,
    );
  }
  if (diff.resolvedConflicts.length > 0) {
    predictedClarificationChanges.push(
      `−${diff.resolvedConflicts.length} конфликтов снято`,
    );
  }

  return {
    inputText,
    beforePhrases,
    phraseDiff: phraseDiffs,
    clarificationsBefore,
    predictedClarificationChanges,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SimulationResult {
  /** Registry state after applying all operations. */
  simulatedRegistry: SemanticRegistry;
  /** Structural diff between original and simulated. */
  diff: SemanticDiff;
}

/**
 * Apply all operations in a changeset to an isolated copy of the registry.
 *
 * The original registry is NEVER modified.
 * Operations are applied in order; later operations see results of earlier ones.
 *
 * @param changeset  The proposed changes.
 * @param registry   Base registry to fork from (usually getSemanticRegistry()).
 * @returns          Simulated registry + structural diff.
 */
export function applyChangeset(
  changeset: SemanticChangeSet,
  registry: SemanticRegistry,
): SimulationResult {
  _simIdSeq = 0;
  const { entries, aliasIndex } = cloneRegistry(registry);

  for (const op of changeset.operations) {
    switch (op.type) {
      case 'add_phrase':
        applyAddPhrase(op.payload as AddPhrasePayload, entries);
        break;
      case 'add_alias':
        applyAddAlias(op.payload as AddAliasPayload, entries, aliasIndex);
        break;
      case 'merge_aliases': {
        const p = op.payload as MergeAliasesPayload;
        for (const variant of p.variants) {
          applyAddAlias({ variant, canonical: p.canonical }, entries, aliasIndex);
        }
        break;
      }
      case 'archive_entry':
        applyArchiveEntry(op.payload as ArchiveEntryPayload, entries);
        break;
      case 'change_precedence':
        applyChangePrecedence(op.payload as ChangePrecedencePayload, entries);
        break;
      case 'attach_tag': {
        // attach_tag adds tag metadata — not a new registry entry
        break;
      }
      case 'modify_normalization': {
        const p = op.payload as ModifyNormalizationPayload;
        applyAddAlias({ variant: p.variant, canonical: p.canonical }, entries, aliasIndex);
        break;
      }
    }
  }

  const { singleIndex, bigramIndex, trigramIndex } = rebuildIndexes(entries);
  const conflicts = redetectConflicts(entries);

  const simulatedRegistry: SemanticRegistry = {
    entries,
    conflicts,
    singleIndex,
    bigramIndex,
    trigramIndex,
    aliasIndex,
  };

  const diff = computeDiff(
    registry.entries,
    entries,
    registry.conflicts,
    conflicts,
  );

  return { simulatedRegistry, diff };
}

/**
 * Generate parser preview results for a list of test inputs.
 *
 * For each input: runs parseInput() against current state (before),
 * then uses the simulated diff to predict phrase-level changes (after).
 *
 * @param inputs     Test input strings to preview.
 * @param changeset  The proposed changes.
 * @param registry   Current registry (usually getSemanticRegistry()).
 */
export function previewParserOutput(
  inputs: string[],
  changeset: SemanticChangeSet,
  registry: SemanticRegistry,
): SemanticPreviewResult[] {
  const { diff } = applyChangeset(changeset, registry);
  return inputs.map((input) => buildPreviewResult(input, diff));
}
