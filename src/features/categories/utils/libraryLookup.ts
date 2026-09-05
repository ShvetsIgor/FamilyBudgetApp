import type { CategoryType } from '@/shared/types';
import {
  CATEGORY_BLUEPRINTS,
  FOLDER_BLUEPRINTS,
  type CategoryBlueprint,
  type FolderBlueprint,
} from '../preset/categoryPresets';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function folderCandidates(blueprint: FolderBlueprint): string[] {
  return [blueprint.name, blueprint.ru].filter((value): value is string => Boolean(value)).map(normalize);
}

function categoryCandidates(blueprint: CategoryBlueprint): string[] {
  return [blueprint.name, blueprint.ru].filter((value): value is string => Boolean(value)).map(normalize);
}

export interface LibrarySuggestion {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export function getFolderLibraryBlueprints(type: CategoryType): readonly FolderBlueprint[] {
  return FOLDER_BLUEPRINTS.filter((folder) => (
    type === 'expense' ? folder.id !== 'income' : folder.id === 'income'
  ));
}

export function getCategoryLibraryBlueprints(type: CategoryType): readonly CategoryBlueprint[] {
  return CATEGORY_BLUEPRINTS.filter((category) => (
    type === 'expense' ? category.folderId !== 'income' : category.folderId === 'income'
  ));
}

export function folderBlueprintToSuggestion(blueprint: FolderBlueprint, language: string = 'ru'): LibrarySuggestion {
  return {
    id: blueprint.id,
    label: language === 'ru' ? blueprint.ru ?? blueprint.name : blueprint.name,
    icon: blueprint.icon,
    color: blueprint.color,
  };
}

export function categoryBlueprintToSuggestion(blueprint: CategoryBlueprint, language: string = 'ru'): LibrarySuggestion {
  return {
    id: blueprint.id,
    label: language === 'ru' ? blueprint.ru ?? blueprint.name : blueprint.name,
    icon: blueprint.icon,
    color: blueprint.color,
  };
}

export function findFolderBlueprint(
  type: CategoryType,
  match: { id?: string; name?: string },
): FolderBlueprint | undefined {
  const blueprints = getFolderLibraryBlueprints(type);
  if (match.id) {
    const byId = blueprints.find((folder) => folder.id === match.id);
    if (byId) return byId;
  }
  if (!match.name) return undefined;
  const query = normalize(match.name);
  return blueprints.find((folder) => folderCandidates(folder).includes(query));
}

export function findCategoryBlueprint(
  type: CategoryType,
  match: { id?: string; name?: string },
): CategoryBlueprint | undefined {
  const blueprints = getCategoryLibraryBlueprints(type);
  if (match.id) {
    const byId = blueprints.find((category) => category.id === match.id);
    if (byId) return byId;
  }
  if (!match.name) return undefined;
  const query = normalize(match.name);
  return blueprints.find((category) => categoryCandidates(category).includes(query));
}
