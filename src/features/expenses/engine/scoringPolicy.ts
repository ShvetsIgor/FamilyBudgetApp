/**
 * LAYER: scoring policy — explicit, named ranking contract.
 *
 * All suggestion ranking weights and stage thresholds live here.
 * No magic numbers in computation code.
 *
 * Changing a value here changes the behavior of the entire ranking system.
 * This is intentional — the policy is the single place to tune ranking.
 *
 * Design rationale:
 *   - merchant_history: strongest signal (50pts) — user explicitly paid here before
 *   - recent_usage:     moderate signal (20pts) — used this category recently
 *   - name_match:       weak signal (10pts) — merchant name ↔ category name
 *   - split_history:    moderate signal (15pts) — this category appears in known split combos
 *   - habit:            flat boost (10pts) — category is a confirmed habit at this merchant
 *   - saturationAt:     score saturates at N uses — prevents old data from dominating forever
 *   - decayDays:        score decays linearly to 0 over N days — keeps context fresh
 *
 * Freshness decay:
 *   - merchantHistory.decayDays: 90 days — stale merchant patterns gradually fade
 *     (score × (1 - ageDays/90), so a 45-day-old pattern contributes 50% of max)
 *   - Habit signal is NOT decayed — confirmed habits remain valid even after gaps
 *
 * Stage threshold rationale:
 *   - confidentScore:        ≥30 pts → one signal is clearly dominant → skip clarification
 *   - ambiguousRatio:        second/first > 0.5 → too similar → ask user
 *   - splitAmountHint:       ≥500 → might need splitting → hint user
 *   - habitDisplayThreshold: ≥3 uses at merchant → shown as "habit" label (display only)
 */

export const SCORING_POLICY = {
  signals: {
    merchantHistory: {
      /** Max contribution at saturation. */
      weight: 50,
      /** Score saturates after this many uses (linear until saturation). */
      saturationAt: 5,
      /** Score decays linearly to 0 after this many days since last visit. */
      decayDays: 90,
    },
    recentUsage: {
      /** Max contribution at saturation on day 0. */
      weight: 20,
      /** Score decays linearly to 0 over this many days. */
      decayDays: 30,
      /** Score saturates after this many uses. */
      saturationAt: 10,
    },
    nameMatch: {
      /** Flat contribution when merchant token matches category name. */
      weight: 10,
    },
    splitHistory: {
      /** Contribution when category appears in a known split combo for this merchant. */
      weight: 15,
      /** Score saturates after this many combo appearances. */
      saturationAt: 3,
    },
    habit: {
      /** Flat score boost when category is a confirmed habit at this merchant. */
      weight: 10,
      /** Minimum uses at this merchant to qualify as a habit. */
      frequencyThreshold: 3,
    },
  },
  thresholds: {
    /** Top suggestion score must reach this to skip clarification → 'confirm'. */
    confidentScore: 30,
    /** If second/first score ratio exceeds this, suggestions are ambiguous → 'clarification'. */
    ambiguousRatio: 0.5,
    /** Expense amounts at or above this suggest splitting → 'split' stage. */
    splitAmountHint: 500,
    /** Top suggestion habit score boost for display purposes — no behavior change. */
    habitDisplayThreshold: 3,
  },
} as const;

/** Convenience re-export for components that only need the split threshold. */
export const SPLIT_AMOUNT_THRESHOLD = SCORING_POLICY.thresholds.splitAmountHint;
