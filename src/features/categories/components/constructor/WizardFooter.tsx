'use client';

interface Props {
  step: number;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
}

export function WizardFooter({ step, canNext, onBack, onNext, onSkip, nextLabel }: Props) {
  return (
    <div className="px-5 py-4 border-t border-[#EDE0CC] flex gap-3">
      {step > 0 && (
        <button
          onClick={onBack}
          className="rounded-2xl border border-[#EDE0CC] px-5 py-3 text-sm font-semibold text-[#8E7A66] hover:bg-[#F4ECDE] transition-colors"
        >
          Назад
        </button>
      )}

      <button
        onClick={onNext}
        disabled={!canNext}
        className="flex-1 rounded-2xl bg-[#E07A5F] py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40 hover:bg-[#C9684E]"
      >
        {nextLabel ?? 'Далее'}
      </button>

      {onSkip && (
        <button
          onClick={onSkip}
          className="rounded-2xl px-5 py-3 text-sm font-medium text-[#8E7A66] hover:text-[#3D2C1F] transition-colors"
        >
          Пропустить
        </button>
      )}
    </div>
  );
}
