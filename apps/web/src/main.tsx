import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './app/router';
import { queryClient } from './app/query-client';
import { AuthProvider } from './features/auth/AuthProvider';
import { FeedbackProvider } from './components/feedback';
import { applyStoredTheme } from './app/theme';
import './styles.css';

applyStoredTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FeedbackProvider>
          <RouterProvider router={router}/>
        </FeedbackProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
