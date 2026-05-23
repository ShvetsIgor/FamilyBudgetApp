/**
 * LAYER: semantic changeset — controlled semantic editing model.
 *
 * Every proposed change to semantic knowledge is expressed as a SemanticChangeSet
 * containing typed SemanticOperations. ChangeSets are:
 *   - previewable before application
 *   - validatable against the current registry
 *   - diff-able (what would change?)
 *   - regression-safe (run test inputs before committing)
 *
 * Operation types:
 *   add_phrase            — register a new bigram/single item or payment phrase
 *   add_alias             — register a new merchant alias (variant → canonical)
 *   merge_aliases         — consolidate multiple alias variants under one canonical
 *   archive_entry         — mark an entry archived (precedence penalty, still resolvable)
 *   change_precedence     — override the computed precedence for a registry entry
 *   attach_tag            — associate a tag token with a merchant entry
 *   modify_normalization  — add/update a merchant normalization rule
 *
 * Architecture invariants:
 *   - Pure types only — no logic in this file.
 *   - All fields are deterministic and inspectable.
 *   - No AI, no embeddings, no probabilistic logic.
 *   - Application of operations NEVER mutates the production registry singleton.
 *     Use semanticSimulator.ts to apply operations to an isolated copy.
 */

import type { AnyRegistryEntry, RegistryConflict } from './semanticRegistry';

// ── Operations ────────────────────────────────────────────────────────────────

export type SemanticOperationType =
  | 'add_phrase'
  | 'add_alias'
  | 'merge_aliases'
  | 'archive_entry'
  | 'change_precedence'
  | 'attach_tag'
  | 'modify_normalization';

export interface AddPhrasePayload {
  tokens: string[];           // normalized tokens (lowercase)
  phraseType: 'item' | 'payment';
  categoryIds: string[];
  confidence: number;
}

export interface AddAliasPayload {
  variant: string;            // normalized variant to add (lowercase)
  canonical: string;          // canonical key to resolve to
}

export interface MergeAliasesPayload {
  variants: string[];         // all variants (normalized)
  canonical: string;          // common canonical target
}

export interface ArchiveEntryPayload {
  entryId: string;            // id from registry entry
  reason?: string;
}

export interface ChangePrecedencePayload {
  entryId: string;
  newPrecedence: number;
  reason?: string;
}

export interface AttachTagPayload {
  merchantEntryId: string;
  tag: string;                // normalized tag token
}

export interface ModifyNormalizationPayload {
  variant: string;            // input variant (normalized)
  canonical: string;          // canonical output form
}

export type SemanticOperationPayload =
  | AddPhrasePayload
  | AddAliasPayload
  | MergeAliasesPayload
  | ArchiveEntryPayload
  | ChangePrecedencePayload
  | AttachTagPayload
  | ModifyNormalizationPayload;

export interface SemanticOperation {
  id: string;
  type: SemanticOperationType;
  payload: SemanticOperationPayload;
  /** Human-readable intent for this operation. */
  description: string;
}

// ── Changeset ─────────────────────────────────────────────────────────────────

export interface SemanticChangeSet {
  id: string;
  createdAt: number;          // Unix ms timestamp
  operations: SemanticOperation[];
  previewResults?: SemanticPreviewResult[];
  validationResults?: SemanticValidationResult[];
  warnings: string[];
}

// ── Preview ───────────────────────────────────────────────────────────────────

export type PhraseDiffKind = 'added' | 'removed' | 'changed';

export interface PhraseDiff {
  kind: PhraseDiffKind;
  tokens: string[];
  phraseType: string;
  confidenceBefore?: number;
  confidenceAfter?: number;
  note?: string;
}

/**
 * Preview result for a single test input.
 * Shows what would change in the phrase/clarification output.
 */
export interface SemanticPreviewResult {
  inputText: string;
  beforePhrases: Array<{ type: string; rawText: string; confidence: number }>;
  /** Registry-level predicted changes (not a full re-parse). */
  phraseDiff: PhraseDiff[];
  clarificationsBefore: string[];
  /** Predicted clarification changes based on registry diff. */
  predictedClarificationChanges: string[];
}

// ── Validation ────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ValidationCode =
  | 'DUPLICATE_ALIAS'           // alias already exists in registry
  | 'CONFLICT_INTRODUCED'       // new entry overlaps existing higher-precedence entry
  | 'ORPHAN_ALIAS'              // alias canonical target not in registry
  | 'INVALID_TOKENS'            // tokens array is empty or contains empty strings
  | 'INVALID_CONFIDENCE'        // confidence outside [0, 1]
  | 'ENTRY_NOT_FOUND'           // entryId not found in registry (for archive/precedence ops)
  | 'CIRCULAR_ALIAS'            // alias variant === canonical (self-referential)
  | 'EMPTY_DESCRIPTION'         // operation description is empty
  | 'PRECEDENCE_UNDERFLOW'      // newPrecedence < 0
  | 'MERGE_SINGLE_VARIANT';     // merge_aliases with < 2 variants

export interface SemanticValidationResult {
  severity: ValidationSeverity;
  code: ValidationCode;
  operationId: string;
  message: string;
  affectedTokens: string[];
}

// ── Semantic diff ─────────────────────────────────────────────────────────────

/**
 * Structural diff between two registry states.
 * Produced by semanticSimulator after applying a changeset.
 */
export interface SemanticDiff {
  addedEntries: AnyRegistryEntry[];
  removedEntries: AnyRegistryEntry[];
  /** Entries whose precedence or archived status changed. */
  changedEntries: Array<{ before: AnyRegistryEntry; after: AnyRegistryEntry }>;
  /** New conflicts introduced by this changeset. */
  newConflicts: RegistryConflict[];
  /** Conflicts that were resolved (e.g., by archiving a conflicting entry). */
  resolvedConflicts: RegistryConflict[];
}
