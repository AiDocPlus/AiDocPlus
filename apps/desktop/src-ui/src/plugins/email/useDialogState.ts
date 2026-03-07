import { useState } from 'react';
import type { Contact } from './types';

/**
 * 集中管理邮件插件中所有对话框的开关状态
 */
export function useDialogState() {
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [recipientsDialogOpen, setRecipientsDialogOpen] = useState(false);
  const [subjectsDialogOpen, setSubjectsDialogOpen] = useState(false);
  const [sendConfirmDialogOpen, setSendConfirmDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [draftsDialogOpen, setDraftsDialogOpen] = useState(false);
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);
  const [newEmailConfirmOpen, setNewEmailConfirmOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [bulkSendDialogOpen, setBulkSendDialogOpen] = useState(false);
  const [bulkJobManagerOpen, setBulkJobManagerOpen] = useState(false);

  // 收件人建议
  const [recipientSuggestions, setRecipientSuggestions] = useState<Contact[]>([]);
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState(false);

  return {
    accountDialogOpen, setAccountDialogOpen,
    recipientsDialogOpen, setRecipientsDialogOpen,
    subjectsDialogOpen, setSubjectsDialogOpen,
    sendConfirmDialogOpen, setSendConfirmDialogOpen,
    historyDialogOpen, setHistoryDialogOpen,
    signatureDialogOpen, setSignatureDialogOpen,
    templatesDialogOpen, setTemplatesDialogOpen,
    csvImportDialogOpen, setCsvImportDialogOpen,
    draftsDialogOpen, setDraftsDialogOpen,
    queueDialogOpen, setQueueDialogOpen,
    newEmailConfirmOpen, setNewEmailConfirmOpen,
    previewDialogOpen, setPreviewDialogOpen,
    bulkSendDialogOpen, setBulkSendDialogOpen,
    bulkJobManagerOpen, setBulkJobManagerOpen,
    recipientSuggestions, setRecipientSuggestions,
    showRecipientSuggestions, setShowRecipientSuggestions,
  };
}

export type DialogState = ReturnType<typeof useDialogState>;
