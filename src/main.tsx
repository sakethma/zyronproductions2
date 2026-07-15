import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global fetch interceptor to inject auth token
const originalFetch = window.fetch;
Object.defineProperty(window, 'fetch', {
  value: async (...args: Parameters<typeof originalFetch>) => {
    let [resource, config] = args;
    
    const token = localStorage.getItem('dev_token');
    
    if (token) {
      config = config || {};
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`
      };
    }
    
    return originalFetch(resource, config);
  },
  writable: true,
  configurable: true,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
