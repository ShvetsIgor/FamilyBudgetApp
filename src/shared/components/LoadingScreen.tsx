import Image from 'next/image';

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div role="status" aria-live="polite" className="flex w-full max-w-xs flex-col items-center gap-4 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] bg-primary/10">
          <Image src="/logo-mark.svg" alt="" width={58} height={58} priority />
          <span className="absolute -bottom-1 h-2 w-12 animate-pulse rounded-full bg-primary/20" />
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
