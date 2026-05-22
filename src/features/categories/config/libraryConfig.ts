/**
 * Runtime configuration for the "add from library" onboarding flow.
 *
 * Responsibility: library/onboarding folder definitions only.
 * - Exposes which preset folders can be added to a user's category setup.
 * - Consumed exclusively by library selectors.
 *
 * NOT responsible for: display names, alias resolution, seeding, blueprint data.
 */
import { FOLDER_BLUEPRINTS, type FolderBlueprint } from '../preset/categoryPresets';

export type { FolderBlueprint };

/**
 * Complete list of preset folder definitions for the library picker.
 * Expense flow: filter where id !== 'income'.
 * Income flow:  filter where id === 'income'.
 *
 * selectAvailableLibrary in librarySelectors.ts applies these filters
 * against the user's already-activated folders and categories.
 */
export const LIBRARY_FOLDERS: readonly FolderBlueprint[] = FOLDER_BLUEPRINTS;
