/**
 * SettingsAIPanel — 设定集专用 AI 面板
 * 上下文感知：根据当前激活 Tab 动态切换快捷操作和系统提示词
 * 批量导入：解析 AI 回复 JSON 自动导入到设定集
 */
import { useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { NovelDocumentContent, NovelCharacter, NovelMaterialCategory } from '../types';
import {
  addCharacter, updateCharacter, addLocation, updateLocation,
  addForeshadowing, updateForeshadowing, addMaterial,
  addCharacterRelation, addFaction, addTimelineEvent,
} from '../types';
import DocTypeAIChatBase, { sendDocTypeAIMessage } from '../../_shared/DocTypeAIChatBase';
import { QUICK_ACTION_BAR, QUICK_ACTION_BTN, MSG_ACTION_BTN } from '../../_shared/styles';
import type { DocTypeChatMsg } from '../../_shared/DocTypeChatMessage';

type SettingsTab = 'synopsis' | 'outline' | 'characters' | 'relations' | 'locations' | 'factions' | 'foreshadowing' | 'timeline' | 'worldview' | 'materials' | 'goals' | 'check' | 'plotlines';

interface SettingsAIPanelProps {
  host: DocTypeHostAPI;
  documentId: string;
  novel: NovelDocumentContent;
  activeTab: SettingsTab;
  activeChapterId: string | null;
  onNovelChange: (novel: NovelDocumentContent) => void;
}

const MATERIAL_CATEGORIES: NovelMaterialCategory[] = ['inspiration', 'scene', 'dialogue', 'plot', 'other'];

export default function SettingsAIPanel({
  host, documentId, novel, activeTab, activeChapterId, onNovelChange,
}: SettingsAIPanelProps) {

  // ── AI 系统提示词（包含当前 Tab 数据） ──
  const aiSystemPrompt = useMemo(() => {
    const base = '你是专业的小说世界构建助手。根据提供的小说设定信息，帮助完善世界观、人物、地点等设定。';
    const s = novel.settings;
    let context = '';

    if (s.synopsis) context += `\n\n故事梗概：${s.synopsis.slice(0, 500)}`;
    if (s.genre) context += `\n类型：${s.genre}`;
    if (s.era) context += `\n时代：${s.era}`;
    if (s.style) context += `\n风格：${s.style}`;

    // 根据当前 Tab 注入更详细的上下文
    switch (activeTab) {
      case 'characters':
        if (s.characters.length > 0) {
          context += '\n\n当前角色列表：';
          for (const c of s.characters) {
            const role = c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : c.role === 'supporting' ? '配角' : '龙套';
            context += `\n- ${c.name}（${role}）：${c.description.slice(0, 100)}`;
            if (c.personality) context += ` | 性格：${c.personality.slice(0, 50)}`;
            if (c.motivation) context += ` | 动机：${c.motivation.slice(0, 50)}`;
          }
        }
        break;
      case 'relations':
        if (s.characterRelations.length > 0) {
          context += '\n\n当前人物关系：';
          for (const r of s.characterRelations) {
            const from = s.characters.find(c => c.id === r.fromId)?.name || '?';
            const to = s.characters.find(c => c.id === r.toId)?.name || '?';
            context += `\n- ${from} ${r.bidirectional !== false ? '⟷' : '→'} ${to}：${r.type}${r.label ? `（${r.label}）` : ''}`;
          }
        }
        break;
      case 'locations':
        if (s.locations.length > 0) {
          context += '\n\n当前地点列表：';
          for (const l of s.locations) context += `\n- ${l.name}：${l.description.slice(0, 80)}`;
        }
        break;
      case 'factions':
        if (s.factions.length > 0) {
          context += '\n\n当前阵营列表：';
          for (const f of s.factions) {
            const memberNames = f.memberIds.map(id => s.characters.find(c => c.id === id)?.name).filter(Boolean);
            context += `\n- ${f.name}（${memberNames.join('、') || '无成员'}）：${f.description.slice(0, 80)}`;
          }
        }
        break;
      case 'foreshadowing':
        if (s.foreshadowing.length > 0) {
          context += '\n\n当前伏笔列表：';
          for (const f of s.foreshadowing) context += `\n- [${f.status}] ${f.content.slice(0, 80)}`;
        }
        break;
      case 'timeline':
        if (s.timeline.length > 0) {
          context += '\n\n当前时间线：';
          for (const e of s.timeline) context += `\n- ${e.date || '?'} | ${e.title}${e.description ? '：' + e.description.slice(0, 60) : ''}`;
        }
        break;
      case 'worldview':
        if (s.worldView) context += `\n\n世界观：${s.worldView.slice(0, 500)}`;
        if (s.worldRules) context += `\n规则设定：${s.worldRules.slice(0, 300)}`;
        if (s.worldGeography) context += `\n地理设定：${s.worldGeography.slice(0, 300)}`;
        if (s.worldCulture) context += `\n文化设定：${s.worldCulture.slice(0, 300)}`;
        if (s.historicalBackground) context += `\n历史背景：${s.historicalBackground.slice(0, 300)}`;
        break;
    }

    return base + context;
  }, [novel, activeTab]);

  // ── 根据当前 Tab 生成快捷操作按钮 ──
  const quickActions = useMemo(() => {
    switch (activeTab) {
      case 'synopsis':
        return [
          { label: '生成梗概', message: '请根据现有设定，为这个故事生成一段完整的梗概（300-500字）' },
        ];
      case 'outline':
        return [
          { label: '扩展大纲', message: '请根据故事梗概和角色设定，扩展全局大纲的细节' },
        ];
      case 'characters':
        return [
          { label: '生成人物', message: '请为这个故事生成一个新角色的完整档案，以 JSON 数组格式输出，字段包含 name, role, description, gender, age, appearance, personality, background, motivation, arc, strengths, weaknesses, dialogueStyle, aliases' },
          { label: '丰富背景', message: '请为现有角色补充更丰富的背景故事和人物弧光' },
        ];
      case 'relations':
        return [
          { label: '分析关系', message: '请分析现有角色之间可能存在的关系，并建议新增的人物关系' },
          { label: '检测冲突', message: '请检查现有人物关系中是否存在逻辑冲突或不合理之处' },
        ];
      case 'locations':
        return [
          { label: '生成地点', message: '请为故事生成一个新的地点设定，以 JSON 数组格式输出，字段包含 name, description, type, atmosphere, significance' },
        ];
      case 'factions':
        return [
          { label: '生成阵营', message: '请为故事生成一个新的阵营/势力设定，包含名称、类型、描述、目标和势力关系' },
        ];
      case 'foreshadowing':
        return [
          { label: '检测伏笔', message: '请根据现有章节内容，检测是否有未回收的伏笔或可以埋设的新伏笔' },
          { label: '解决建议', message: '请为当前未解伏笔提供合理的解决方案建议' },
        ];
      case 'timeline':
        return [
          { label: '梳理时间线', message: '请根据故事情节梳理完整的时间线，以 JSON 数组格式输出，字段包含 title, date, description, importance' },
          { label: '检测冲突', message: '请检查现有时间线中是否存在时间逻辑冲突' },
        ];
      case 'worldview':
        return [
          { label: '扩展世界观', message: '请根据现有设定，进一步完善世界观的细节' },
          { label: '力量体系', message: '请为这个世界设计一套完整的力量体系/魔法系统' },
          { label: '检查一致性', message: '请检查现有世界观设定是否存在自相矛盾之处' },
        ];
      case 'materials':
        return [
          { label: '生成素材', message: '请为故事生成一些创作素材（灵感、场景描写、关键对话），以 JSON 数组格式输出，字段包含 title, category, content' },
        ];
      default:
        return [];
    }
  }, [activeTab]);

  // ── 批量导入 ──
  const tryParseJsonFromAI = useCallback((content: string): unknown[] | null => {
    const fenceMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)```/);
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : content.trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  }, []);

  const handleBatchImport = useCallback((content: string) => {
    const items = tryParseJsonFromAI(content);
    if (!items || items.length === 0) return;

    let updated = novel;
    for (const item of items) {
      const obj = item as Record<string, unknown>;
      if (obj.name && obj.role && (obj.description !== undefined)) {
        // 人物
        updated = addCharacter(updated, String(obj.name));
        const lastChar = updated.settings.characters[updated.settings.characters.length - 1];
        updated = updateCharacter(updated, lastChar.id, {
          role: (['protagonist', 'antagonist', 'supporting', 'minor'].includes(String(obj.role)) ? String(obj.role) : 'supporting') as NovelCharacter['role'],
          description: String(obj.description || ''),
          gender: obj.gender ? String(obj.gender) : undefined,
          age: obj.age ? String(obj.age) : undefined,
          appearance: obj.appearance ? String(obj.appearance) : undefined,
          personality: obj.personality ? String(obj.personality) : undefined,
          background: obj.background ? String(obj.background) : undefined,
          motivation: obj.motivation ? String(obj.motivation) : undefined,
          arc: obj.arc ? String(obj.arc) : undefined,
          strengths: obj.strengths ? String(obj.strengths) : undefined,
          weaknesses: obj.weaknesses ? String(obj.weaknesses) : undefined,
          dialogueStyle: obj.dialogueStyle ? String(obj.dialogueStyle) : undefined,
          aliases: Array.isArray(obj.aliases) ? obj.aliases.map(String) : [],
        });
      } else if (obj.name && obj.description && !obj.role && !obj.content) {
        // 地点
        updated = addLocation(updated, String(obj.name));
        const lastLoc = updated.settings.locations[updated.settings.locations.length - 1];
        const locPatch: Record<string, string> = { description: String(obj.description) };
        if (obj.type) locPatch.type = String(obj.type);
        if (obj.atmosphere) locPatch.atmosphere = String(obj.atmosphere);
        if (obj.significance) locPatch.significance = String(obj.significance);
        updated = updateLocation(updated, lastLoc.id, locPatch);
      } else if (obj.content && obj.status) {
        // 伏笔
        updated = addForeshadowing(updated, activeChapterId || '', String(obj.content));
        const lastFs = updated.settings.foreshadowing[updated.settings.foreshadowing.length - 1];
        if (obj.note) updated = updateForeshadowing(updated, lastFs.id, { note: String(obj.note) });
      } else if (obj.title && obj.category && obj.content) {
        // 素材
        const cat = MATERIAL_CATEGORIES.includes(String(obj.category) as NovelMaterialCategory) ? String(obj.category) as NovelMaterialCategory : 'other';
        updated = addMaterial(updated, String(obj.title), cat, String(obj.content));
      } else if (obj.title && obj.importance) {
        // 时间线事件
        updated = addTimelineEvent(updated, String(obj.title));
      } else if (obj.fromName && obj.toName && obj.type) {
        // 人物关系（通过名字查找 ID）
        const from = updated.settings.characters.find(c => c.name === String(obj.fromName));
        const to = updated.settings.characters.find(c => c.name === String(obj.toName));
        if (from && to) updated = addCharacterRelation(updated, from.id, to.id, String(obj.type));
      } else if (obj.name && obj.memberIds === undefined && obj.description) {
        // 阵营
        updated = addFaction(updated, String(obj.name));
      }
    }
    onNovelChange(updated);
  }, [novel, activeChapterId, onNovelChange, tryParseJsonFromAI]);

  return (
    <DocTypeAIChatBase
      host={host}
      document={host.doc.getDocument()}
      systemPrompt={aiSystemPrompt}
      placeholder="输入设定集相关问题..."
      headerSlot={
        <div className={QUICK_ACTION_BAR}>
          {quickActions.map((action, i) => (
            <Button key={i} variant="outline" size="sm" className={QUICK_ACTION_BTN}
              onClick={() => sendDocTypeAIMessage({ documentId, message: action.message, label: action.label })}>
              {action.label}
            </Button>
          ))}
        </div>
      }
      messageActions={(msg: DocTypeChatMsg) => {
        const canImport = tryParseJsonFromAI(msg.content) !== null;
        return (
          <>
            {canImport && (
              <button className={MSG_ACTION_BTN} onClick={() => handleBatchImport(msg.content)}>
                <Plus className="h-3 w-3" />
                批量导入到设定集
              </button>
            )}
          </>
        );
      }}
    />
  );
}
