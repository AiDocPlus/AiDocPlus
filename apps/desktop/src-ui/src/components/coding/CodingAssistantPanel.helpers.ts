import type { ChatMessage } from './codingAI';

let nextMsgId = 1;

export function createCodingAssistantMessageId(now = Date.now()): string {
  return `msg_${now}_${nextMsgId++}`;
}

export function appendCodingMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return [...messages, message];
}

export function createCodingUserMessage(content: string, now = Date.now()): ChatMessage {
  return {
    id: createCodingAssistantMessageId(now),
    role: 'user',
    content: content.trim(),
    timestamp: now,
  };
}

export function createCodingAssistantResponseMessage(
  content: string,
  codeBlocks: string[],
  now = Date.now(),
): ChatMessage {
  return {
    id: createCodingAssistantMessageId(now),
    role: 'assistant',
    content,
    timestamp: now,
    codeBlocks,
  };
}

export function createCodingAssistantErrorMessage(error: unknown, now = Date.now()): ChatMessage {
  return {
    id: createCodingAssistantMessageId(now),
    role: 'assistant',
    content: `❌ ${error instanceof Error ? error.message : String(error)}`,
    timestamp: now,
  };
}

export function createCodingAssistantInterruptedMessage(
  content: string,
  codeBlocks: string[],
  now = Date.now(),
): ChatMessage {
  return {
    id: createCodingAssistantMessageId(now),
    role: 'assistant',
    content: `${content}\n\n_(已中断)_`,
    timestamp: now,
    codeBlocks,
  };
}

export function buildCodingAssistantExportMarkdown(
  messages: ChatMessage[],
  fileName: string,
): string {
  const lines = messages.map(message => {
    const role = message.role === 'user' ? '👤 用户' : message.role === 'assistant' ? '🤖 助手' : '⚙ 系统';
    return `### ${role}\n\n${message.content}\n`;
  });
  return `# ${fileName || '对话记录'}\n\n${lines.join('\n---\n\n')}`;
}

export function buildCodingPlanExecutionPrompt(planContent: string): string {
  return `请根据以下计划，直接生成完整可运行的 Python 代码：\n\n${planContent}`;
}

export type CodingAssistantContentSegment =
  | {
      type: 'text';
      key: string;
      text: string;
    }
  | {
      type: 'code';
      key: string;
      blockId: string;
      codeLang: string;
      code: string;
      incomplete: boolean;
    };

export function parseCodingAssistantContent(
  content: string,
  msgId: string,
  language?: string,
): CodingAssistantContentSegment[] {
  const segments: CodingAssistantContentSegment[] = [];
  let lastIdx = 0;
  const re = /```([a-zA-Z]*)\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let blockIdx = 0;

  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIdx) {
      segments.push({
        type: 'text',
        key: `t${lastIdx}`,
        text: content.slice(lastIdx, match.index),
      });
    }

    segments.push({
      type: 'code',
      key: `${msgId}_b${blockIdx}`,
      blockId: `${msgId}_b${blockIdx}`,
      codeLang: match[1] || language || 'code',
      code: match[2].trim(),
      incomplete: false,
    });

    lastIdx = match.index + match[0].length;
    blockIdx += 1;
  }

  if (lastIdx < content.length) {
    const remaining = content.slice(lastIdx);
    const unclosedMatch = remaining.match(/```([a-zA-Z]*)\s*\n([\s\S]*)$/);

    if (unclosedMatch) {
      const beforeCode = remaining.slice(0, unclosedMatch.index);
      if (beforeCode) {
        segments.push({
          type: 'text',
          key: `t${lastIdx}`,
          text: beforeCode,
        });
      }

      segments.push({
        type: 'code',
        key: `unc_${lastIdx}`,
        blockId: `unc_${lastIdx}`,
        codeLang: unclosedMatch[1] || language || 'code',
        code: unclosedMatch[2],
        incomplete: true,
      });
    } else {
      segments.push({
        type: 'text',
        key: `t${lastIdx}`,
        text: remaining,
      });
    }
  }

  return segments;
}
