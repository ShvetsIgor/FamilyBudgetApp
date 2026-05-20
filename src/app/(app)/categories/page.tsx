'use client';

import { useAppSelector } from '@/store/store';
import { CategoriesHub } from '@/features/categories/components/CategoriesHub';

export default function CategoriesPage() {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return null;
  return <CategoriesHub />;
}
