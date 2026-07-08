'use client';
import { useT } from '@/shared/hooks/useT';

const STEP_KEYS = ['stepsCategories', 'stepsRefine', 'stepsBudget', 'stepsDone'] as const;

interface Props {
  step: number;
  onClose: () => void;
}

export function WizardHeader({ step, onClose }: Props) {
  const t = useT();
  const progress = ((step + 1) / STEP_KEYS.length) * 100;

  return (
    <div className="px-5 pt-5 pb-4 space-y-4 border-b border-[#EDE0CC]">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[#3D2C1F]">
          {t('categories.constructor.stepOf', { a: step + 1, b: STEP_KEYS.length })}
        </h2>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full flex items-center justify-center bg-[#F4ECDE] text-[#8E7A66] hover:bg-[#EDE0CC] transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      {/* Step labels */}
      <div className="flex gap-1">
        {STEP_KEYS.map((k, i) => (
          <div key={k} className="flex-1 text-center">
            <div
              className={`text-[10px] font-medium mb-1 ${
                i === step ? 'text-[#E07A5F]' : i < step ? 'text-[#81B29A]' : 'text-[#B6A48E]'
              }`}
            >
              {t(`categories.constructor.${k}`)}
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-[#EDE0CC] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#E07A5F] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
