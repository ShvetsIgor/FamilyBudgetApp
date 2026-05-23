/**
 * LAYER: changeset validator — pre-application validation.
 *
 * Validates a SemanticChangeSet against the current registry before it is
 * applied. Returns structured SemanticValidationResult[] — never throws.
 *
 * Validation rules (by operation type):
 *
 *   add_phrase:
 *     - tokens must be non-empty strings
 *     - confidence must be in [0, 1]
 *     - warns if phrase already exists at higher precedence (CONFLICT_INTRODUCED)
 *
 *   add_alias:
 *     - variant and canonical must be non-empty
 *     - variant !== canonical (CIRCULAR_ALIAS)
 *     - variant must not already exist in aliasIndex (DUPLICATE_ALIAS)
 *
 *   merge_aliases:
 *     - must have ≥ 2 variants (MERGE_SINGLE_VARIANT)
 *     - canonical must be non-empty
 *
 *   archive_entry:
 *     - entryId must exist in registry (ENTRY_NOT_FOUND)
 *
 *   change_precedence:
 *     - entryId must exist in registry (ENTRY_NOT_FOUND)
 *     - newPrecedence must be ≥ 0 (PRECEDENCE_UNDERFLOW)
 *
 *   attach_tag / modify_normalization:
 *     - target must be non-empty
 *
 * Architecture invariants:
 *   - Pure function: same registry + changeset → same results (deterministic).
 *   - Does NOT apply the changeset — read-only inspection.
 *   - No side effects.
 *   - No AI, no embeddings, no probabilistic logic.
 */

import type { SemanticRegistry } from './semanticRegistry';
import type {
  SemanticChangeSet,
  SemanticOperation,
  SemanticValidationResult,
  AddPhrasePayload,
  AddAliasPayload,
  MergeAliasesPayload,
  ArchiveEntryPayload,
  ChangePrecedencePayload,
  AttachTagPayload,
  ModifyNormalizationPayload,
} from './semanticChangeset';

// ── Result builder helpers ────────────────────────────────────────────────────

function err(
  code: SemanticValidationResult['code'],
  operationId: string,
  message: string,
  affectedTokens: string[] = [],
): SemanticValidationResult {
  return { severity: 'error', code, operationId, message, affectedTokens };
}

function warn(
  code: SemanticValidationResult['code'],
  operationId: string,
  message: string,
  affectedTokens: string[] = [],
): SemanticValidationResult {
  return { severity: 'warning', code, operationId, message, affectedTokens };
}

function info(
  code: SemanticValidationResult['code'],
  operationId: string,
  message: string,
  affectedTokens: string[] = [],
): SemanticValidationResult {
  return { severity: 'info', code, operationId, message, affectedTokens };
}

// ── Per-operation validators ──────────────────────────────────────────────────

function validateAddPhrase(
  op: SemanticOperation,
  payload: AddPhrasePayload,
  registry: SemanticRegistry,
): SemanticValidationResult[] {
  const results: SemanticValidationResult[] = [];

  if (!op.description.trim()) {
    results.push(warn('EMPTY_DESCRIPTION', op.id, 'Операция не имеет описания'));
  }

  if (!payload.tokens || payload.tokens.length === 0 || payload.tokens.some((t) => !t.trim())) {
    results.push(err('INVALID_TOKENS', op.id, 'Фраза содержит пустые токены', payload.tokens ?? []));
    return results;
  }

  if (payload.confidence < 0 || payload.confidence > 1) {
    results.push(err('INVALID_CONFIDENCE', op.id, `Confidence ${payload.confidence} вне диапазона [0, 1]`));
  }

  const key = payload.tokens.join(' ');
  const index =
    payload.tokens.length === 1
      ? registry.singleIndex
      : payload.tokens.length === 2
      ? registry.bigramIndex
      : registry.trigramIndex;

  const existing = index[key];
  if (existing) {
    results.push(
      warn(
        'CONFLICT_INTRODUCED',
        op.id,
        `"${key}" уже существует в реестре (${existing.kind}, precedence ${existing.precedence}); новая запись будет иметь более низкий приоритет если precedence ≤ ${existing.precedence}`,
        payload.tokens,
      ),
    );
  }

  return results;
}

function validateAddAlias(
  op: SemanticOperation,
  payload: AddAliasPayload,
  registry: SemanticRegistry,
): SemanticValidationResult[] {
  const results: SemanticValidationResult[] = [];

  if (!payload.variant.trim() || !payload.canonical.trim()) {
    results.push(err('INVALID_TOKENS', op.id, 'Variant или canonical пустой', [payload.variant, payload.canonical]));
    return results;
  }

  if (payload.variant === payload.canonical) {
    results.push(err('CIRCULAR_ALIAS', op.id, `Алиас "${payload.variant}" → "${payload.canonical}" ссылается на себя`, [payload.variant]));
    return results;
  }

  const existingCanonical = registry.aliasIndex[payload.variant];
  if (existingCanonical !== undefined) {
    if (existingCanonical === payload.canonical) {
      results.push(info('DUPLICATE_ALIAS', op.id, `Алиас "${payload.variant}" → "${payload.canonical}" уже существует в реестре`, [payload.variant]));
    } else {
      results.push(
        err(
          'DUPLICATE_ALIAS',
          op.id,
          `Алиас "${payload.variant}" уже указывает на "${existingCanonical}"; конфликт с новым canonical "${payload.canonical}"`,
          [payload.variant],
        ),
      );
    }
  }

  // Check if canonical exists in registry
  const canonicalExists =
    payload.canonical in registry.singleIndex ||
    payload.canonical in registry.aliasIndex ||
    registry.entries.some((e) => e.tokens.join(' ') === payload.canonical);
  if (!canonicalExists) {
    results.push(warn('ORPHAN_ALIAS', op.id, `Canonical "${payload.canonical}" не найден в реестре — алиас станет orphan`, [payload.canonical]));
  }

  return results;
}

function validateMergeAliases(
  op: SemanticOperation,
  payload: MergeAliasesPayload,
): SemanticValidationResult[] {
  const results: SemanticValidationResult[] = [];

  if (!payload.variants || payload.variants.length < 2) {
    results.push(err('MERGE_SINGLE_VARIANT', op.id, 'merge_aliases требует ≥ 2 вариантов', payload.variants ?? []));
  }

  if (!payload.canonical.trim()) {
    results.push(err('INVALID_TOKENS', op.id, 'Canonical пустой'));
  }

  return results;
}

function validateArchiveEntry(
  op: SemanticOperation,
  payload: ArchiveEntryPayload,
  registry: SemanticRegistry,
): SemanticValidationResult[] {
  const results: SemanticValidationResult[] = [];

  const exists = registry.entries.some((e) => e.id === payload.entryId);
  if (!exists) {
    results.push(err('ENTRY_NOT_FOUND', op.id, `Запись "${payload.entryId}" не найдена в реестре`, []));
  }

  return results;
}

function validateChangePrecedence(
  op: SemanticOperation,
  payload: ChangePrecedencePayload,
  registry: SemanticRegistry,
): SemanticValidationResult[] {
  const results: SemanticValidationResult[] = [];

  const exists = registry.entries.some((e) => e.id === payload.entryId);
  if (!exists) {
    results.push(err('ENTRY_NOT_FOUND', op.id, `Запись "${payload.entryId}" не найдена в реестре`, []));
  }

  if (payload.newPrecedence < 0) {
    results.push(err('PRECEDENCE_UNDERFLOW', op.id, `Precedence ${payload.newPrecedence} < 0`));
  }

  return results;
}

function validateAttachTag(
  op: SemanticOperation,
  payload: AttachTagPayload,
  registry: SemanticRegistry,
): SemanticValidationResult[] {
  const results: SemanticValidationResult[] = [];

  const exists = registry.entries.some((e) => e.id === payload.merchantEntryId && e.kind === 'merchant');
  if (!exists) {
    results.push(warn('ENTRY_NOT_FOUND', op.id, `Merchant "${payload.merchantEntryId}" не найден в реестре`));
  }

  if (!payload.tag.trim()) {
    results.push(err('INVALID_TOKENS', op.id, 'Tag пустой'));
  }

  return results;
}

function validateModifyNormalization(
  op: SemanticOperation,
  payload: ModifyNormalizationPayload,
): SemanticValidationResult[] {
  const results: SemanticValidationResult[] = [];

  if (!payload.variant.trim() || !payload.canonical.trim()) {
    results.push(err('INVALID_TOKENS', op.id, 'Variant или canonical пустой'));
    return results;
  }

  if (payload.variant === payload.canonical) {
    results.push(err('CIRCULAR_ALIAS', op.id, `Нормализация "${payload.variant}" → "${payload.canonical}" ссылается на себя`, [payload.variant]));
  }

  return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate all operations in a changeset against the given registry.
 *
 * Returns errors (blocking), warnings (non-blocking), and info items.
 * An empty result means the changeset is valid.
 *
 * @param changeset  The proposed changes to validate.
 * @param registry   Registry state to validate against (usually getSemanticRegistry()).
 * @returns          Ordered list of validation issues (errors first, then warnings).
 */
export function validateChangeset(
  changeset: SemanticChangeSet,
  registry: SemanticRegistry,
): SemanticValidationResult[] {
  const all: SemanticValidationResult[] = [];

  for (const op of changeset.operations) {
    let opResults: SemanticValidationResult[] = [];

    switch (op.type) {
      case 'add_phrase':
        opResults = validateAddPhrase(op, op.payload as AddPhrasePayload, registry);
        break;
      case 'add_alias':
        opResults = validateAddAlias(op, op.payload as AddAliasPayload, registry);
        break;
      case 'merge_aliases':
        opResults = validateMergeAliases(op, op.payload as MergeAliasesPayload);
        break;
      case 'archive_entry':
        opResults = validateArchiveEntry(op, op.payload as ArchiveEntryPayload, registry);
        break;
      case 'change_precedence':
        opResults = validateChangePrecedence(op, op.payload as ChangePrecedencePayload, registry);
        break;
      case 'attach_tag':
        opResults = validateAttachTag(op, op.payload as AttachTagPayload, registry);
        break;
      case 'modify_normalization':
        opResults = validateModifyNormalization(op, op.payload as ModifyNormalizationPayload);
        break;
    }

    all.push(...opResults);
  }

  // Sort: errors first, then warnings, then info
  return all.sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

/**
 * Returns true if the changeset has no blocking errors.
 * Warnings and infos are non-blocking.
 */
export function isChangesetApplicable(
  changeset: SemanticChangeSet,
  registry: SemanticRegistry,
): boolean {
  const results = validateChangeset(changeset, registry);
  return !results.some((r) => r.severity === 'error');
}
