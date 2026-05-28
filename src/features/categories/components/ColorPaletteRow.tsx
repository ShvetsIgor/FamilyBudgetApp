const PALETTE = [
  '#5B6CFF', '#0F8559', '#2A5FB3', '#6747E6',
  '#D14671', '#C77A1A', '#1B7AA8', '#C2422C',
  '#18A957', '#A48006', '#4F525B', '#FF4F2B',
  '#111827', '#64748B', '#0F766E', '#7C3AED',
  '#BE123C', '#F97316', '#84CC16', '#06B6D4',
];

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPaletteRow({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((color) => {
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className="h-8 w-8 rounded-full border transition-all"
            style={{
              backgroundColor: color,
              borderColor: selected ? 'hsl(var(--foreground))' : 'hsl(var(--border))',
              boxShadow: selected ? `0 0 0 3px ${color}33` : 'none',
            }}
            aria-label={color}
          />
        );
      })}
    </div>
  );
}
