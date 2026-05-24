import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-6xl">🐷</p>
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-muted-foreground">Страница не найдена</p>
      <Link
        href="/home"
        className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        На главную
      </Link>
    </div>
  );
}
