'use client';

const PALETTE = [
  '#E07A5F', '#C97B84', '#81B29A', '#A48BC9',
  '#8AA9D6', '#F2CC8F', '#D4A574', '#A8B89C',
  '#E9B384', '#8E7A66', '#B6A48E', '#3D2C1F',
];

interface Props {
  value: string;
  onChange: (c: string) => void;
}

export function ColorPaletteRow({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PALETTE.map((color) => (
        <button
          key={color}
          onClick={() => onChange(color)}
          className="h-8 w-8 rounded-full flex-shrink-0 transition-transform hover:scale-110"
          style={{
            backgroundColor: color,
            outline: value === color ? `3px solid ${color}` : '3px solid transparent',
            outlineOffset: '2px',
          }}
          aria-label={color}
        />
      ))}
    </div>
  );
}
