import { RegisterForm } from '@/features/auth/components/RegisterForm';

export default function RegisterPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-foreground">Create Account</h2>
      <RegisterForm />
    </div>
  );
}
