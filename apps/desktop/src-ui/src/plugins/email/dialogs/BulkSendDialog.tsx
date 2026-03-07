// ── 群发单送向导对话框（三步：收件人 → 模板/内容 → 确认） ──

import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, ScrollArea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../_framework/ui';
import { Users, ChevronLeft, ChevronRight, Send, X, Check, AlertCircle, FileText, Paperclip } from 'lucide-react';
import type {
  EmailAccount, BulkSendJob, BulkRecipient, SubmissionTemplate,
  Contact, ContactGroup, AttachmentItem,
} from '../types';
import { isValidEmail, formatFileSize } from '../utils';

interface BulkSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: EmailAccount[];
  selectedAccountId: string;
  contacts: Contact[];
  contactGroups: ContactGroup[];
  templates: SubmissionTemplate[];
  attachments: AttachmentItem[];
  signatures: { id: string; name: string }[];
  activeSignatureId: string;
  /** 当前邮件表单的主题和正文 */
  currentSubject: string;
  currentBody: string;
  /** 当前邮件格式 */
  currentFormat?: 'html' | 'text';
  /** 当前收件人栏（用于预填充） */
  currentRecipients?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onCreateJob: (job: BulkSendJob) => void;
}

type ContentSource = 'editor' | 'template';

type Step = 1 | 2 | 3;

export function BulkSendDialog({
  open, onOpenChange, accounts, selectedAccountId, contacts, contactGroups,
  templates, attachments, signatures, activeSignatureId,
  currentSubject, currentBody, currentFormat, currentRecipients,
  t, onCreateJob,
}: BulkSendDialogProps) {
  const [step, setStep] = useState<Step>(1);

  // Step 1: 收件人选择
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectedGroupId, setSelectedGroupId] = useState<string>('__all__');
  const [manualEmails, setManualEmails] = useState('');
  const [jobName, setJobName] = useState('');

  // Step 2: 内容设置
  const [contentSource, setContentSource] = useState<ContentSource>('editor');
  const [accountId, setAccountId] = useState(selectedAccountId);
  const [autoMatchAccount, setAutoMatchAccount] = useState(true);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string>('__none__');
  const [defaultSubject, setDefaultSubject] = useState(currentSubject);
  const [defaultBody, setDefaultBody] = useState(currentBody);
  const [signatureId, setSignatureId] = useState(activeSignatureId || '__no_sig__');

  // 编辑器内容摘要
  const editorBodySnippet = useMemo(() => {
    const plain = currentBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return plain.length > 120 ? plain.slice(0, 120) + '…' : plain;
  }, [currentBody]);
  const editorHasContent = !!(currentSubject.trim() || currentBody.trim());
  const activeSignatureName = signatures.find(s => s.id === activeSignatureId)?.name;

  // 收件人列表计算
  const recipientList = useMemo((): BulkRecipient[] => {
    const map = new Map<string, BulkRecipient>();

    // 从已选联系人
    for (const cid of selectedContactIds) {
      const c = contacts.find(ct => ct.id === cid);
      if (c && isValidEmail(c.email)) {
        map.set(c.email.toLowerCase(), {
          email: c.email,
          name: c.name,
          contactId: c.id,
          status: 'pending',
        });
      }
    }

    // 从手动输入
    const manual = manualEmails.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    for (const email of manual) {
      if (isValidEmail(email) && !map.has(email.toLowerCase())) {
        map.set(email.toLowerCase(), { email, status: 'pending' });
      }
    }

    return Array.from(map.values());
  }, [selectedContactIds, manualEmails, contacts]);

  // 按分组过滤联系人
  const filteredContacts = useMemo(() => {
    if (selectedGroupId === '__all__') return contacts;
    return contacts.filter(c => c.groupId === selectedGroupId);
  }, [contacts, selectedGroupId]);

  const toggleContact = (id: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      for (const c of filteredContacts) {
        if (isValidEmail(c.email)) next.add(c.id);
      }
      return next;
    });
  };

  const deselectAll = () => setSelectedContactIds(new Set());

  // 预填充：打开时从主编辑器收件人栏导入
  const prefillDone = useMemo(() => ({ done: false }), []);
  if (open && !prefillDone.done && currentRecipients) {
    prefillDone.done = true;
    const existing = manualEmails.trim();
    if (!existing) {
      setManualEmails(currentRecipients);
    }
  }
  if (!open && prefillDone.done) {
    prefillDone.done = false;
  }

  // 验证
  const step1Valid = recipientList.length > 0;
  const step2Valid = contentSource === 'editor'
    ? (accountId && editorHasContent)
    : (accountId && (defaultTemplateId !== '__none__' || (defaultSubject.trim() && defaultBody.trim())));

  const handleCreate = () => {
    const now = Date.now();
    const useEditor = contentSource === 'editor';
    const job: BulkSendJob = {
      id: `bulk_${now}_${Math.random().toString(36).slice(2, 6)}`,
      name: jobName.trim() || `群发任务 ${new Date().toLocaleDateString()}`,
      accountId,
      autoMatchAccount,
      defaultTemplateId: !useEditor && defaultTemplateId !== '__none__' ? defaultTemplateId : undefined,
      defaultSubject: useEditor ? currentSubject : (defaultSubject || currentSubject),
      defaultBody: useEditor ? currentBody : (defaultBody || currentBody),
      recipients: recipientList,
      attachments: attachments.length > 0 ? attachments : undefined,
      signatureId: useEditor
        ? (activeSignatureId || undefined)
        : (signatureId !== '__no_sig__' ? signatureId : undefined),
      status: 'draft',
      progress: { total: recipientList.length, sent: 0, failed: 0 },
      createdAt: now,
    };
    onCreateJob(job);
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setStep(1);
    setSelectedContactIds(new Set());
    setSelectedGroupId('__all__');
    setManualEmails('');
    setJobName('');
    setContentSource('editor');
    setDefaultTemplateId('__none__');
    setDefaultSubject(currentSubject);
    setDefaultBody(currentBody);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            {t('bulkSendWizard')} — {t(`bulkStep${step}`)}
          </DialogTitle>
        </DialogHeader>

        {/* 步骤指示器 */}
        <div className="flex items-center gap-1 px-1 mb-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                s === step ? 'bg-primary text-primary-foreground' :
                s < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>{s < step ? <Check className="w-3 h-3" /> : s}</div>
              {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-primary/40' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: 收件人 */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('bulkJobName')}</Label>
                <Input value={jobName} onChange={e => setJobName(e.target.value)}
                  placeholder={t('bulkJobNamePlaceholder')} className="h-8 text-xs" />
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs shrink-0">{t('contactGroup')}</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder={t('allContacts')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t('allContacts')}</SelectItem>
                    {contactGroups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllVisible}>
                  {t('selectAll')}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAll}>
                  {t('deselectAll')}
                </Button>
              </div>

              <ScrollArea className="h-[200px] border rounded-md p-2">
                {filteredContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{t('noContacts')}</p>
                ) : (
                  <div className="space-y-0.5">
                    {filteredContacts.map(c => (
                      <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer text-xs">
                        <input type="checkbox" checked={selectedContactIds.has(c.id)}
                          onChange={() => toggleContact(c.id)}
                          className="rounded border-muted-foreground" />
                        <span className="font-medium">{c.name || c.email}</span>
                        <span className="text-muted-foreground ml-auto font-mono text-[11px]">{c.email}</span>
                        {!isValidEmail(c.email) && <AlertCircle className="w-3 h-3 text-destructive" />}
                      </label>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="space-y-1">
                <Label className="text-xs">{t('manualEmails')}</Label>
                <Input value={manualEmails} onChange={e => setManualEmails(e.target.value)}
                  placeholder={t('manualEmailsPlaceholder')} className="h-8 text-xs font-mono" />
              </div>

              <div className="text-xs text-muted-foreground">
                {t('selectedRecipients', { count: recipientList.length })}
              </div>
            </div>
          )}

          {/* Step 2: 内容设置 */}
          {step === 2 && (
            <div className="space-y-3">
              {/* 内容来源切换 */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('bulkContentSource')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-start gap-2 p-2 border rounded-md cursor-pointer text-xs transition-colors ${
                    contentSource === 'editor' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                  }`}>
                    <input type="radio" name="contentSource" checked={contentSource === 'editor'}
                      onChange={() => setContentSource('editor')} className="mt-0.5" />
                    <div>
                      <div className="font-medium">{t('bulkUseEditorContent')}</div>
                      <div className="text-muted-foreground text-[10px] mt-0.5">{t('bulkUseEditorContentDesc')}</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-2 p-2 border rounded-md cursor-pointer text-xs transition-colors ${
                    contentSource === 'template' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
                  }`}>
                    <input type="radio" name="contentSource" checked={contentSource === 'template'}
                      onChange={() => setContentSource('template')} className="mt-0.5" />
                    <div>
                      <div className="font-medium">{t('bulkUseTemplate')}</div>
                      <div className="text-muted-foreground text-[10px] mt-0.5">{t('bulkUseTemplateDesc')}</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 发件账户 + 智能匹配 */}
              <div className="flex items-center gap-2">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">{t('senderAccount')}</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name || a.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer pt-4 flex-shrink-0">
                  <input type="checkbox" checked={autoMatchAccount}
                    onChange={e => setAutoMatchAccount(e.target.checked)}
                    className="rounded border-muted-foreground" />
                  {t('autoMatchAccount')}
                </label>
              </div>

              {/* 模式 A：编辑器内容预览 */}
              {contentSource === 'editor' && (
                editorHasContent ? (
                  <div className="border rounded-md p-3 space-y-1.5 text-xs bg-muted/20">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                      <FileText className="w-3 h-3" />
                      {t('bulkUseEditorContent')}
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-14 flex-shrink-0">{t('bulkPreviewSubject')}</span>
                      <span className="font-medium truncate">{currentSubject || '-'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-14 flex-shrink-0">{t('bulkPreviewBody')}</span>
                      <span className="text-muted-foreground italic truncate">{editorBodySnippet || '-'}</span>
                    </div>
                    {attachments.length > 0 && (
                      <div className="flex gap-2 items-center">
                        <span className="text-muted-foreground w-14 flex-shrink-0">{t('bulkPreviewAttachments')}</span>
                        <span className="flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          {attachments.length} {t('files')}
                          <span className="text-muted-foreground">({formatFileSize(attachments.reduce((s, a) => s + (a.size || 0), 0))})</span>
                        </span>
                      </div>
                    )}
                    {activeSignatureName && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-14 flex-shrink-0">{t('bulkPreviewSignature')}</span>
                        <span>{activeSignatureName}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-14 flex-shrink-0">{t('bulkPreviewFormat')}</span>
                      <span>{currentFormat === 'html' ? 'HTML' : 'Text'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {t('bulkEditorContentEmpty')}
                  </div>
                )
              )}

              {/* 模式 B：模板选择 + 手动编辑 */}
              {contentSource === 'template' && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('bulkTemplate')}</Label>
                    <Select value={defaultTemplateId} onValueChange={setDefaultTemplateId}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('noTemplate')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('noTemplate')}</SelectItem>
                        {templates.map(tpl => (
                          <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {defaultTemplateId === '__none__' && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('subject')}</Label>
                        <Input value={defaultSubject} onChange={e => setDefaultSubject(e.target.value)}
                          placeholder={t('subjectPlaceholder')} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('bulkBodyHint')}</Label>
                        <textarea value={defaultBody} onChange={e => setDefaultBody(e.target.value)}
                          placeholder={t('bulkBodyPlaceholder')}
                          className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                      </div>
                    </>
                  )}

                  {signatures.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">{t('signature')}</Label>
                      <Select value={signatureId} onValueChange={setSignatureId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('noSignature')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__no_sig__">{t('noSignature')}</SelectItem>
                          {signatures.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <p className="text-[10px] text-muted-foreground">{t('bulkVariableHint')}</p>
            </div>
          )}

          {/* Step 3: 确认 */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="border rounded-md p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('bulkJobName')}</span>
                  <span className="font-medium">{jobName || `群发任务 ${new Date().toLocaleDateString()}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('recipientCount')}</span>
                  <span className="font-medium">{recipientList.length} {t('people')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('senderAccount')}</span>
                  <span className="font-medium font-mono">{accounts.find(a => a.id === accountId)?.email || '-'}</span>
                </div>
                {autoMatchAccount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('autoMatchAccount')}</span>
                    <span className="text-green-600">{t('enabled')}</span>
                  </div>
                )}
                {defaultTemplateId !== '__none__' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('bulkTemplate')}</span>
                    <span className="font-medium">{templates.find(tpl => tpl.id === defaultTemplateId)?.name || '-'}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('bulkContentSource')}</span>
                  <span className="font-medium">{contentSource === 'editor' ? t('bulkUseEditorContent') : t('bulkUseTemplate')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('subject')}</span>
                  <span className="font-medium truncate max-w-[300px]">{contentSource === 'editor' ? (currentSubject || '-') : (defaultSubject || t('fromTemplate'))}</span>
                </div>
                {attachments.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('attachments')}</span>
                    <span className="font-medium">{attachments.length} {t('files')}</span>
                  </div>
                )}
              </div>

              <ScrollArea className="h-[160px] border rounded-md p-2">
                <div className="space-y-0.5">
                  {recipientList.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-0.5 text-xs">
                      <span className="text-muted-foreground w-6">{i + 1}.</span>
                      <span className="font-medium">{r.name || '-'}</span>
                      <span className="text-muted-foreground font-mono ml-auto">{r.email}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center pt-2">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1"
                onClick={() => setStep((step - 1) as Step)}>
                <ChevronLeft className="w-3 h-3" />
                {t('previousStep')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
              onClick={() => { resetForm(); onOpenChange(false); }}>
              <X className="w-3 h-3" />
              {t('cancel')}
            </Button>
            {step < 3 ? (
              <Button size="sm" className="h-8 text-xs gap-1"
                disabled={step === 1 ? !step1Valid : !step2Valid}
                onClick={() => setStep((step + 1) as Step)}>
                {t('nextStep')}
                <ChevronRight className="w-3 h-3" />
              </Button>
            ) : (
              <Button size="sm" className="h-8 text-xs gap-1"
                onClick={handleCreate}>
                <Send className="w-3 h-3" />
                {t('createBulkJob')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
