'use client';
import { useState } from 'react';
import { TAXONOMY } from '../icons/icons';

export interface WizardSub {
  id: string;
  name: string;
  ru?: string;
  icon: string;
  enabled: boolean;
  isCustom?: boolean;
}

export interface WizardParent {
  id: string;
  name: string;
  ru?: string;
  icon: string;
  color: string;
  enabled: boolean;
  budget: number | null;
  subs: WizardSub[];
  isCustom?: boolean;
}

const DEFAULT_ENABLED = new Set(['food', 'home', 'transport', 'shopping', 'health']);

function initState(existingIds: Set<string>): WizardParent[] {
  return TAXONOMY.map((p) => ({
    id: p.id,
    name: p.name,
    ru: p.ru,
    icon: p.icon,
    color: p.color,
    enabled: existingIds.has(p.id) || DEFAULT_ENABLED.has(p.id),
    budget: null,
    subs: p.subs.map((s) => ({
      id: s.id,
      name: s.name,
      ru: (s as { ru?: string }).ru,
      icon: s.icon,
      enabled: true,
    })),
  }));
}

export function useConstructorState(existingIds: Set<string>) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardParent[]>(() => initState(existingIds));

  const toggleParent = (id: string) =>
    setState((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));

  const toggleSub = (pid: string, sid: string) =>
    setState((prev) =>
      prev.map((p) =>
        p.id === pid
          ? { ...p, subs: p.subs.map((s) => (s.id === sid ? { ...s, enabled: !s.enabled } : s)) }
          : p,
      ),
    );

  const setBudget = (id: string, v: number | null) =>
    setState((prev) => prev.map((p) => (p.id === id ? { ...p, budget: v } : p)));

  const addCustomParent = (data: Omit<WizardParent, 'enabled' | 'budget' | 'subs'>) =>
    setState((prev) => [
      ...prev,
      { ...data, enabled: true, budget: null, subs: [], isCustom: true },
    ]);

  const addCustomSub = (pid: string, sub: Omit<WizardSub, 'enabled'>) =>
    setState((prev) =>
      prev.map((p) =>
        p.id === pid
          ? { ...p, subs: [...p.subs, { ...sub, enabled: true, isCustom: true }] }
          : p,
      ),
    );

  const enabledParents = state.filter((p) => p.enabled);
  const canNext =
    step === 0
      ? enabledParents.length > 0
      : step === 1
        ? enabledParents.length > 0
        : true;

  return {
    step,
    setStep,
    state,
    toggleParent,
    toggleSub,
    setBudget,
    addCustomParent,
    addCustomSub,
    canNext,
    enabledParents,
  };
}
