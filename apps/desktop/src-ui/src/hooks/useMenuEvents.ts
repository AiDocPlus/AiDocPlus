import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open, save, message, confirm } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/stores/useAppStore';
import i18n from '@/i18n';
import { formatBackendError } from '@/lib/backendError';

/**
 * 监听 Tauri 原生系统菜单事件，分发到前端操作
 */
export function useMenuEvents(onSettingsOpen: () => void) {
  useEffect(() => {
    const unlisten = listen<string>('menu-event', async (event) => {
      const menuId = event.payload;

      switch (menuId) {
        // ── 文件菜单 ──
        case 'new_project':
          window.dispatchEvent(new CustomEvent('create-project-dialog'));
          break;
        case 'new_document':
          window.dispatchEvent(new CustomEvent('editor-new-document'));
          break;
        case 'new_document_dialog': {
          // 获取当前项目 ID，弹出新建文档对话框
          const { useAppStore } = await import('@/stores/useAppStore');
          const projectId = useAppStore.getState().currentProject?.id;
          if (projectId) {
            window.dispatchEvent(new CustomEvent('create-document-dialog', { detail: { projectId } }));
          } else {
            await message(i18n.t('menu.openProjectFirst'), { title: i18n.t('menu.newDocument'), kind: 'warning' });
          }
          break;
        }
        case 'save':
          window.dispatchEvent(new CustomEvent('save-active-tab'));
          break;
        case 'save_all':
          window.dispatchEvent(new CustomEvent('save-all-tabs'));
          break;
        case 'import_file': {
          // 直接打开文件选择对话框并导入内容到编辑器
          try {
            const selected = await open({
              multiple: false,
              filters: [
                {
                  name: i18n.t('editor.toolbar.documentFiles', { defaultValue: '文档文件' }),
                  extensions: ['txt', 'md', 'markdown', 'docx', 'csv', 'html', 'htm', 'json', 'xml', 'yaml', 'yml', 'toml', 'rst', 'tex', 'log'],
                },
                { name: i18n.t('editor.toolbar.allFiles', { defaultValue: '所有文件' }), extensions: ['*'] },
              ],
            });
            if (!selected) break;
            const filePath = typeof selected === 'string' ? selected : (selected as any)?.path ?? String(selected);
            const content = await invoke<string>('import_file', { path: filePath });
            if (content) {
              window.dispatchEvent(new CustomEvent('editor-import-content', { detail: content }));
            }
          } catch (err) {
            console.error('[MenuEvents] 导入文件失败:', err);
          }
          break;
        }
        case 'export_md':
          window.dispatchEvent(new CustomEvent('editor-export', { detail: 'md' }));
          break;
        case 'export_html':
          window.dispatchEvent(new CustomEvent('editor-export', { detail: 'html' }));
          break;
        case 'export_docx':
          window.dispatchEvent(new CustomEvent('editor-export', { detail: 'docx' }));
          break;
        case 'export_pdf':
          window.dispatchEvent(new CustomEvent('editor-export', { detail: 'pdf' }));
          break;
        case 'export_txt':
          window.dispatchEvent(new CustomEvent('editor-export', { detail: 'txt' }));
          break;
        case 'close_tab': {
          // 通过已有的快捷键事件通道处理（TabShortcuts 中有完整的未保存检查逻辑）
          const { activeTabId, tabs, closeTab } = useAppStore.getState();
          if (activeTabId) {
            const tab = tabs.find(t => t.id === activeTabId);
            await closeTab(activeTabId, tab?.isDirty ? true : false);
          }
          break;
        }
        case 'settings':
          onSettingsOpen();
          break;

        // ── 编辑菜单：基础操作（原 PredefinedMenuItem 改为自定义菜单项后需前端处理） ──
        case 'undo':
          document.execCommand('undo');
          break;
        case 'redo':
          document.execCommand('redo');
          break;
        case 'cut':
          document.execCommand('cut');
          break;
        case 'copy':
          document.execCommand('copy');
          break;
        case 'paste':
          navigator.clipboard.readText().then(text => {
            const el = document.activeElement;
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
              const start = el.selectionStart ?? 0;
              const end = el.selectionEnd ?? 0;
              el.setRangeText(text, start, end, 'end');
              el.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              // CodeMirror 或其他：转发给编辑器处理
              window.dispatchEvent(new CustomEvent('editor-menu-action', { detail: 'paste' }));
            }
          }).catch(() => {});
          break;
        case 'paste_plain':
          navigator.clipboard.readText().then(text => {
            const el = document.activeElement;
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
              const start = el.selectionStart ?? 0;
              const end = el.selectionEnd ?? 0;
              el.setRangeText(text, start, end, 'end');
              el.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              window.dispatchEvent(new CustomEvent('editor-menu-action', { detail: 'paste_plain' }));
            }
          }).catch(() => {});
          break;
        case 'select_all':
          document.execCommand('selectAll');
          break;
        case 'find':
          window.dispatchEvent(new CustomEvent('open-search'));
          break;
        case 'find_replace':
          window.dispatchEvent(new CustomEvent('editor-menu-action', { detail: 'find_replace' }));
          break;

        // ── 视图菜单 ──
        case 'toggle_sidebar':
          useAppStore.getState().toggleSidebar();
          break;
        case 'toggle_chat':
          window.dispatchEvent(new CustomEvent('editor-toggle-chat'));
          break;
        case 'toggle_layout':
          window.dispatchEvent(new CustomEvent('editor-toggle-layout'));
          break;
        case 'version_history':
          window.dispatchEvent(new CustomEvent('editor-version-history'));
          break;
        case 'view_editor':
          window.dispatchEvent(new CustomEvent('menu-view-switch', { detail: 'editor' }));
          break;
        case 'view_plugins':
          window.dispatchEvent(new CustomEvent('menu-view-switch', { detail: 'plugins' }));
          break;
        case 'view_composer':
          window.dispatchEvent(new CustomEvent('menu-view-switch', { detail: 'composer' }));
          break;
        case 'view_functional':
          window.dispatchEvent(new CustomEvent('menu-view-switch', { detail: 'functional' }));
          break;
        case 'view_coding':
          window.dispatchEvent(new CustomEvent('menu-view-switch', { detail: 'coding' }));
          break;

        // ── 项目管理 ──
        case 'project_rename':
          window.dispatchEvent(new CustomEvent('menu-rename-project'));
          break;
        case 'project_delete':
          await handleProjectDelete();
          break;
        case 'project_export_zip':
          await handleProjectExportZip();
          break;
        case 'project_import_zip':
          await handleProjectImportZip();
          break;
        case 'project_backup':
          await handleProjectBackup();
          break;

        // ── 文档管理 ──
        case 'doc_rename':
          window.dispatchEvent(new CustomEvent('menu-rename-document'));
          break;
        case 'doc_delete':
          await handleDocDelete();
          break;
        case 'doc_duplicate':
          await handleDocDuplicate();
          break;
        case 'doc_move_to':
          window.dispatchEvent(new CustomEvent('menu-doc-move-to'));
          break;
        case 'doc_copy_to':
          window.dispatchEvent(new CustomEvent('menu-doc-copy-to'));
          break;

        // ── 工具菜单 ──
        case 'tools_quick_capture':
          await message(i18n.t('menu.featureComingSoon', { defaultValue: '功能开发中，敬请期待' }), { title: i18n.t('menu.quickCapture', { defaultValue: '快速记录' }), kind: 'info' });
          break;
        case 'tools_ebook_reader':
          await message(i18n.t('menu.featureComingSoon', { defaultValue: '功能开发中，敬请期待' }), { title: i18n.t('menu.ebookReader', { defaultValue: '电子书阅读器' }), kind: 'info' });
          break;

        // ── 模板菜单 ──
        case 'new_from_template':
          window.dispatchEvent(new CustomEvent('menu-new-from-template'));
          break;
        case 'save_as_template':
          window.dispatchEvent(new CustomEvent('menu-save-as-template'));
          break;
        case 'manage_templates':
          window.dispatchEvent(new CustomEvent('menu-manage-templates'));
          break;

        // ── 帮助菜单 ──
        case 'shortcuts_ref':
          window.dispatchEvent(new CustomEvent('menu-shortcuts-ref'));
          break;
        case 'first_run_guide':
          window.dispatchEvent(new CustomEvent('menu-first-run-guide'));
          break;
        case 'help_website':
          invoke('open_file_with_app', { path: 'https://AiDocPlus.com', appName: null }).catch(() => {});
          break;
        case 'help_docs':
          invoke('open_help_center').catch(() => {});
          break;
        case 'help_feedback':
          invoke('open_file_with_app', { path: 'https://github.com/AiDocPlus/AiDocPlus/issues', appName: null }).catch(() => {});
          break;
        case 'check_update':
          window.dispatchEvent(new CustomEvent('menu-check-update'));
          break;
        case 'about':
          window.dispatchEvent(new CustomEvent('menu-about'));
          break;

        default:
          // 编辑类菜单事件（文本转换/行操作/选择/格式/插入等）转发给活动编辑器处理
          window.dispatchEvent(new CustomEvent('editor-menu-action', { detail: menuId }));
          break;
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [onSettingsOpen]);
}

/** 导出当前项目为 ZIP */
async function handleProjectExportZip() {
  const { currentProject, exportProjectZip } = useAppStore.getState();
  if (!currentProject) {
    await message(i18n.t('menu.openProjectFirst'), { title: i18n.t('menu.exportProject'), kind: 'warning' });
    return;
  }

  const outputPath = await save({
    title: i18n.t('menu.exportProjectZip'),
    defaultPath: `${currentProject.name}.zip`,
    filters: [{ name: i18n.t('menu.zipFilter'), extensions: ['zip'] }],
  });

  if (!outputPath) return;

  try {
    await exportProjectZip(currentProject.id, outputPath);
    await message(i18n.t('menu.exportedTo', { path: outputPath }), { title: i18n.t('menu.exportSuccess') });
  } catch (err) {
    await message(i18n.t('menu.exportFailed', { error: formatBackendError(err) }), { title: i18n.t('menu.exportError'), kind: 'error' });
  }
}

/** 从 ZIP 导入项目 */
async function handleProjectImportZip() {
  const zipPath = await open({
    title: i18n.t('menu.importProjectZip'),
    filters: [{ name: i18n.t('menu.zipFilter'), extensions: ['zip'] }],
    multiple: false,
  });

  if (!zipPath) return;

  try {
    const project = await useAppStore.getState().importProjectZip(zipPath as string);
    await message(i18n.t('menu.importSuccess', { name: project.name }), { title: i18n.t('menu.importSuccessTitle') });
  } catch (err) {
    await message(i18n.t('menu.importFailed', { error: formatBackendError(err) }), { title: i18n.t('menu.importError'), kind: 'error' });
  }
}

/** 备份当前项目（带时间戳的 ZIP） */
async function handleProjectBackup() {
  const { currentProject, exportProjectZip } = useAppStore.getState();
  if (!currentProject) {
    await message(i18n.t('menu.openProjectFirst'), { title: i18n.t('menu.backupProject'), kind: 'warning' });
    return;
  }

  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const defaultName = `${currentProject.name}_backup_${timestamp}.zip`;

  const outputPath = await save({
    title: i18n.t('menu.backupProject'),
    defaultPath: defaultName,
    filters: [{ name: i18n.t('menu.zipFilter'), extensions: ['zip'] }],
  });

  if (!outputPath) return;

  try {
    await exportProjectZip(currentProject.id, outputPath);
    await message(i18n.t('menu.backedUpTo', { path: outputPath }), { title: i18n.t('menu.backupSuccess') });
  } catch (err) {
    await message(i18n.t('menu.backupFailed', { error: formatBackendError(err) }), { title: i18n.t('menu.backupError'), kind: 'error' });
  }
}

/** 删除当前文档 */
async function handleProjectDelete() {
  const { currentProject, deleteProject, loadProjects, openProject } = useAppStore.getState();
  if (!currentProject) {
    await message(i18n.t('menu.openProjectFirst'), { title: i18n.t('menu.deleteProject'), kind: 'warning' });
    return;
  }

  const confirmed = await confirm(
    i18n.t('menu.deleteProjectConfirm', { name: currentProject.name }),
    { title: i18n.t('menu.deleteProject'), kind: 'warning', okLabel: i18n.t('menu.deleteLabel'), cancelLabel: i18n.t('menu.cancelLabel') }
  );
  if (!confirmed) return;

  try {
    const deletedId = currentProject.id;
    await deleteProject(deletedId);
    await loadProjects();
    // 切换到其他项目
    const remaining = useAppStore.getState().projects;
    if (remaining.length > 0) {
      await openProject(remaining[0].id);
    }
    await message(i18n.t('menu.projectDeleted'), { title: i18n.t('menu.deleteSuccess') });
  } catch (err) {
    await message(i18n.t('menu.deleteFailed', { error: formatBackendError(err) }), { title: i18n.t('menu.deleteError'), kind: 'error' });
  }
}

/** 删除当前文档 */
async function handleDocDelete() {
  const { currentDocument, deleteDocument, tabs, closeTab } = useAppStore.getState();
  if (!currentDocument) {
    await message(i18n.t('menu.openDocFirst'), { title: i18n.t('menu.deleteDocument'), kind: 'warning' });
    return;
  }

  const confirmed = await confirm(
    i18n.t('menu.deleteDocConfirm', { title: currentDocument.title }),
    { title: i18n.t('menu.deleteDocument'), kind: 'warning', okLabel: i18n.t('menu.deleteLabel'), cancelLabel: i18n.t('menu.cancelLabel') }
  );
  if (!confirmed) return;

  try {
    // 先关闭对应标签页
    const tab = tabs.find(t => t.documentId === currentDocument.id);
    if (tab) {
      await closeTab(tab.id, false);
    }
    await deleteDocument(currentDocument.projectId, currentDocument.id);
    await message(i18n.t('menu.docDeleted'), { title: i18n.t('menu.deleteSuccess') });
  } catch (err) {
    await message(i18n.t('menu.docDeleteFailed', { error: formatBackendError(err) }), { title: i18n.t('menu.deleteError'), kind: 'error' });
  }
}

/** 复制当前文档（在同一项目内） */
async function handleDocDuplicate() {
  const { currentDocument, createDocument, openTab } = useAppStore.getState();
  if (!currentDocument) {
    await message(i18n.t('menu.openDocFirst'), { title: i18n.t('menu.duplicateDocument'), kind: 'warning' });
    return;
  }

  try {
    const newDoc = await createDocument(
      currentDocument.projectId,
      `${currentDocument.title} ${i18n.t('menu.duplicateSuffix')}`,
    );
    if (newDoc) {
      // 将源文档内容复制到新文档
      const { saveDocument } = useAppStore.getState();
      await saveDocument({
        ...newDoc,
        content: currentDocument.content,
        authorNotes: currentDocument.authorNotes,
        aiGeneratedContent: currentDocument.aiGeneratedContent,
        composedContent: currentDocument.composedContent,
      });
      await openTab(newDoc.id);
    }
  } catch (err) {
    await message(i18n.t('menu.duplicateFailed', { error: formatBackendError(err) }), { title: i18n.t('menu.duplicateError'), kind: 'error' });
  }
}
