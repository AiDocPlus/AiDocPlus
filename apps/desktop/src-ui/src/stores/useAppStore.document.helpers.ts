import type { Document, Project } from '@aidocplus/shared-types';

export interface DocumentStateSlice {
  documents: Document[];
  currentDocument: Document | null;
}

export interface ProjectStateSlice {
  projects: Project[];
  currentProject: Project | null;
}

export function ensureDocumentConsistency(
  documents: Document[],
  currentDocument: Document | null
): DocumentStateSlice {
  if (currentDocument) {
    const existsInList = documents.some(d => d.id === currentDocument.id);
    if (!existsInList) {
      console.warn('[Consistency] currentDocument not found in documents list, resetting to null');
      return { documents, currentDocument: null };
    }
    const syncedDoc = documents.find(d => d.id === currentDocument.id);
    if (syncedDoc && syncedDoc !== currentDocument) {
      return { documents, currentDocument: syncedDoc };
    }
  }
  return { documents, currentDocument };
}

export function mergeDocumentsById(existingDocuments: Document[], incomingDocuments: Document[]): Document[] {
  const merged = new Map(existingDocuments.map(doc => [doc.id, doc]));
  for (const doc of incomingDocuments) {
    merged.set(doc.id, doc);
  }
  return [...merged.values()];
}

export function replaceDocumentsForProject(existingDocuments: Document[], projectId: string, projectDocuments: Document[]): Document[] {
  const otherDocuments = existingDocuments.filter(d => d.projectId !== projectId);
  return mergeDocumentsById(otherDocuments, projectDocuments);
}

export function mergeDocumentsIntoState(
  state: DocumentStateSlice,
  incomingDocuments: Document[]
): DocumentStateSlice {
  const mergedDocuments = mergeDocumentsById(state.documents, incomingDocuments);
  return ensureDocumentConsistency(mergedDocuments, state.currentDocument);
}

export function replaceProjectDocumentsInState(
  state: DocumentStateSlice,
  projectId: string,
  projectDocuments: Document[]
): DocumentStateSlice {
  const mergedDocuments = replaceDocumentsForProject(state.documents, projectId, projectDocuments);
  return ensureDocumentConsistency(mergedDocuments, state.currentDocument);
}

export function replaceProjectsDocumentsInState(
  state: DocumentStateSlice,
  projectDocumentsList: Array<{ projectId: string; documents: Document[] }>
): DocumentStateSlice {
  const mergedDocuments = projectDocumentsList.reduce(
    (documents, item) => replaceDocumentsForProject(documents, item.projectId, item.documents),
    state.documents,
  );
  return ensureDocumentConsistency(mergedDocuments, state.currentDocument);
}

export function applyDocumentUpdate(
  documents: Document[],
  currentDocument: Document | null,
  documentId: string,
  updater: (doc: Document) => Document
): DocumentStateSlice {
  const updatedDocuments = documents.map(d =>
    d.id === documentId ? updater(d) : d
  );
  const updatedCurrentDocument = currentDocument?.id === documentId
    ? updater(currentDocument)
    : currentDocument;
  return ensureDocumentConsistency(updatedDocuments, updatedCurrentDocument);
}

export function replaceDocumentInState(
  state: DocumentStateSlice,
  document: Document
): DocumentStateSlice {
  return applyDocumentUpdate(state.documents, state.currentDocument, document.id, () => document);
}

export function removeDocumentFromState(
  state: DocumentStateSlice,
  documentId: string
): DocumentStateSlice {
  const filteredDocuments = state.documents.filter(d => d.id !== documentId);
  const nextCurrentDocument = state.currentDocument?.id === documentId ? null : state.currentDocument;
  return ensureDocumentConsistency(filteredDocuments, nextCurrentDocument);
}

export function replaceProjectInState(
  state: ProjectStateSlice,
  project: Project
): ProjectStateSlice {
  return {
    projects: state.projects.map(p => p.id === project.id ? project : p),
    currentProject: state.currentProject?.id === project.id ? project : state.currentProject,
  };
}

export function removeProjectFromState(
  state: ProjectStateSlice,
  projectId: string
): ProjectStateSlice {
  return {
    projects: state.projects.filter(p => p.id !== projectId),
    currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
  };
}
