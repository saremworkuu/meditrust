import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isPrivyError =
        this.state.error?.message?.toLowerCase().includes('privy') ||
        this.state.error?.message?.includes('invalid Privy app ID');

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              {isPrivyError ? 'Privy App ID Configuration Issue' : 'Something went wrong'}
            </h2>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 text-left bg-slate-100 dark:bg-slate-900 p-3 rounded-lg font-mono break-words">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>

            {isPrivyError && (
              <div className="text-left text-xs text-slate-600 dark:text-slate-300 mb-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 rounded-lg space-y-1.5">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">How to fix:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300">
                  <li>Get a free 25-character App ID from <a href="https://dashboard.privy.io" target="_blank" rel="noreferrer" className="underline font-semibold text-emerald-600">dashboard.privy.io</a></li>
                  <li>Open <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">.env.local</code> in the project root</li>
                  <li>Set <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">NEXT_PUBLIC_PRIVY_APP_ID="cl..."</code></li>
                  <li>Restart the dev server</li>
                </ol>
              </div>
            )}

            <div className="flex space-x-2">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex-1 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
