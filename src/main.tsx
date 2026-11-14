import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { PrivyWagmiProvider } from '../lib/auth/PrivyWagmiProvider.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <PrivyWagmiProvider>
      <App />
    </PrivyWagmiProvider>
  </ErrorBoundary>
);
