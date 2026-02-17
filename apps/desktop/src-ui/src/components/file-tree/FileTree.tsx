import { useAppStore } from '@/stores/useAppStore';
import { File, Folder, FolderOpen, Plus, Trash2, X, Check, Edit2, Download, FilePlus, Copy, ArrowUpDown, ArrowUp, ArrowDown, GripVertical, ChevronsDownUp, ChevronsUpDown, LayoutTemplate } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { confirm } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '@/i18n';

interface FileTreeProps {
  sidebarOpen?: boolean;
}

type SortField = 'custom' | 'name' | 'createdAt' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

export function FileTree({ sidebarOpen }: FileTreeProps) {
  const { t } = useTranslation();
  const { projects, currentProject, documents, currentDocument, openProject, createProject, deleteProject, renameProject, openTab, renameDocument, deleteDocument, createDocument, loadDocuments, error, isLoading } = useAppStore();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [newProjectNameEdit, setNewProjectNameEdit] = useState('');
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [isCreatingDoc, setIsCreatingDoc] = useState<string | null>(null); // 哪个项目正在创建文档
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [sortField, setSortField] = useState<SortField>('custom');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [projectOrder, setProjectOrder] = useState<string[]>([]);
  const [docOrders, setDocOrders] = useState<Record<string, string[]>>({});

  // 从 localStorage 加载自定义排序
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aidoc-project-order');
      if (saved) setProjectOrder(JSON.parse(saved));
      const savedDoc = localStorage.getItem('aidoc-doc-orders');
      if (savedDoc) setDocOrders(JSON.parse(savedDoc));
    } catch { /* ignore */ }
  }, []);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedProjects = useMemo(() => {
    if (sortField === 'custom') {
      // 按 projectOrder 排序，不在 order 中的排末尾
      const orderMap = new Map(projectOrder.map((id, i) => [id, i]));
      return [...projects].sort((a, b) => {
        const ia = orderMap.get(a.id) ?? Infinity;
        const ib = orderMap.get(b.id) ?? Infinity;
        return ia - ib;
      });
    }
    return [...projects].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, 'zh');
      } else if (sortField === 'createdAt') {
        cmp = a.createdAt - b.createdAt;
      } else {
        cmp = a.updatedAt - b.updatedAt;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [projects, sortField, sortDirection, projectOrder]);

  const sortDocuments = useCallback((docs: typeof documents, projectId?: string) => {
    if (sortField === 'custom' && projectId) {
      const order = docOrders[projectId] || [];
      const orderMap = new Map(order.map((id, i) => [id, i]));
      return [...docs].sort((a, b) => {
        const ia = orderMap.get(a.id) ?? Infinity;
        const ib = orderMap.get(b.id) ?? Infinity;
        return ia - ib;
      });
    }
    return [...docs].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.title.localeCompare(b.title, 'zh');
      } else if (sortField === 'createdAt') {
        cmp = a.metadata.createdAt - b.metadata.createdAt;
      } else {
        cmp = a.metadata.updatedAt - b.metadata.updatedAt;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [sortField, sortDirection, docOrders]);

  // 项目拖动排序结束
  const handleProjectDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentIds = sortedProjects.map(p => p.id);
    const oldIndex = currentIds.indexOf(active.id as string);
    const newIndex = currentIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(currentIds, oldIndex, newIndex);
    setProjectOrder(newOrder);
    localStorage.setItem('aidoc-project-order', JSON.stringify(newOrder));
    setSortField('custom');
  }, [sortedProjects]);

  // 文档拖动排序结束
  const handleDocDragEnd = useCallback((projectId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const projectDocs = sortDocuments(documents.filter(d => d.projectId === projectId), projectId);
    const currentIds = projectDocs.map(d => d.id);
    const oldIndex = currentIds.indexOf(active.id as string);
    const newIndex = currentIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(currentIds, oldIndex, newIndex);
    const updated = { ...docOrders, [projectId]: newOrder };
    setDocOrders(updated);
    localStorage.setItem('aidoc-doc-orders', JSON.stringify(updated));
    setSortField('custom');
  }, [documents, sortDocuments, docOrders]);

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setIsCreating(false);
      setNewProjectName('');
      return;
    }

    try {
      await createProject(newProjectName.trim());
      setIsCreating(false);
      setNewProjectName('');
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewProjectName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateProject();
    } else if (e.key === 'Escape') {
      handleCancelCreate();
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    setIsDeleting(projectId);
    try {
      const confirmed = await confirm(
        t('fileTree.confirmDeleteProject', { name: projectName }),
        { title: t('common.confirm'), kind: 'warning' }
      );
      if (confirmed) {
        await deleteProject(projectId);
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSelectDocument = async (_projectId: string, documentId: string) => {
    const doc = documents.find(d => d.id === documentId);
    if (doc) {
      await openTab(documentId);
    }
  };

  const handleStartRenameProject = (projectId: string, currentName: string) => {
    setRenamingProjectId(projectId);
    setNewProjectNameEdit(currentName);
  };

  const handleSaveRenameProject = async (projectId: string) => {
    const trimmed = newProjectNameEdit.trim();
    if (!trimmed) {
      setRenamingProjectId(null);
      return;
    }
    try {
      await renameProject(projectId, trimmed);
    } catch (err) {
      console.error('Failed to rename project:', err);
    }
    setRenamingProjectId(null);
    setNewProjectNameEdit('');
  };

  const handleDuplicateDocument = async (projectId: string, documentId: string) => {
    const doc = documents.find(d => d.id === documentId);
    if (!doc) return;
    try {
      const newTitle = `${doc.title} (${t('common.copy', { defaultValue: '副本' })})`;
      const newDoc = await createDocument(projectId, newTitle);
      // Copy content to the new document
      if (doc.content || doc.authorNotes || doc.aiGeneratedContent) {
        await invoke('save_document', {
          document: {
            ...newDoc,
            content: doc.content || '',
            authorNotes: doc.authorNotes || '',
            aiGeneratedContent: doc.aiGeneratedContent || '',
          }
        });
        await loadDocuments(projectId);
      }
    } catch (err) {
      console.error('Failed to duplicate document:', err);
    }
  };

  const handleStartRename = (documentId: string, currentTitle: string) => {
    setRenamingDocId(documentId);
    setNewDocTitle(currentTitle);
  };

  const handleCancelRename = () => {
    setRenamingDocId(null);
    setNewDocTitle('');
  };

  const handleCreateDocumentForProject = async (projectId: string) => {
    const trimmedTitle = newDocTitle.trim();
    if (!trimmedTitle) {
      setIsCreatingDoc(null);
      setNewDocTitle('');
      return;
    }

    try {
      const newDoc = await createDocument(projectId, trimmedTitle);
      setIsCreatingDoc(null);
      setNewDocTitle('');
      if (newDoc) {
        await openTab(newDoc.id);
      }
    } catch (err) {
      console.error('Failed to create document:', err);
    }
  };

  const handleSaveRename = async (projectId: string, documentId: string) => {
    const trimmedTitle = newDocTitle.trim();
    if (!trimmedTitle) {
      handleCancelRename();
      return;
    }

    // Check for duplicate title
    const isDuplicate = documents.some(
      d => d.projectId === projectId && d.id !== documentId && d.title === trimmedTitle
    );

    if (isDuplicate) {
      // Could show error message here
      console.error('A document with this title already exists');
      return;
    }

    try {
      await renameDocument(projectId, documentId, trimmedTitle);
      handleCancelRename();
    } catch (err) {
      console.error('Failed to rename document:', err);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, projectId: string, documentId: string) => {
    if (e.key === 'Enter') {
      handleSaveRename(projectId, documentId);
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };


  const handleDeleteDocument = async (projectId: string, documentId: string, documentTitle: string) => {
    const confirmed = await confirm(
      t('fileTree.confirmDeleteDocument', { title: documentTitle }),
      { title: t('common.confirm'), kind: 'warning' }
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDocument(projectId, documentId);
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };



  // 监听系统菜单的"新建项目"事件
  useEffect(() => {
    const handler = () => setIsCreating(true);
    window.addEventListener('menu-new-project', handler);
    return () => window.removeEventListener('menu-new-project', handler);
  }, []);

  // Auto-expand project and highlight current document
  useEffect(() => {
    if (sidebarOpen && currentDocument) {
      if (currentDocument.projectId && !expandedProjects.has(currentDocument.projectId)) {
        setExpandedProjects(prev => new Set([...prev, currentDocument.projectId]));
      }
    }
  }, [sidebarOpen, currentDocument?.id]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    // Check if we have a current project to import to
    if (!currentProject) {
      alert(t('fileTree.needProjectForImport', { defaultValue: 'Please open a project first to import files' }));
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    // Filter for markdown files
    const markdownFiles = Array.from(files).filter(file =>
      file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.type === 'text/markdown'
    );

    if (markdownFiles.length === 0) {
      alert(t('fileTree.noMarkdownFiles', { defaultValue: 'No markdown files found. Please drop .md or .markdown files.' }));
      return;
    }

    try {
      setIsImporting(true);
      let importedCount = 0;

      for (const file of markdownFiles) {
        const content = await file.text();
        const title = file.name.replace(/\.(md|markdown)$/i, '');

        // Create document with the file content
        await createDocument(currentProject.id, title, 'Imported');

        // Find the newly created document and update its content
        const newDoc = documents.find(d => d.projectId === currentProject.id && d.title === title);
        if (newDoc) {
          // We need to save the document with the imported content
          await invoke('save_document', {
            documentId: newDoc.id,
            projectId: currentProject.id,
            title: title,
            content: content,
            authorNotes: '',
            aiGeneratedContent: ''
          });
          importedCount++;
        }
      }

      // Reload documents to show the newly imported ones
      await loadDocuments(currentProject.id);

      alert(t('fileTree.importSuccess', { count: importedCount, defaultValue: `Successfully imported ${importedCount} files` }));
    } catch (err) {
      console.error('Failed to import files:', err);
      alert(t('fileTree.importError', { defaultValue: 'Failed to import files' }));
    } finally {
      setIsImporting(false);
    }
  }, [currentProject, documents, createDocument, loadDocuments, t]);

  return (
    <div
      className={cn(
        "p-2 relative",
        isDraggingOver && "bg-accent"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-end mb-2 px-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpandedProjects(new Set(projects.map(p => p.id)))}
            className="h-6 w-6"
            title={t('fileTree.expandAll', { defaultValue: '展开全部' })}
          >
            <ChevronsUpDown className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpandedProjects(new Set())}
            className="h-6 w-6"
            title={t('fileTree.collapseAll', { defaultValue: '折叠全部' })}
          >
            <ChevronsDownUp className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title={t('fileTree.sort', { defaultValue: '排序' })}
              >
                <ArrowUpDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setSortField('custom')}>
                <span className="flex-1">{t('fileTree.sortCustom', { defaultValue: '自定义（拖动）' })}</span>
                {sortField === 'custom' && <GripVertical className="h-3 w-3 ml-2" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleSort('name')}>
                <span className="flex-1">{t('fileTree.sortByName', { defaultValue: '按名称' })}</span>
                {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-2" /> : <ArrowDown className="h-3 w-3 ml-2" />)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleSort('createdAt')}>
                <span className="flex-1">{t('fileTree.sortByCreated', { defaultValue: '按创建时间' })}</span>
                {sortField === 'createdAt' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-2" /> : <ArrowDown className="h-3 w-3 ml-2" />)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleSort('updatedAt')}>
                <span className="flex-1">{t('fileTree.sortByUpdated', { defaultValue: '按更新时间' })}</span>
                {sortField === 'updatedAt' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-2" /> : <ArrowDown className="h-3 w-3 ml-2" />)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCreating(true)}
            className="h-6 w-6"
            title={t('fileTree.createProject', { defaultValue: '新建项目' })}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-2 px-2 py-1 text-xs text-destructive bg-destructive/10 rounded">
          {error}
        </div>
      )}

      {/* Create Project Input */}
      {isCreating && (
        <div className="mb-2 px-2">
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('fileTree.newProject', { defaultValue: '项目名称...' })}
              className="flex-1 px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCreateProject}
              className="h-6 w-6"
              disabled={isLoading || !newProjectName.trim()}
              title={t('common.confirm')}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancelCreate}
              className="h-6 w-6"
              title={t('common.cancel')}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Projects List */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
      <SortableContext items={sortedProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
      <div className="space-y-1">
        {sortedProjects.map(project => {
          const isExpanded = expandedProjects.has(project.id);
          const isActive = currentProject?.id === project.id;
          const projectDocuments = sortDocuments(documents.filter(d => d.projectId === project.id), project.id);

          return (
            <SortableItem key={project.id} id={project.id} disabled={sortField !== 'custom'} showHandle={sortField === 'custom'}>
              {/* Project Node */}
              <div
                className={cn(
                  "flex items-center gap-1 px-1 py-1.5 rounded-md cursor-pointer group hover:bg-accent",
                  isActive && "bg-primary/10 border-l-2 border-primary"
                )}
                onClick={() => {
                  if (renamingProjectId !== project.id) {
                    if (isActive) {
                      // 已选中，展开/收缩
                      toggleProject(project.id);
                    } else {
                      // 未选中，先选中项目
                      openProject(project.id);
                    }
                  }
                }}
              >
                <div className="h-5 w-5 flex items-center justify-center">
                  {isExpanded ? (
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Folder className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {renamingProjectId === project.id ? (
                  <input
                    type="text"
                    value={newProjectNameEdit}
                    onChange={(e) => setNewProjectNameEdit(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRenameProject(project.id);
                      else if (e.key === 'Escape') { setRenamingProjectId(null); setNewProjectNameEdit(''); }
                    }}
                    onBlur={() => handleSaveRenameProject(project.id)}
                    className="flex-1 px-1 py-0.5 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                ) : (
                  <>
                    <span
                      className="flex-1 text-sm truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleStartRenameProject(project.id, project.name);
                      }}
                    >
                      {project.name}
                    </span>
                    <span className="text-xs text-muted-foreground mr-1">
                      {projectDocuments.length}
                    </span>
                  </>
                )}

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRenameProject(project.id, project.name);
                    }}
                    className="h-6 w-6 p-0"
                    title={t('fileTree.renameProject', { defaultValue: '重命名项目' })}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isExpanded) {
                        toggleProject(project.id);
                        openProject(project.id);
                      }
                      setIsCreatingDoc(project.id);
                    }}
                    className="h-6 w-6 p-0"
                    title={t('fileTree.newDocument')}
                  >
                    <FilePlus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isExpanded) {
                        toggleProject(project.id);
                        openProject(project.id);
                      }
                      window.dispatchEvent(new CustomEvent('menu-new-from-template'));
                    }}
                    className="h-6 w-6 p-0"
                    title={t('fileTree.newFromTemplate', { defaultValue: '从模板新建' })}
                  >
                    <LayoutTemplate className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id, project.name);
                    }}
                    className="h-6 w-6 p-0 hover:bg-destructive/10"
                    disabled={isDeleting === project.id}
                    title={t('fileTree.deleteProject')}
                  >
                    {isDeleting === project.id ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                    ) : (
                      <Trash2 className="h-3 w-3 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Documents */}
              {isExpanded && (
                <div className="ml-2">
                  {projectDocuments.length > 0 ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDocDragEnd(project.id)}>
                    <SortableContext items={projectDocuments.map(d => d.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-0.5">
                      {projectDocuments.map(doc => {
                        const isRenaming = renamingDocId === doc.id;
                        const isCurrent = currentDocument?.id === doc.id;
                        return (
                          <SortableItem key={doc.id} id={doc.id} disabled={sortField !== 'custom'} showHandle={sortField === 'custom'}>
                          <div
                            id={isCurrent ? `current-doc-${doc.id}` : undefined}
                            className={cn(
                              "flex items-center gap-1 px-1 py-1 rounded-md group hover:bg-accent cursor-pointer",
                              isCurrent && "bg-accent font-medium",
                              isCurrent && "bg-red-500/10 text-red-600 dark:text-red-400"
                            )}
                            onClick={() => handleSelectDocument(project.id, doc.id)}
                            title={doc.title}
                          >
                            <File className="h-3 w-3 text-muted-foreground ml-1" />

                            {isRenaming ? (
                              <div className="flex-1 flex items-center gap-1">
                                <input
                                  type="text"
                                  value={newDocTitle}
                                  onChange={(e) => setNewDocTitle(e.target.value)}
                                  onKeyDown={(e) => handleRenameKeyDown(e, project.id, doc.id)}
                                  onBlur={() => handleSaveRename(project.id, doc.id)}
                                  className="flex-1 px-1 py-0.5 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  spellCheck={false}
                                  autoCorrect="off"
                                  autoCapitalize="off"
                                />
                              </div>
                            ) : (
                              <>
                                <span
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleStartRename(doc.id, doc.title);
                                  }}
                                  className="flex-1 text-sm truncate"
                                >
                                  {doc.title}
                                </span>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartRename(doc.id, doc.title);
                                    }}
                                    className="h-6 w-6 p-0"
                                    title={t('fileTree.renameDocument')}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDuplicateDocument(project.id, doc.id);
                                    }}
                                    className="h-6 w-6 p-0"
                                    title={t('fileTree.duplicateDocument', { defaultValue: '复制文档' })}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteDocument(project.id, doc.id, doc.title);
                                    }}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title={t('fileTree.deleteDocument')}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                          </SortableItem>
                        );
                      })}
                    </div>
                    </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      {t('fileTree.noDocuments')}
                    </div>
                  )}

                  {/* Create Document Input */}
                  {isCreatingDoc === project.id && (
                    <div className="ml-5 mt-1 flex items-center gap-1">
                      <input
                        type="text"
                        value={newDocTitle}
                        onChange={(e) => setNewDocTitle(e.target.value)}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            handleCreateDocumentForProject(project.id);
                          } else if (e.key === 'Escape') {
                            e.stopPropagation();
                            setIsCreatingDoc(null);
                            setNewDocTitle('');
                          }
                        }}
                        placeholder={t('fileTree.newDocument', { defaultValue: '文档标题...' })}
                        className="flex-1 px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateDocumentForProject(project.id);
                        }}
                        disabled={!newDocTitle.trim()}
                        className="h-5 w-5 p-0"
                        title={t('common.confirm')}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCreatingDoc(null);
                          setNewDocTitle('');
                        }}
                        className="h-5 w-5 p-0"
                        title={t('common.cancel')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </SortableItem>
          );
        })}
      </div>
      </SortableContext>
      </DndContext>

        {/* Empty State */}
        {projects.length === 0 && !isCreating && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t('fileTree.noProjects')}
          </div>
        )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="px-2 py-1 text-xs text-muted-foreground">
          {t('common.loading')}
        </div>
      )}

      {/* Drag Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <Download className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium text-primary">
              {t('fileTree.dropToImport', { defaultValue: 'Drop markdown files to import' })}
            </p>
          </div>
        </div>
      )}

      {/* Importing Indicator */}
      {isImporting && (
        <div className="absolute inset-0 bg-background flex items-center justify-center z-20">
          <div className="text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('fileTree.importing', { defaultValue: 'Importing files...' })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
