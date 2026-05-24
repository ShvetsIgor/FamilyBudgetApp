/**
 * LAYER: semantic event timeline — replayable event log for a session.
 *
 * Every significant runtime transition emits a SemanticEvent.
 * The timeline is buildable from any SemanticSession + optional SemanticActions,
 * making it fully inspectable without external persistence.
 *
 * Event kinds:
 *   parser_pass             — a parse execution (initial or retry)
 *   clarification_triggered — a new clarification hint appeared
 *   clarification_resolved  — a hint was answered (user or auto)
 *   correction_applied      — a SemanticCorrection was recorded in the session
 *   group_changed           — a purchase group was split, merged, or modified
 *   resolution_transition   — resolution state changed (pending → resolved/blocked)
 *   action_applied          — a SemanticAction was applied
 *   session_lifecycle       — session created / resolved / cancelled
 *
 * Architecture invariants:
 *   - Pure functions only.
 *   - No mutations — timeline is a value object.
 *   - Replayable: same session + same actions → same timeline.
 */

import type { SemanticSession, ClarificationAnswerPayload } from './semanticSession';
import type { SemanticAction } from './semanticAction';

// ── Event model ───────────────────────────────────────────────────────────────

export type SemanticEventKind =
  | 'parser_pass'
  | 'clarification_triggered'
  | 'clarification_resolved'
  | 'correction_applied'
  | 'group_changed'
  | 'resolution_transition'
  | 'action_applied'
  | 'session_lifecycle';

export interface SemanticEvent {
  id: string;
  kind: SemanticEventKind;
  sessionId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface SemanticEventTimeline {
  sessionId: string;
  events: SemanticEvent[];
  totalEvents: number;
  firstEventAt: number | undefined;
  lastEventAt: number | undefined;
}

// ── ID generation ─────────────────────────────────────────────────────────────

let _eventSeq = 0;

export function nextEventId(): string {
  return `evt_${Date.now()}_${_eventSeq++}`;
}

/** Reset event sequence — for testing only. */
export function resetEventIds(): void {
  _eventSeq = 0;
}

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildSemanticEvent(
  kind: SemanticEventKind,
  sessionId: string,
  payload: Record<string, unknown>,
  timestamp = Date.now(),
): SemanticEvent {
  return {
    id: nextEventId(),
    kind,
    sessionId,
    timestamp,
    payload,
  };
}

/**
 * Reconstruct a SemanticEventTimeline from a SemanticSession's history.
 *
 * Produces events in chronological order:
 *   1. session_lifecycle (created)
 *   2. parser_pass (initial parse)
 *   3. clarification_triggered (one per initial hint)
 *   4. For each session correction:
 *      - correction_applied / clarification_resolved
 *      - parser_pass (if merchant_correction triggered re-parse)
 *   5. For each semantic action (if provided):
 *      - kind derived from action.type
 *   6. resolution_transition + session_lifecycle (if resolved/cancelled)
 */
export function buildTimelineFromSession(
  session: SemanticSession,
  actions: SemanticAction[] = [],
): SemanticEventTimeline {
  const events: SemanticEvent[] = [];
  const sid = session.id;

  // 1 — Session created
  events.push(buildSemanticEvent(
    'session_lifecycle', sid,
    { lifecycle: 'created', originalInput: session.originalInput },
    session.createdAt,
  ));

  // 2 — Initial parser pass
  const initialCtx = session.parserContexts[0];
  if (initialCtx) {
    events.push(buildSemanticEvent(
      'parser_pass', sid,
      {
        passIndex: 0,
        raw: initialCtx.raw,
        phrasesCount: initialCtx.phrases.length,
        fragmentsCount: initialCtx.fragments.length,
        hintsCount: initialCtx.clarificationHints.length,
      },
      session.createdAt,
    ));

    // 3 — Clarification hints triggered
    for (const hint of initialCtx.clarificationHints) {
      events.push(buildSemanticEvent(
        'clarification_triggered', sid,
        { hintKind: hint.kind, fragmentId: hint.fragmentId, candidates: hint.candidates },
        session.createdAt,
      ));
    }
  }

  // 4 — Corrections
  let reparsePasses = 1;
  for (const correction of session.corrections) {
    const ts = correction.timestamp;

    if (correction.type === 'clarification_answer') {
      const p = correction.payload as ClarificationAnswerPayload;
      events.push(buildSemanticEvent(
        'clarification_resolved', sid,
        {
          hintFragmentId: p.hintFragmentId,
          chosenCategoryId: p.chosenCategoryId,
          hintKind: p.hintKind,
          correctionId: correction.id,
          source: 'user',
        },
        ts,
      ));
    } else {
      events.push(buildSemanticEvent(
        'correction_applied', sid,
        { correctionType: correction.type, correctionId: correction.id, description: correction.description },
        ts,
      ));

      if (correction.type === 'merchant_correction' && session.parserContexts[reparsePasses]) {
        const reparseCtx = session.parserContexts[reparsePasses];
        events.push(buildSemanticEvent(
          'parser_pass', sid,
          { passIndex: reparsePasses, raw: reparseCtx?.raw, trigger: 'merchant_correction' },
          ts,
        ));
        reparsePasses++;
      }
    }
  }

  // 5 — Semantic actions
  for (const action of actions) {
    const kind = actionToEventKind(action.type);
    events.push(buildSemanticEvent(
      kind, sid,
      { actionId: action.id, actionType: action.type, source: action.source, ...action.payload },
      action.createdAt,
    ));
  }

  // 6 — Resolution + lifecycle (closed sessions)
  if (session.status === 'resolved' || session.status === 'cancelled') {
    events.push(buildSemanticEvent(
      'resolution_transition', sid,
      { previousStatus: 'active', newStatus: session.status },
      session.updatedAt,
    ));
    events.push(buildSemanticEvent(
      'session_lifecycle', sid,
      { lifecycle: session.status },
      session.updatedAt,
    ));
  }

  events.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));

  return {
    sessionId: sid,
    events,
    totalEvents: events.length,
    firstEventAt: events[0]?.timestamp,
    lastEventAt: events[events.length - 1]?.timestamp,
  };
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function filterEventsByKind(
  timeline: SemanticEventTimeline,
  kind: SemanticEventKind,
): SemanticEvent[] {
  return timeline.events.filter((e) => e.kind === kind);
}

export function getLatestEventOfKind(
  timeline: SemanticEventTimeline,
  kind: SemanticEventKind,
): SemanticEvent | undefined {
  const matching = timeline.events.filter((e) => e.kind === kind);
  return matching[matching.length - 1];
}

export function countEventsByKind(
  timeline: SemanticEventTimeline,
  kind: SemanticEventKind,
): number {
  return timeline.events.filter((e) => e.kind === kind).length;
}

// ── Internal ──────────────────────────────────────────────────────────────────

function actionToEventKind(type: SemanticAction['type']): SemanticEventKind {
  switch (type) {
    case 'resolve_clarification': return 'clarification_resolved';
    case 'split_purchase':
    case 'merge_group':           return 'group_changed';
    case 'change_category':       return 'correction_applied';
    case 'retry_parse':           return 'parser_pass';
    default:                      return 'action_applied';
  }
}
