'use client';

import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import { ThemeProvider } from '@/shared/components/ThemeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}
