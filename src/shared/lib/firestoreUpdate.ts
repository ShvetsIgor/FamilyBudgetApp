import { deleteField, type FieldValue } from 'firebase/firestore';

/**
 * `updateDoc` rejects `undefined` outright. For an edit form an absent value
 * means «this field is gone now» — a category moved out of its folder must
 * lose `folderId`, not keep the old one — so `undefined` becomes a delete.
 */
export function toUpdatePayload<T extends object>(data: T): Record<string, unknown | FieldValue> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value === undefined ? deleteField() : value]),
  );
}
