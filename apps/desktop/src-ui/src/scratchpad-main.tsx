import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/i18n';
import { QuickCaptureWindow } from '@/quick-capture/QuickCaptureWindow';
import './help-index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QuickCaptureWindow />
  </StrictMode>,
);
