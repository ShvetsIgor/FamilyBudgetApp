'use client';
import { useState } from 'react';
import { FOLDER_BLUEPRINTS, CATEGORY_BLUEPRINTS } from '../preset/categoryPresets';

// ─── Wizard state types ───────────────────────────────────────────────────────

/** Represents a folder blueprint in the wizard (will become CategoryFolder). */
export interface WizardFolder {
  id: string;
  name: string;
  ru?: string;
  icon: string;
  color: string;
  enabled: boolean;
  budget: number | null;
  isCustom?: boolean;
}

/** Represents a flat category blueprint in the wizard (will become Category with folderId). */
export interface WizardCategory {
  id: string;
  folderId: string;
  name: string;
  ru?: string;
  icon: string;
  enabled: boolean;
  isCustom?: boolean;
}

// ─── Initialization ───────────────────────────────────────────────────────────

const DEFAULT_ENABLED = new Set(['food', 'home', 'transport', 'shopping', 'health']);

function initFolders(existingIds: Set<string>): WizardFolder[] {
  return FOLDER_BLUEPRINTS
    .filter((f) => f.id !== 'income')
    .map((f) => ({
      ...f,
      enabled: existingIds.has(f.id) || DEFAULT_ENABLED.has(f.id),
      budget: null,
    }));
}

function initCategories(existingIds: Set<string>): WizardCategory[] {
  return CATEGORY_BLUEPRINTS
    .filter((c) => c.folderId !== 'income')
    .map((c) => ({
      id: c.id,
      folderId: c.folderId,
      name: c.name,
      ru: c.ru,
      icon: c.icon,
      enabled: !existingIds.has(c.id),
    }));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConstructorState(existingCategoryIds: Set<string>) {
  const [step, setStep] = useState(0);
  const [folders, setFolders] = useState<WizardFolder[]>(() => initFolders(existingCategoryIds));
  const [categories, setCategories] = useState<WizardCategory[]>(() => initCategories(existingCategoryIds));

  const toggleFolder = (id: string) =>
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));

  const toggleCategory = (id: string) =>
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));

  const setBudget = (folderId: string, v: number | null) =>
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, budget: v } : f)));

  const addCustomFolder = (data: Omit<WizardFolder, 'enabled' | 'budget'>) =>
    setFolders((prev) => [...prev, { ...data, enabled: true, budget: null, isCustom: true }]);

  const addCustomCategory = (folderId: string, data: Omit<WizardCategory, 'enabled' | 'folderId'>) =>
    setCategories((prev) => [...prev, { ...data, folderId, enabled: true, isCustom: true }]);

  const getCatsInFolder = (folderId: string) =>
    categories.filter((c) => c.folderId === folderId);

  const enabledFolders = folders.filter((f) => f.enabled);

  const canNext =
    step === 0 ? enabledFolders.length > 0 :
    step === 1 ? enabledFolders.length > 0 :
    true;

  return {
    step, setStep,
    folders, categories,
    toggleFolder, toggleCategory,
    setBudget, addCustomFolder, addCustomCategory,
    canNext, enabledFolders, getCatsInFolder,
  };
}
