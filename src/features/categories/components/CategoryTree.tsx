'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { CategoryIcon } from './CategoryIcon';
import { useT } from '@/shared/hooks/useT';
import type { Category } from '@/shared/types';

interface Props {
  categories: Category[];
  onAdd: (parentId?: string) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export function CategoryTree({ categories, onAdd, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const t = useT();

  const parents = categories.filter((c) => !c.parentId);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function getChildren(parentId: string) {
    return categories.filter((c) => c.parentId === parentId);
  }

  return (
    <div className="flex flex-col gap-1">
      {parents.map((parent) => {
        const children = getChildren(parent.id);
        const isOpen = expanded.has(parent.id);

        return (
          <div key={parent.id}>
            {/* Parent row */}
            <div className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted transition-colors group">
              <button
                onClick={() => children.length > 0 && toggle(parent.id)}
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                <span className="w-4 shrink-0 text-muted-foreground">
                  {children.length > 0 ? (
                    isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                  ) : null}
                </span>
                <CategoryIcon icon={parent.icon} color={parent.color} size="sm" />
                <span className="text-sm font-medium truncate">{t.cat(parent.name)}</span>
                {parent.isPrivate && (
                  <span className="text-xs text-muted-foreground ml-1">🔒</span>
                )}
              </button>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onAdd(parent.id)}
                  className="rounded-lg p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary"
                  title={t('categories.addSub')}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onEdit(parent)}
                  className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(parent)}
                  className="rounded-lg p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Children */}
            {isOpen && children.length > 0 && (
              <div className="ml-10 flex flex-col gap-1 mt-1">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted transition-colors group"
                  >
                    <CategoryIcon icon={child.icon} color={child.color} size="sm" />
                    <span className="text-sm flex-1 truncate">{t.cat(child.name)}</span>
                    {child.isPrivate && (
                      <span className="text-xs text-muted-foreground">🔒</span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(child)}
                        className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(child)}
                        className="rounded-lg p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Add root category */}
      <button
        onClick={() => onAdd(undefined)}
        className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors mt-2"
      >
        <Plus className="h-4 w-4" />
        {t('categories.add')}
      </button>
    </div>
  );
}
