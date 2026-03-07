import { useState, useRef, useCallback } from 'react';
import {
  Button, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../../_framework/ui';
import { Plus, Trash2, Bold, Italic, Underline, Link, Type } from 'lucide-react';
import { useEmailContext } from '../EmailContext';
import type { EmailSignature } from '../types';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function execCmd(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

function RichEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  const handleInput = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleInsertLink = useCallback(() => {
    const url = prompt('URL:');
    if (url) execCmd('createLink', url);
  }, []);

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex items-center gap-0.5 px-1 py-0.5 border-b bg-muted/30">
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" title="Bold" onClick={() => execCmd('bold')}><Bold className="h-3 w-3" /></Button>
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" title="Italic" onClick={() => execCmd('italic')}><Italic className="h-3 w-3" /></Button>
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" title="Underline" onClick={() => execCmd('underline')}><Underline className="h-3 w-3" /></Button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" title="Link" onClick={handleInsertLink}><Link className="h-3 w-3" /></Button>
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" title="Clear" onClick={() => execCmd('removeFormat')}><Type className="h-3 w-3" /></Button>
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        className="w-full h-24 px-3 py-2 text-sm bg-background overflow-y-auto outline-none"
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}

export function SignatureDialog({ open, onOpenChange }: SignatureDialogProps) {
  const { state, dispatch, saveToStorage, showStatus, t } = useEmailContext();
  const { signatures, activeSignatureId } = state;

  const [editingSignature, setEditingSignature] = useState<EmailSignature | null>(null);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setEditingSignature(null); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[70vh] overflow-y-auto" style={DIALOG_STYLE}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{t('manageSignatures')}</DialogTitle>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
              onClick={() => setEditingSignature({ id: `sig_${Date.now()}`, name: '', content: '' })}>
              <Plus className="h-3 w-3" />
              {t('newSignature')}
            </Button>
          </div>
          <DialogDescription>{t('signatureDesc')}</DialogDescription>
        </DialogHeader>

        {editingSignature && (
          <div className="border rounded-md p-3 space-y-2 bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs">{t('signatureName')}</Label>
              <Input value={editingSignature.name}
                onChange={e => setEditingSignature({ ...editingSignature, name: e.target.value })}
                placeholder={t('signatureNamePlaceholder')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('signatureContent')}</Label>
              <RichEditor content={editingSignature.content}
                onChange={(html) => setEditingSignature({ ...editingSignature, content: html })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingSignature(null)}>{t('cancel')}</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs"
                disabled={!editingSignature.name.trim() || !editingSignature.content.trim()}
                onClick={() => {
                  const idx = signatures.findIndex(s => s.id === editingSignature.id);
                  const updated = idx >= 0
                    ? signatures.map(s => s.id === editingSignature.id ? editingSignature : s)
                    : [...signatures, editingSignature];
                  dispatch({ type: 'SET_SIGNATURES', signatures: updated });
                  saveToStorage({ signatures: updated });
                  setEditingSignature(null);
                  showStatus(t('signatureSaved'));
                }}>
                {t('save')}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {signatures.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">{t('noSignaturesYet')}</p>
          ) : signatures.map(sig => (
            <div key={sig.id} className={`flex items-start gap-2 p-2 rounded border text-sm ${sig.id === activeSignatureId ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50 border-transparent'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{sig.name}</span>
                  {sig.id === activeSignatureId && <span className="text-xs text-primary">{t('signatureActive')}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2" dangerouslySetInnerHTML={{ __html: sig.content }} />
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {sig.id !== activeSignatureId && (
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs"
                    onClick={() => { dispatch({ type: 'SET_ACTIVE_SIGNATURE', id: sig.id }); saveToStorage({ activeSignatureId: sig.id }); }}>
                    {t('signatureUse')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs"
                  onClick={() => setEditingSignature({ ...sig })}>
                  {t('edit')}
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    const updated = signatures.filter(s => s.id !== sig.id);
                    dispatch({ type: 'SET_SIGNATURES', signatures: updated });
                    if (activeSignatureId === sig.id) { dispatch({ type: 'SET_ACTIVE_SIGNATURE', id: '' }); saveToStorage({ signatures: updated, activeSignatureId: '' }); }
                    else saveToStorage({ signatures: updated });
                  }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
