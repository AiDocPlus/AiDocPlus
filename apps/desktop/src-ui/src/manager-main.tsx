import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ManagerWindow } from './manager/ManagerWindow';
import './manager-index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ManagerWindow />
  </StrictMode>
);
