/// <reference types="vitest/globals" />

import {
  ensureDocumentConsistency,
  mergeDocumentsById,
  replaceDocumentsForProject,
  mergeDocumentsIntoState,
  replaceProjectDocumentsInState,
  replaceProjectsDocumentsInState,
  applyDocumentUpdate,
  replaceDocumentInState,
  removeDocumentFromState,
  replaceProjectInState,
  removeProjectFromState,
} from '../useAppStore.document.helpers'
import type { Document, Project } from '@aidocplus/shared-types'

function makeDoc(id: string, projectId = 'p1', title = `Doc ${id}`): Document {
  return { id, title, content: `content of ${id}`, projectId } as Document
}

function makeProject(id: string, name = `Project ${id}`): Project {
  return { id, name } as Project
}

// ── ensureDocumentConsistency ──

describe('ensureDocumentConsistency', () => {
  it('currentDocument 在列表中则保持不变', () => {
    const doc = makeDoc('d1')
    const result = ensureDocumentConsistency([doc], doc)
    expect(result.currentDocument).toBe(doc)
  })

  it('currentDocument 不在列表中重置为 null', () => {
    const doc = makeDoc('d1')
    const other = makeDoc('d2')
    const result = ensureDocumentConsistency([other], doc)
    expect(result.currentDocument).toBeNull()
  })

  it('currentDocument 为 null 保持 null', () => {
    const result = ensureDocumentConsistency([makeDoc('d1')], null)
    expect(result.currentDocument).toBeNull()
  })

  it('currentDocument 引用与列表不同步时同步', () => {
    const docInList = makeDoc('d1', 'p1', '新标题')
    const staleDoc = makeDoc('d1', 'p1', '旧标题')
    const result = ensureDocumentConsistency([docInList], staleDoc)
    expect(result.currentDocument).toBe(docInList)
    expect(result.currentDocument!.title).toBe('新标题')
  })
})

// ── mergeDocumentsById ──

describe('mergeDocumentsById', () => {
  it('合并不重复的文档', () => {
    const a = [makeDoc('d1')]
    const b = [makeDoc('d2')]
    const result = mergeDocumentsById(a, b)
    expect(result).toHaveLength(2)
  })

  it('incoming 覆盖 existing 同 id 文档', () => {
    const old = makeDoc('d1', 'p1', '旧')
    const newer = makeDoc('d1', 'p1', '新')
    const result = mergeDocumentsById([old], [newer])
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('新')
  })

  it('空输入返回空数组', () => {
    expect(mergeDocumentsById([], [])).toHaveLength(0)
  })
})

// ── replaceDocumentsForProject ──

describe('replaceDocumentsForProject', () => {
  it('替换指定项目的文档，保留其他项目', () => {
    const existing = [makeDoc('d1', 'p1'), makeDoc('d2', 'p2')]
    const newP1Docs = [makeDoc('d3', 'p1')]
    const result = replaceDocumentsForProject(existing, 'p1', newP1Docs)
    expect(result.find(d => d.id === 'd1')).toBeUndefined() // p1 旧文档被移除
    expect(result.find(d => d.id === 'd2')).toBeDefined()   // p2 保留
    expect(result.find(d => d.id === 'd3')).toBeDefined()   // p1 新文档
  })
})

// ── mergeDocumentsIntoState ──

describe('mergeDocumentsIntoState', () => {
  it('合并文档并保持 currentDocument 一致性', () => {
    const doc1 = makeDoc('d1')
    const state = { documents: [doc1], currentDocument: doc1 }
    const updatedDoc1 = makeDoc('d1', 'p1', '更新后')
    const result = mergeDocumentsIntoState(state, [updatedDoc1])
    expect(result.documents).toHaveLength(1)
    expect(result.currentDocument!.title).toBe('更新后')
  })
})

// ── replaceProjectDocumentsInState ──

describe('replaceProjectDocumentsInState', () => {
  it('替换项目文档后 currentDocument 仍有效', () => {
    const doc1 = makeDoc('d1', 'p1')
    const doc2 = makeDoc('d2', 'p2')
    const state = { documents: [doc1, doc2], currentDocument: doc2 }
    const result = replaceProjectDocumentsInState(state, 'p1', [makeDoc('d3', 'p1')])
    expect(result.currentDocument!.id).toBe('d2') // p2 文档不受影响
    expect(result.documents.find(d => d.id === 'd1')).toBeUndefined()
    expect(result.documents.find(d => d.id === 'd3')).toBeDefined()
  })
})

// ── replaceProjectsDocumentsInState ──

describe('replaceProjectsDocumentsInState', () => {
  it('批量替换多个项目的文档', () => {
    const state = {
      documents: [makeDoc('d1', 'p1'), makeDoc('d2', 'p2')],
      currentDocument: null,
    }
    const result = replaceProjectsDocumentsInState(state, [
      { projectId: 'p1', documents: [makeDoc('d3', 'p1')] },
      { projectId: 'p2', documents: [makeDoc('d4', 'p2')] },
    ])
    expect(result.documents).toHaveLength(2)
    expect(result.documents.map(d => d.id).sort()).toEqual(['d3', 'd4'])
  })
})

// ── applyDocumentUpdate ──

describe('applyDocumentUpdate', () => {
  it('更新文档列表和 currentDocument', () => {
    const doc = makeDoc('d1', 'p1', '旧')
    const result = applyDocumentUpdate([doc], doc, 'd1', d => ({ ...d, title: '新' }))
    expect(result.documents[0].title).toBe('新')
    expect(result.currentDocument!.title).toBe('新')
  })

  it('更新非当前文档不影响 currentDocument', () => {
    const doc1 = makeDoc('d1')
    const doc2 = makeDoc('d2')
    const result = applyDocumentUpdate([doc1, doc2], doc1, 'd2', d => ({ ...d, title: '改' }))
    expect(result.currentDocument!.id).toBe('d1')
    expect(result.documents.find(d => d.id === 'd2')!.title).toBe('改')
  })
})

// ── replaceDocumentInState ──

describe('replaceDocumentInState', () => {
  it('替换文档', () => {
    const doc = makeDoc('d1', 'p1', '旧')
    const state = { documents: [doc], currentDocument: doc }
    const newDoc = makeDoc('d1', 'p1', '新')
    const result = replaceDocumentInState(state, newDoc)
    expect(result.documents[0].title).toBe('新')
  })
})

// ── removeDocumentFromState ──

describe('removeDocumentFromState', () => {
  it('删除文档', () => {
    const doc1 = makeDoc('d1')
    const doc2 = makeDoc('d2')
    const state = { documents: [doc1, doc2], currentDocument: doc1 }
    const result = removeDocumentFromState(state, 'd1')
    expect(result.documents).toHaveLength(1)
    expect(result.currentDocument).toBeNull()
  })

  it('删除非当前文档不影响 currentDocument', () => {
    const doc1 = makeDoc('d1')
    const doc2 = makeDoc('d2')
    const state = { documents: [doc1, doc2], currentDocument: doc1 }
    const result = removeDocumentFromState(state, 'd2')
    expect(result.documents).toHaveLength(1)
    expect(result.currentDocument!.id).toBe('d1')
  })
})

// ── replaceProjectInState ──

describe('replaceProjectInState', () => {
  it('替换项目', () => {
    const p1 = makeProject('p1', '旧')
    const state = { projects: [p1], currentProject: p1 }
    const newP1 = makeProject('p1', '新')
    const result = replaceProjectInState(state, newP1)
    expect(result.projects[0].name).toBe('新')
    expect(result.currentProject!.name).toBe('新')
  })

  it('替换非当前项目不影响 currentProject', () => {
    const p1 = makeProject('p1')
    const p2 = makeProject('p2')
    const state = { projects: [p1, p2], currentProject: p1 }
    const result = replaceProjectInState(state, makeProject('p2', '改'))
    expect(result.currentProject!.id).toBe('p1')
  })
})

// ── removeProjectFromState ──

describe('removeProjectFromState', () => {
  it('删除当前项目重置 currentProject', () => {
    const p1 = makeProject('p1')
    const state = { projects: [p1], currentProject: p1 }
    const result = removeProjectFromState(state, 'p1')
    expect(result.projects).toHaveLength(0)
    expect(result.currentProject).toBeNull()
  })

  it('删除非当前项目不影响 currentProject', () => {
    const p1 = makeProject('p1')
    const p2 = makeProject('p2')
    const state = { projects: [p1, p2], currentProject: p1 }
    const result = removeProjectFromState(state, 'p2')
    expect(result.projects).toHaveLength(1)
    expect(result.currentProject!.id).toBe('p1')
  })
})
