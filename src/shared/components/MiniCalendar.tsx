'use client';

import { useState } from 'react';
import { format } from 'date-fns';

export function toDateInput(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export function MiniCalendar({ value, onChange, color }: { value: string; onChange: (d: string) => void; color: string }) {
  const selected = new Date(value + 'T12:00:00');
  const [view, setView] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));

  const year = view.getFullYear();
  const month = view.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const today = toDateInput(new Date());

  return (
    <div className="bg-card rounded-2xl border border-border p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setView(new Date(year, month - 1, 1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted text-lg font-bold"
        >‹</button>
        <span className="text-sm font-extrabold text-foreground">{MONTHS_RU[month]} {year}</span>
        <button
          onClick={() => setView(new Date(year, month + 1, 1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted text-lg font-bold"
        >›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_RU.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateVal = toDateInput(new Date(year, month, day));
          const isSelected = dateVal === value;
          const isToday = dateVal === today;
          return (
            <button
              key={i}
              onClick={() => onChange(dateVal)}
              className="h-8 w-full flex items-center justify-center rounded-lg text-sm transition-all"
              style={{
                background: isSelected ? color : isToday ? color + '22' : 'transparent',
                color: isSelected ? '#fff' : isToday ? color : 'hsl(var(--foreground))',
                fontWeight: isToday || isSelected ? 800 : 600,
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
