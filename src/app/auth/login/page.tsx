import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-foreground">Sign In</h2>
      <LoginForm />
    </div>
  );
}
