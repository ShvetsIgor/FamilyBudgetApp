import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Left brand panel — desktop only ── */}
      <div className="hidden lg:flex w-[480px] flex-shrink-0 flex-col items-center justify-center bg-primary px-12 gap-8">
        <div className="flex flex-col items-center gap-4">
          <Image src="/logo-mark.svg" alt="Family Budget" width={100} height={100} priority className="h-24 w-24" />
          <Image src="/logo-wordmark.svg" alt="Family Budget" width={220} height={60} priority className="h-14 w-auto brightness-0 invert" />
        </div>
        <p className="text-primary-foreground/80 text-center text-base leading-relaxed max-w-[280px]">
          Track spending, set savings goals, and manage your family finances — all in one place.
        </p>
        <ul className="flex flex-col gap-3 w-full max-w-[280px]">
          {[
            ['📊', 'Expense tracking with categories'],
            ['🎯', 'Savings goals with progress'],
            ['🔄', 'Recurring payments & reminders'],
            ['👨‍👩‍👧', 'Shared family budgets'],
          ].map(([icon, text]) => (
            <li key={text} className="flex items-center gap-3 text-primary-foreground/90 text-sm">
              <span className="text-xl">{icon}</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Logo — mobile only */}
          <div className="lg:hidden mb-8 flex flex-col items-center gap-3">
            <Image src="/logo-mark.svg" alt="Family Budget" width={96} height={96} priority className="h-24 w-24" />
            <Image src="/logo-wordmark.svg" alt="Family Budget" width={200} height={56} priority className="h-14 w-auto" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
