/**
 * Pure cleanup of the budgets/{uid} limits map (categoryId → monthly limit).
 * Ids are remapped through idMap (oldId → newId, e.g. after a category reset),
 * entries whose mapped id is not in keepIds are dropped as unresolvable,
 * and on remap collisions the larger limit wins.
 */
export function remapLimits(
  limits: Record<string, number>,
  idMap: Record<string, string>,
  keepIds: ReadonlySet<string>,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [catId, limit] of Object.entries(limits)) {
    if (!(limit > 0)) continue;
    const mapped = idMap[catId] ?? catId;
    if (!keepIds.has(mapped)) continue;
    next[mapped] = Math.max(next[mapped] ?? 0, limit);
  }
  return next;
}
