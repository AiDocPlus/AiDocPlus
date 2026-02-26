import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Settings, ArrowRight, ArrowLeft, BookOpen, Gift, Layout, Puzzle, FileText, Keyboard, History, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';

interface FirstRunGuideDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

const TOTAL_STEPS = 4;

export function FirstRunGuideDialog({ open, onClose, onOpenSettings }: FirstRunGuideDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const handleConfigure = () => {
    onOpenSettings();
  };

  const handleOpenUrl = (url: string) => {
    invoke('open_file_with_app', { path: url, appName: null }).catch((err) => {
      console.error('Failed to open URL:', err);
    });
  };

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        {/* 步骤指示器 */}
        <div className="flex items-center justify-center gap-1.5 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Step 0: 欢迎页 */}
        {step === 0 && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-6 w-6 text-primary" />
                <DialogTitle className="text-xl">
                  {t('firstRun.title', { defaultValue: '欢迎使用 AiDocPlus' })}
                </DialogTitle>
              </div>
              <DialogDescription className="text-base">
                {t('firstRun.welcomeDesc', { defaultValue: 'AI 驱动的智能文档创作工具，让写作更高效' })}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                <FileText className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('firstRun.feature1Title', { defaultValue: 'AI 智能写作' })}</p>
                  <p className="text-xs text-muted-foreground">{t('firstRun.feature1Desc', { defaultValue: 'AI 对话、内容生成、润色改写，全方位辅助创作' })}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                <Puzzle className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('firstRun.feature2Title', { defaultValue: '丰富插件生态' })}</p>
                  <p className="text-xs text-muted-foreground">{t('firstRun.feature2Desc', { defaultValue: '21 个内置插件，涵盖翻译、摘要、PPT、邮件等' })}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                <Layout className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('firstRun.feature3Title', { defaultValue: '专业编辑体验' })}</p>
                  <p className="text-xs text-muted-foreground">{t('firstRun.feature3Desc', { defaultValue: 'Markdown 编辑器、多格式导出、版本历史、编程区' })}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 1: 配置 AI */}
        {step === 1 && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-6 w-6 text-primary" />
                <DialogTitle className="text-xl">
                  {t('firstRun.configTitle', { defaultValue: '配置 AI 服务' })}
                </DialogTitle>
              </div>
              <DialogDescription className="text-base">
                {t('firstRun.description', { defaultValue: '开始使用 AI 功能，只需配置一个 API Key' })}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <h4 className="font-semibold text-primary mb-2">
                {t('firstRun.bonusTitle', { defaultValue: '🎁 新用户福利' })}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t('firstRun.bonusDesc', { defaultValue: '智谱 AI 为新用户提供 2000万免费 Tokens，足够体验所有 AI 功能' })}
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Button className="w-full" onClick={handleConfigure}>
                <Settings className="h-4 w-4 mr-2" />
                {t('firstRun.configureZhipu', { defaultValue: '配置智谱 AI（推荐）' })}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleOpenUrl('https://AiDocPlus.com/docs/getting-started/zhipu-api')}>
                <BookOpen className="h-4 w-4 mr-2" />
                {t('firstRun.viewTutorial', { defaultValue: '查看详细教程' })}
              </Button>
            </div>
          </>
        )}

        {/* Step 2: 核心功能引导 */}
        {step === 2 && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                <Layout className="h-6 w-6 text-primary" />
                <DialogTitle className="text-xl">
                  {t('firstRun.coreTitle', { defaultValue: '核心功能速览' })}
                </DialogTitle>
              </div>
              <DialogDescription className="text-base">
                {t('firstRun.coreDesc', { defaultValue: '了解 AiDocPlus 的五大工作区' })}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-lg border">
                <p className="text-sm font-medium mb-1">{t('firstRun.area1Title', { defaultValue: '📝 生成区 — 智能编辑器' })}</p>
                <p className="text-xs text-muted-foreground">{t('firstRun.area1Desc', { defaultValue: 'Markdown 编辑器 + AI 助手侧边栏，支持实时对话与内容生成' })}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-sm font-medium mb-1">{t('firstRun.area2Title', { defaultValue: '🧩 内容区 — 内容生成' })}</p>
                <p className="text-xs text-muted-foreground">{t('firstRun.area2Desc', { defaultValue: '翻译、摘要、扩写、PPT 生成、邮件撰写等内容生成类插件' })}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-sm font-medium mb-1">{t('firstRun.area3Title', { defaultValue: '📋 合并区 — 内容整合' })}</p>
                <p className="text-xs text-muted-foreground">{t('firstRun.area3Desc', { defaultValue: '将素材、AI 生成内容和人工编辑智能合并为终稿' })}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-sm font-medium mb-1">{t('firstRun.area4Title', { defaultValue: '🔧 功能区 — 实用工具' })}</p>
                <p className="text-xs text-muted-foreground">{t('firstRun.area4Desc', { defaultValue: '格式转换、OCR、代码工具等功能类插件' })}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-sm font-medium mb-1">{t('firstRun.area5Title', { defaultValue: '💻 编程区 — 代码执行' })}</p>
                <p className="text-xs text-muted-foreground">{t('firstRun.area5Desc', { defaultValue: '集成多语言代码编辑与运行环境，AI 辅助编程' })}</p>
              </div>
            </div>
          </>
        )}

        {/* Step 3: 进阶提示 */}
        {step === 3 && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-6 w-6 text-primary" />
                <DialogTitle className="text-xl">
                  {t('firstRun.tipsTitle', { defaultValue: '进阶技巧' })}
                </DialogTitle>
              </div>
              <DialogDescription className="text-base">
                {t('firstRun.tipsDesc', { defaultValue: '掌握这些技巧，让你的效率翻倍' })}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                <Keyboard className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('firstRun.tip1Title', { defaultValue: '快捷键加速' })}</p>
                  <p className="text-xs text-muted-foreground">{t('firstRun.tip1Desc', { defaultValue: 'Cmd/Ctrl+J 唤起 AI 助手，Cmd/Ctrl+B 切换侧边栏' })}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                <Download className="h-5 w-5 text-cyan-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('firstRun.tip2Title', { defaultValue: '多格式导出' })}</p>
                  <p className="text-xs text-muted-foreground">{t('firstRun.tip2Desc', { defaultValue: '支持导出为 Markdown、HTML、Word、PDF、纯文本' })}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                <History className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('firstRun.tip3Title', { defaultValue: '版本历史' })}</p>
                  <p className="text-xs text-muted-foreground">{t('firstRun.tip3Desc', { defaultValue: '每次保存自动创建版本快照，随时对比和恢复' })}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
              <p className="text-sm">
                {t('firstRun.moreInfo', { defaultValue: '了解更多请访问' })}{' '}
                <button
                  onClick={() => handleOpenUrl('https://AiDocPlus.com')}
                  className="text-primary font-medium hover:underline cursor-pointer"
                >
                  AiDocPlus.com
                </button>
              </p>
            </div>
          </>
        )}

        {/* 底部导航 */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handlePrev}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t('firstRun.prev', { defaultValue: '上一步' })}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              {t('firstRun.skip', { defaultValue: '稍后配置' })}
            </Button>
            {step < TOTAL_STEPS - 1 ? (
              <Button size="sm" onClick={handleNext}>
                {t('firstRun.next', { defaultValue: '下一步' })}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleClose}>
                {t('firstRun.start', { defaultValue: '开始使用' })}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
