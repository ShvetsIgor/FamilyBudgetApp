'use client';

const PRESETS = [500, 1000, 2000, 5000];

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  currency?: string;
}

export function BudgetField({ value, onChange, currency = '₪' }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-[#EDE0CC] bg-white px-3 py-2">
        <span className="text-[#8E7A66] font-medium text-sm">{currency}</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={value ?? ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(isNaN(v) ? null : v);
          }}
          className="flex-1 bg-transparent text-sm text-[#3D2C1F] outline-hidden placeholder:text-[#B6A48E]"
        />
        {value != null && (
          <button
            onClick={() => onChange(null)}
            className="text-[#B6A48E] hover:text-[#8E7A66] text-xs"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`rounded-lg px-3 py-1 text-xs font-medium border transition-colors ${
              value === p
                ? 'bg-[#E07A5F] text-white border-[#E07A5F]'
                : 'bg-white text-[#8E7A66] border-[#EDE0CC] hover:border-[#E07A5F] hover:text-[#E07A5F]'
            }`}
          >
            {currency}{p.toLocaleString()}
          </button>
        ))}
      </div>
    </div>
  );
}
