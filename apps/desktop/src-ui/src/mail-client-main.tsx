// ── 邮件客户端独立窗口 React 入口 ──

import React from 'react';
import ReactDOM from 'react-dom/client';
import { MailClientApp } from './mail-client/MailClientApp';

// 全局样式（最小化，后续可引入 Tailwind）
const globalStyle = document.createElement('style');
globalStyle.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: '宋体', SimSun, serif;
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
    background: #f8f9fa;
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
`;
document.head.appendChild(globalStyle);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MailClientApp />
  </React.StrictMode>,
);
