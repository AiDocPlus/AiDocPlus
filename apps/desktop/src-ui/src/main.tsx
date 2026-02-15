import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 全局禁用拼写检查和自动纠正
document.documentElement.setAttribute('spellcheck', 'false');
document.body.setAttribute('spellcheck', 'false');

function disableSpellCheck(el: Element) {
  if (el.getAttribute('spellcheck') !== 'false') el.setAttribute('spellcheck', 'false');
  if (el.getAttribute('autocorrect') !== 'off') el.setAttribute('autocorrect', 'off');
  if (el.getAttribute('autocapitalize') !== 'off') el.setAttribute('autocapitalize', 'off');
}

function scanAndDisable(root: Element | Document) {
  root.querySelectorAll('input, textarea, [contenteditable]').forEach(disableSpellCheck);
}

// 对已有元素禁用
scanAndDisable(document);

// 监听动态添加的元素 + contenteditable 属性变化
new MutationObserver((mutations) => {
  for (const m of mutations) {
    // 新增节点
    for (const node of m.addedNodes) {
      if (node instanceof HTMLElement) {
        if (node.matches('input, textarea, [contenteditable]')) disableSpellCheck(node);
        scanAndDisable(node);
      }
    }
    // contenteditable 属性被设置时，补充 spellcheck 等属性
    if (m.type === 'attributes' && m.attributeName === 'contenteditable' && m.target instanceof HTMLElement) {
      disableSpellCheck(m.target);
    }
  }
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['contenteditable'] });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
