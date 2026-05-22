import { FOLDER_BLUEPRINTS, type FolderBlueprint } from '../preset/categoryPresets';

export type { FolderBlueprint };

/**
 * All preset folder definitions available in the "add from library" flow.
 * Selectors filter this list against store state to show unactivated folders.
 * Expense folders: all entries where id !== 'income'.
 * Income folder:   the single entry where id === 'income'.
 */
export const LIBRARY_FOLDERS: readonly FolderBlueprint[] = FOLDER_BLUEPRINTS;
