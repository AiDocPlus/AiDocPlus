import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/i18n';
import { ReaderApp } from './ReaderApp';
import '@/help-index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReaderApp />
  </StrictMode>,
);
