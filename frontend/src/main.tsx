import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ServerWakeNotice } from './components/ServerWakeNotice';
import { isTransientError } from './lib/api';
import { AuthProvider } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import './index.css';
import './lib/validation'; // registra los mensajes de validación en español

// api.ts ya espera ~90 s a que despierte el servidor; si aun así falla por red/502-504, Query reintenta
// con espera creciente (2, 4, 8 s). Los errores 4xx no se reintentan más de una vez.
const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => (isTransientError(err) ? count < 3 : count < 1),
      retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 15_000),
      staleTime: 10_000,
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary scope="aplicación" fullScreen>
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <ServerWakeNotice />
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
