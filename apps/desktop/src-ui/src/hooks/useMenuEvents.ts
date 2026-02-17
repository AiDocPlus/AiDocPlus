import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open, save, message, confirm } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '@/stores/useAppStore';
import i18n from '@/i18n';

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
          window.dispatchEvent(new CustomEvent('menu-new-project'));
          break;
        case 'new_document':
          window.dispatchEvent(new CustomEvent('editor-new-document'));
          break;
        case 'save':
          window.dispatchEvent(new CustomEvent('save-active-tab'));
          break;
        case 'save_all':
          window.dispatchEvent(new CustomEvent('save-all-tabs'));
          break;
        case 'import_file':
          window.dispatchEvent(new CustomEvent('menu-import-file'));
          break;
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

        // ── 编辑菜单（剪切/复制/粘贴/撤销/重做/全选由 Tauri PredefinedMenuItem 原生处理）──
        case 'find':
          window.dispatchEvent(new CustomEvent('open-search'));
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

        // ── 项目管理 ──
        case 'project_rename':
          await handleProjectRename();
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
          await handleDocRename();
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
        case 'about':
          window.dispatchEvent(new CustomEvent('menu-about'));
          break;

        default:
          console.log('[MenuEvent] 未处理的菜单事件:', menuId);
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
    await message(i18n.t('menu.exportFailed', { error: String(err) }), { title: i18n.t('menu.exportError'), kind: 'error' });
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
    await message(i18n.t('menu.importFailed', { error: String(err) }), { title: i18n.t('menu.importError'), kind: 'error' });
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
    await message(i18n.t('menu.backupFailed', { error: String(err) }), { title: i18n.t('menu.backupError'), kind: 'error' });
  }
}

/** 重命名当前项目 */
async function handleProjectRename() {
  const { currentProject, renameProject, loadProjects } = useAppStore.getState();
  if (!currentProject) {
    await message(i18n.t('menu.openProjectFirst'), { title: i18n.t('menu.renameProject'), kind: 'warning' });
    return;
  }

  const newName = window.prompt(i18n.t('menu.renameProjectPrompt'), currentProject.name);
  if (!newName || newName.trim() === '' || newName.trim() === currentProject.name) return;

  try {
    await renameProject(currentProject.id, newName.trim());
    await loadProjects();
    await message(i18n.t('menu.projectRenamed', { name: newName.trim() }), { title: i18n.t('menu.renameSuccess') });
  } catch (err) {
    await message(i18n.t('menu.renameFailed', { error: String(err) }), { title: i18n.t('menu.renameError'), kind: 'error' });
  }
}

/** 删除当前项目 */
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
    await message(i18n.t('menu.deleteFailed', { error: String(err) }), { title: i18n.t('menu.deleteError'), kind: 'error' });
  }
}

/** 重命名当前文档 */
async function handleDocRename() {
  const { currentDocument, renameDocument } = useAppStore.getState();
  if (!currentDocument) {
    await message(i18n.t('menu.openDocFirst'), { title: i18n.t('menu.renameDocument'), kind: 'warning' });
    return;
  }

  const newTitle = window.prompt(i18n.t('menu.renameDocPrompt'), currentDocument.title);
  if (!newTitle || newTitle.trim() === '' || newTitle.trim() === currentDocument.title) return;

  try {
    await renameDocument(currentDocument.projectId, currentDocument.id, newTitle.trim());
    await message(i18n.t('menu.docRenamed', { title: newTitle.trim() }), { title: i18n.t('menu.renameSuccess') });
  } catch (err) {
    await message(i18n.t('menu.docRenameFailed', { error: String(err) }), { title: i18n.t('menu.renameError'), kind: 'error' });
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
    await message(i18n.t('menu.docDeleteFailed', { error: String(err) }), { title: i18n.t('menu.deleteError'), kind: 'error' });
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
    await message(i18n.t('menu.duplicateFailed', { error: String(err) }), { title: i18n.t('menu.duplicateError'), kind: 'error' });
  }
}
