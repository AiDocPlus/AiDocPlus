import { useState } from 'react';
import {
  Button, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../../_framework/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useEmailContext } from '../EmailContext';
import type { SavedSubject, EmailStorageData } from '../types';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

interface SubjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubjectDialog({ open, onOpenChange }: SubjectDialogProps) {
  const { state, dispatch, saveToStorage, showStatus, t, host } = useEmailContext();
  const { subject } = state;

  const [newSubjectText, setNewSubjectText] = useState('');

  const setSubject = (v: string) => { dispatch({ type: 'SET_FIELD', field: 'subject', value: v }); saveToStorage({ subject: v }); };

  const stored = host.storage.get<EmailStorageData>('emailData') || {};
  const subjects = stored.savedSubjects || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[70vh] overflow-y-auto" style={DIALOG_STYLE}>
        <DialogHeader>
          <DialogTitle>{t('subjectManage')}</DialogTitle>
          <DialogDescription>{t('subjectManageDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {/* 当前主题 + 保存按钮 */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('currentSubject')}</Label>
            <div className="flex gap-2">
              <Input value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('subjectPlaceholder')} className="text-sm flex-1" />
              {subject.trim() && (
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1 flex-shrink-0"
                  onClick={() => {
                    const item: SavedSubject = { id: `sj_${Date.now()}`, text: subject.trim() };
                    saveToStorage({ savedSubjects: [...subjects, item] });
                    showStatus(t('subjectSaved'));
                  }}>
                  <Plus className="h-3 w-3" />
                  {t('save')}
                </Button>
              )}
            </div>
          </div>
          {/* 新增主题 */}
          <div className="flex gap-2 items-center">
            <Input value={newSubjectText} onChange={e => setNewSubjectText(e.target.value)}
              placeholder={t('newSubjectPlaceholder')} className="text-sm flex-1" />
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-shrink-0"
              disabled={!newSubjectText.trim()}
              onClick={() => {
                const item: SavedSubject = { id: `sj_${Date.now()}`, text: newSubjectText.trim() };
                saveToStorage({ savedSubjects: [...subjects, item] });
                setNewSubjectText('');
                showStatus(t('subjectSaved'));
              }}>
              <Plus className="h-3 w-3" />
              {t('addSubject')}
            </Button>
          </div>
          {/* 已保存的主题列表 */}
          {subjects.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('savedSubjects')}</Label>
              {subjects.map(s => (
                <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-sm">
                  <button className="flex-1 min-w-0 text-left truncate" onClick={() => {
                    setSubject(s.text);
                    onOpenChange(false);
                  }}>
                    {s.text}
                  </button>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-destructive hover:text-destructive flex-shrink-0"
                    onClick={() => {
                      const updated = subjects.filter(x => x.id !== s.id);
                      saveToStorage({ savedSubjects: updated });
                      showStatus(t('deleted'));
                    }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">{t('noSavedSubjects')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
