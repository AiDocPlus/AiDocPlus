/**
 * EssayAnalysisPanel.tsx — 散文文学分析面板
 *
 * Phase 5: 高级文学分析面板 UI
 * - 修辞检测结果展示
 * - 意象分析可视化
 * - 情感走势图表
 * - 文学评分仪表盘
 * - 关键词词云
 * - 段落复杂度分析
 */

import { useState, useEffect } from 'react';
import {
  TrendingUp, Eye, Heart, Brain, Target,
  Zap, Award, BookOpen, Palette, Music, Sparkles,
  ChevronDown, ChevronRight, RefreshCw, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  generateEssayAnalysisReport,
  type EssayAnalysisReport,
  type RhetoricDetection,
  type ImageryDetection,
  type EmotionPoint,
  type LiteraryScore,
  type KeywordFrequency,
  type ParagraphComplexity,
} from './essayAnalysis';
import type { EssayDocumentContent } from './types';
import EssayRhythmAnalyzer from './EssayRhythmAnalyzer';

interface EssayAnalysisPanelProps {
  essay: EssayDocumentContent;
}

export default function EssayAnalysisPanel({ essay }: EssayAnalysisPanelProps) {
  const [report, setReport] = useState<EssayAnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    rhetoric: true,
    imagery: true,
    emotion: true,
    score: true,
  });

  // 生成分析报告
  const generateReport = async () => {
    setLoading(true);
    try {
      // 模拟异步分析过程
      await new Promise(resolve => setTimeout(resolve, 800));
      const newReport = generateEssayAnalysisReport(essay);
      setReport(newReport);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
  }, [essay]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // 修辞检测结果渲染
  const renderRhetoricResults = (rhetoric: RhetoricDetection[]) => {
    if (rhetoric.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <p>暂未检测到修辞手法</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {rhetoric.map(item => (
          <div key={item.type} className="border border-l-4 border-l-blue-500 rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">{item.label}</h4>
              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                {item.count} 处
              </span>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {item.matches.slice(0, 3).map((match, idx) => (
                <div key={idx} className="text-xs bg-muted p-2 rounded">
                  <span className="font-medium">{match.description}:</span>
                  <span className="ml-2 text-muted-foreground">"{match.text}"</span>
                </div>
              ))}
              {item.matches.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  ...还有 {item.matches.length - 3} 处
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 意象分析结果渲染
  const renderImageryResults = (imagery: ImageryDetection[]) => {
    if (imagery.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          <Palette className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <p>暂未检测到感官意象</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {imagery.map(item => (
          <div key={item.type} className="border rounded-md p-4 text-center">
            <div className="text-2xl mb-2">
              {item.type === 'visual' && <Eye />}
              {item.type === 'auditory' && <Music />}
              {item.type === 'olfactory' && <Sparkles />}
              {item.type === 'tactile' && <Zap />}
              {item.type === 'gustatory' && <Heart />}
              {item.type === 'abstract' && <Brain />}
            </div>
            <h4 className="font-medium text-sm">{item.label}</h4>
            <p className="text-2xl font-bold text-primary mt-1">{item.count}</p>
            <p className="text-xs text-muted-foreground">处意象</p>
          </div>
        ))}
      </div>
    );
  };

  // 情感走势图渲染
  const renderEmotionFlow = (emotionFlow: EmotionPoint[]) => {
    if (emotionFlow.length === 0) return null;

    const maxIntensity = Math.max(...emotionFlow.map(e => Math.abs(e.score)));

    return (
      <div className="space-y-4">
        <div className="relative h-32">
          {/* 零线 */}
          <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-muted-foreground/30" />
          
          {/* 情感曲线 */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              points={emotionFlow.map((point, idx) => {
                const x = emotionFlow.length > 1 ? (idx / (emotionFlow.length - 1)) * 100 : 50;
                const y = 50 - (maxIntensity > 0 ? (point.score / maxIntensity) * 40 : 0);
                return `${x},${y}`;
              }).join(' ')}
            />
            
            {/* 数据点 */}
            {emotionFlow.map((point, idx) => {
              const x = emotionFlow.length > 1 ? (idx / (emotionFlow.length - 1)) * 100 : 50;
              const y = 50 - (maxIntensity > 0 ? (point.score / maxIntensity) * 40 : 0);
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r="2"
                  fill="hsl(var(--primary))"
                  className="cursor-pointer"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
        </div>
        
        {/* 图例 */}
        <div className="flex justify-center space-x-4 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-1" />
            <span>积极</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-1" />
            <span>消极</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-400 rounded-full mr-1" />
            <span>中性</span>
          </div>
        </div>
      </div>
    );
  };

  // 文学评分仪表盘
  const renderLiteraryScore = (score: LiteraryScore) => {
    const getScoreColor = (s: number) => {
      if (s >= 80) return 'text-green-600';
      if (s >= 60) return 'text-yellow-600';
      return 'text-red-600';
    };

    return (
      <div className="space-y-6">
        {/* 总分 */}
        <div className="text-center">
          <div className="text-4xl font-bold mb-2">
            <span className={getScoreColor(score.overall)}>{score.overall}</span>
            <span className="text-2xl text-muted-foreground">/100</span>
          </div>
          <p className="text-sm text-muted-foreground">文学综合评分</p>
        </div>

        {/* 维度评分 */}
        <div className="space-y-4">
          {Object.entries(score.dimensions).map(([key, dim]) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{dim.description}</span>
                <span className={`font-medium ${getScoreColor(dim.score)}`}>
                  {Math.round(dim.score)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${dim.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* 改进建议 */}
        {score.suggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center">
              <Target className="h-4 w-4 mr-1" />
              改进建议
            </h4>
            <div className="space-y-1">
              {score.suggestions.map((suggestion, idx) => (
                <div key={idx} className="text-xs bg-blue-50 dark:bg-blue-950 p-2 rounded border-l-2 border-l-blue-500">
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 关键词词云
  const renderKeywords = (keywords: KeywordFrequency[]) => {
    if (keywords.length === 0) return null;

    const maxWeight = Math.max(...keywords.map(k => k.weight));
    
    return (
      <div className="flex flex-wrap gap-2 justify-center">
        {keywords.slice(0, 20).map(keyword => {
          const fontSize = Math.max(12, Math.min(24, (keyword.weight / maxWeight) * 24));
          const opacity = Math.max(0.6, keyword.weight / maxWeight);
          
          return (
            <span
              key={keyword.word}
              className="inline-block px-2 py-1 bg-primary/10 text-primary rounded cursor-pointer hover:bg-primary/20 transition-colors"
              style={{
                fontSize: `${fontSize}px`,
                opacity,
              }}
              title={`出现 ${keyword.count} 次`}
            >
              {keyword.word}
            </span>
          );
        })}
      </div>
    );
  };

  // 段落复杂度分析
  const renderParagraphComplexity = (complexity: ParagraphComplexity[]) => {
    return (
      <div className="space-y-2">
        {complexity.map(item => (
          <div key={item.index} className="flex items-center space-x-4 p-2 rounded hover:bg-muted/50">
            <div className="text-sm text-muted-foreground w-8">
              段{item.index + 1}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className={`text-xs px-2 py-1 rounded ${
                  item.complexity === 'simple' ? 'bg-secondary text-secondary-foreground' : 
                  item.complexity === 'moderate' ? 'bg-primary text-primary-foreground' : 
                  'bg-destructive text-destructive-foreground'
                }`}>
                  {item.complexity === 'simple' ? '简单' : 
                   item.complexity === 'moderate' ? '中等' : '复杂'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.sentenceCount} 句 · 平均 {item.avgSentenceLength} 字
                </span>
              </div>
              
              <div className="flex space-x-4 text-xs text-muted-foreground">
                <span>修辞 {item.rhetoricCount}</span>
                <span>意象 {item.imageryCount}</span>
                <span>长度 {item.length}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin text-primary" />
          <p className="text-muted-foreground">正在分析散文...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">文学分析</h3>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={generateReport} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            导出
          </Button>
        </div>
      </div>

      {/* 分析概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-md p-4 text-center">
          <div className="text-2xl font-bold text-primary">{report.summary.wordCount}</div>
          <p className="text-xs text-muted-foreground">总字数</p>
        </div>
        <div className="border rounded-md p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{report.summary.paragraphCount}</div>
          <p className="text-xs text-muted-foreground">段落数</p>
        </div>
        <div className="border rounded-md p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{report.summary.rhetoricDensity.toFixed(1)}</div>
          <p className="text-xs text-muted-foreground">修辞密度</p>
        </div>
        <div className="border rounded-md p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{report.literaryScore.overall}</div>
          <p className="text-xs text-muted-foreground">文学评分</p>
        </div>
      </div>

      {/* 详细分析标签页 */}
      <Tabs defaultValue="rhetoric" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="rhetoric">修辞</TabsTrigger>
          <TabsTrigger value="imagery">意象</TabsTrigger>
          <TabsTrigger value="emotion">情感</TabsTrigger>
          <TabsTrigger value="score">评分</TabsTrigger>
          <TabsTrigger value="keywords">关键词</TabsTrigger>
          <TabsTrigger value="complexity">复杂度</TabsTrigger>
          <TabsTrigger value="rhythm">韵律</TabsTrigger>
        </TabsList>

        <TabsContent value="rhetoric" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center">
              <BookOpen className="h-4 w-4 mr-2" />
              修辞手法检测
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection('rhetoric')}
            >
              {expandedSections.rhetoric ? <ChevronDown /> : <ChevronRight />}
            </Button>
          </div>
          {expandedSections.rhetoric && renderRhetoricResults(report.rhetoric)}
        </TabsContent>

        <TabsContent value="imagery" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center">
              <Palette className="h-4 w-4 mr-2" />
              感官意象分析
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection('imagery')}
            >
              {expandedSections.imagery ? <ChevronDown /> : <ChevronRight />}
            </Button>
          </div>
          {expandedSections.imagery && renderImageryResults(report.imagery)}
        </TabsContent>

        <TabsContent value="emotion" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center">
              <Heart className="h-4 w-4 mr-2" />
              情感走势分析
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection('emotion')}
            >
              {expandedSections.emotion ? <ChevronDown /> : <ChevronRight />}
            </Button>
          </div>
          {expandedSections.emotion && renderEmotionFlow(report.emotionFlow)}
        </TabsContent>

        <TabsContent value="score" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center">
              <Award className="h-4 w-4 mr-2" />
              文学质量评分
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection('score')}
            >
              {expandedSections.score ? <ChevronDown /> : <ChevronRight />}
            </Button>
          </div>
          {expandedSections.score && renderLiteraryScore(report.literaryScore)}
        </TabsContent>

        <TabsContent value="keywords" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              关键词分析
            </h4>
          </div>
          {renderKeywords(report.keywords)}
        </TabsContent>

        <TabsContent value="complexity" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center">
              <Brain className="h-4 w-4 mr-2" />
              段落复杂度
            </h4>
          </div>
          {renderParagraphComplexity(report.paragraphComplexity)}
        </TabsContent>

        <TabsContent value="rhythm">
          <EssayRhythmAnalyzer
            paragraphs={essay.paragraphs}
            content={essay.content}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
