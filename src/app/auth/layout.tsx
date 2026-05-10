export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary">Budget</h1>
          <p className="mt-1 text-sm text-muted-foreground">Family Finance Tracker</p>
        </div>
        {children}
      </div>
    </div>
  );
}
