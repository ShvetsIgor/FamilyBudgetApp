'use client';

import { Component, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import { ThemeProvider } from '@/shared/components/ThemeProvider';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 13, background: '#fff', color: '#c00', minHeight: '100vh' }}>
          <b>Client error (copy this text):</b><br /><br />
          {String(this.state.error)}<br /><br />
          {this.state.error.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
}
