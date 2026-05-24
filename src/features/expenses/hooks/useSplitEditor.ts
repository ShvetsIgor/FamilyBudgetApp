import { useState, useCallback } from 'react';
import type { Category } from '@/shared/types';
import type { CategoryGroup } from '@/features/categories/hooks/useCategoryGroups';

export interface SplitRow {
  categoryId: string;
  groupCatId: string;
  name: string;
  groupName: string;
  icon: string;
  color: string;
  amount: string;
}

export function applyKey(cur: string, key: string): string {
  if (key === '.') {
    if (cur.includes('.')) return cur;
    return cur + '.';
  }
  if (key === '⌫') { const s = cur.slice(0, -1); return s === '' ? '0' : s; }
  if (cur === '0') return String(key);
  return cur + String(key);
}

interface UseSplitEditorOptions {
  totalNum: number;
  topFolders: CategoryGroup[];
  selectedCatId: string;
  selectedCat?: Category;
  initialSplits?: SplitRow[];
  onSplitAdded?: () => void;
}

export function useSplitEditor({
  totalNum,
  topFolders,
  selectedCatId,
  selectedCat,
  initialSplits = [],
  onSplitAdded,
}: UseSplitEditorOptions) {
  const [splits, setSplits] = useState<SplitRow[]>(initialSplits);
  const [editing, setEditing] = useState<'total' | number>('total');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null);

  // Derived math
  const splitsSum = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const remainder = Math.max(0, totalNum - splitsSum);
  const splitsOverflow = splits.length > 0 && splitsSum > totalNum + 0.01;
  const posCount = splits.filter((s) => parseFloat(s.amount) > 0).length + (remainder > 0 ? 1 : 0);

  const addSplit = useCallback(
    (sub: Category) => {
      if (splits.find((s) => s.categoryId === sub.id)) return;
      const groupFolder = pickerGroupId ? topFolders.find((f) => f.id === pickerGroupId) : null;
      const color = groupFolder?.color ?? sub.color;
      const newIdx = splits.length; // index the new split will occupy
      setSplits((prev) => [
        ...prev,
        {
          categoryId: sub.id,
          groupCatId: pickerGroupId ?? selectedCatId,
          name: sub.name,
          groupName: groupFolder?.name ?? selectedCat?.name ?? '',
          icon: sub.icon,
          color,
          amount: '0',
        },
      ]);
      setEditing(newIdx);        // outside updater — correct
      if (onSplitAdded) requestAnimationFrame(onSplitAdded);  // outside updater — correct
      setPickerOpen(false);
      setPickerGroupId(null);
    },
    [splits, pickerGroupId, topFolders, selectedCatId, selectedCat, onSplitAdded],
  );

  // Batch-add multiple categories at once (for preset combos)
  const addSplitBatch = useCallback(
    (cats: Category[]) => {
      const toAdd = cats.filter((c) => !splits.find((s) => s.categoryId === c.id));
      if (toAdd.length === 0) return;
      setSplits((prev) => {
        let next = prev;
        for (const cat of toAdd) {
          if (next.find((s) => s.categoryId === cat.id)) continue;
          next = [
            ...next,
            {
              categoryId: cat.id,
              groupCatId: selectedCatId,
              name: cat.name,
              groupName: selectedCat?.name ?? '',
              icon: cat.icon,
              color: cat.color,
              amount: '0',
            },
          ];
        }
        return next;
      });
      setEditing(splits.length + toAdd.length - 1);
      setPickerOpen(false);
      setPickerGroupId(null);
    },
    [splits, selectedCatId, selectedCat],
  );

  const removeSplit = useCallback((i: number) => {
    setSplits((prev) => prev.filter((_, j) => j !== i));
    setEditing('total');
  }, []);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
    setPickerGroupId(null);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerGroupId(null);
  }, []);

  const tapOnSplit = useCallback((idx: number, key: string) => {
    setSplits((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, amount: applyKey(s.amount, key) } : s))
    );
  }, []);

  const splitEven = useCallback(() => {
    if (splits.length === 0 || totalNum <= 0) return;
    const count = splits.length + 1; // +1 for the main row
    const share = Math.round((totalNum / count) * 100) / 100;
    const extra = Math.round((totalNum - share * count) * 100) / 100;
    setSplits((prev) =>
      prev.map((s, i) => ({
        ...s,
        amount: String(i === prev.length - 1 ? share + extra : share),
      }))
    );
  }, [splits.length, totalNum]);

  return {
    splits,
    editing,
    setEditing,
    pickerOpen,
    pickerGroupId,
    setPickerGroupId,
    addSplit,
    addSplitBatch,
    removeSplit,
    openPicker,
    closePicker,
    tapOnSplit,
    splitEven,
    splitsSum,
    remainder,
    splitsOverflow,
    posCount,
  };
}
