import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo block */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/logo-mark.svg"
            alt="Family Budget"
            width={96}
            height={96}
            priority
            className="h-24 w-24"
          />
          <Image
            src="/logo-wordmark.svg"
            alt="Family Budget"
            width={200}
            height={56}
            priority
            className="h-14 w-auto"
          />
        </div>
        {children}
      </div>
    </div>
  );
}
