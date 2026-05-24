'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils/cn';
import type { Category, CategoryType } from '@/shared/types';

const PRESET_ICONS = ['🍽️','🛒','🏠','🚗','❤️','🛍️','🎬','📚','👶','💼','📱','✈️','🎁','🐾','⚽','🎵','💅','🔧','📦','💡','☕','🍷','💊','🏋️','🎮','📺','🎓','📖','🧹','⛽'];
const PRESET_COLORS = ['#f97316','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#eab308','#10b981','#f59e0b','#ef4444','#6b7280','#14b8a6','#a855f7'];

interface Props {
  type: CategoryType;
  parentId?: string;
  initial?: Partial<Category>;
  onSave: (data: Omit<Category, 'id' | 'userId'>) => Promise<void>;
  onCancel: () => void;
}

export function CategoryForm({ type, parentId, initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '📦');
  const [color, setColor] = useState(initial?.color ?? '#6b7280');
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    try {
      await onSave({ name: name.trim(), icon, color, isPrivate, parentId, order: initial?.order ?? 99, type });
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Icon picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Icon</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors',
                icon === i ? 'border-primary bg-primary/10' : 'border-border bg-card'
              )}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Color</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition-transform',
                color === c ? 'border-foreground scale-110' : 'border-transparent'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Private toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setIsPrivate(!isPrivate)}
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors',
            isPrivate ? 'bg-primary' : 'bg-muted'
          )}
        >
          <div className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            isPrivate ? 'translate-x-5' : 'translate-x-0.5'
          )} />
        </div>
        <span className="text-sm">Private (hidden from family)</span>
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
