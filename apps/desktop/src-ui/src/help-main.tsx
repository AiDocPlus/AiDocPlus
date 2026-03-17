import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelpWindow } from './help/HelpWindow';
import './help-index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelpWindow />
  </StrictMode>
);
