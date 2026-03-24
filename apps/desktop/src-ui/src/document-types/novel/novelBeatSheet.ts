/**
 * novelBeatSheet.ts — Beat Sheet 叙事结构模板
 *
 * N1.1: 提供专业的叙事结构模板（好莱坞三幕式、英雄之旅、起承转合等），
 * 用于 AI 大纲驱动写作。每个 Beat 对应一个大纲节点，AI 可逐节点展开为正文。
 */

// ═══ 类型定义 ═══

export interface BeatSheetBeat {
  id: string;
  label: string;
  description: string;
  /** 在全书中的大致位置（0-100%） */
  position: number;
  /** 建议的字数占比（0-1，全部 beat 之和 = 1） */
  wordRatio: number;
  /** AI 生成提示 */
  aiPrompt: string;
}

export interface BeatSheetTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  beats: BeatSheetBeat[];
  /** 适用类型提示 */
  suitableFor: string;
}

// ═══ 预设模板 ═══

const THREE_ACT: BeatSheetTemplate = {
  id: 'three-act',
  name: '好莱坞三幕式',
  description: '经典好莱坞叙事结构，分为建置、对抗、解决三幕',
  icon: '🎬',
  suitableFor: '通用，尤其适合商业类型小说',
  beats: [
    { id: '3a_hook', label: '开篇钩子', description: '引人入胜的开场，建立悬念或好奇', position: 0, wordRatio: 0.03, aiPrompt: '写一个引人入胜的开场，迅速抓住读者注意力' },
    { id: '3a_setup', label: '世界建置', description: '介绍主角、日常世界、人物关系', position: 5, wordRatio: 0.10, aiPrompt: '介绍主角的日常生活、性格、重要人物关系和所处环境' },
    { id: '3a_inciting', label: '激励事件', description: '打破平衡的事件，迫使主角做出选择', position: 12, wordRatio: 0.05, aiPrompt: '写一个打破主角日常的重大事件，迫使主角必须行动' },
    { id: '3a_debate', label: '拒绝/犹豫', description: '主角对冒险的抗拒和内心挣扎', position: 17, wordRatio: 0.05, aiPrompt: '展现主角面对挑战时的犹豫、恐惧和内心挣扎' },
    { id: '3a_act1_turn', label: '第一幕转折', description: '主角决定投入冒险，进入新世界', position: 25, wordRatio: 0.05, aiPrompt: '主角做出关键决定，正式踏上冒险之路' },
    { id: '3a_rising1', label: '试炼之路', description: '主角面对一系列挑战，结交盟友', position: 30, wordRatio: 0.12, aiPrompt: '主角在新环境中面对挑战、结交盟友、学习新技能' },
    { id: '3a_midpoint', label: '中点逆转', description: '重大转折：虚假胜利或虚假失败', position: 50, wordRatio: 0.08, aiPrompt: '写一个改变整个故事走向的中点转折，可以是虚假胜利或虚假失败' },
    { id: '3a_rising2', label: '敌人逼近', description: '反派加强攻势，盟友出现裂痕', position: 60, wordRatio: 0.10, aiPrompt: '反派势力增强，主角团队内部出现矛盾和危机' },
    { id: '3a_darknight', label: '至暗时刻', description: '一切希望破灭，主角跌入谷底', position: 75, wordRatio: 0.08, aiPrompt: '主角遭遇最大的挫败，看似一切已经失去，内心几近崩溃' },
    { id: '3a_act2_turn', label: '第二幕转折', description: '主角找到新的希望或力量', position: 80, wordRatio: 0.04, aiPrompt: '主角在绝境中获得新的领悟或力量，重新振作' },
    { id: '3a_climax', label: '高潮决战', description: '主角与反派的最终对决', position: 85, wordRatio: 0.15, aiPrompt: '主角与反派的终极对决，运用所学一切力量面对最终考验' },
    { id: '3a_resolution', label: '结局收束', description: '新的平衡建立，角色弧完成', position: 95, wordRatio: 0.10, aiPrompt: '展现主角的成长和改变，所有情节线收束，建立新的世界秩序' },
    { id: '3a_ending', label: '尾声', description: '最终画面，留下回味', position: 99, wordRatio: 0.05, aiPrompt: '用一个令人回味的场景或画面结束全书' },
  ],
};

const HERO_JOURNEY: BeatSheetTemplate = {
  id: 'hero-journey',
  name: '英雄之旅',
  description: '约瑟夫·坎贝尔的英雄之旅十二阶段',
  icon: '⚔️',
  suitableFor: '奇幻、冒险、成长类小说',
  beats: [
    { id: 'hj_ordinary', label: '平凡世界', description: '英雄的日常生活和初始状态', position: 0, wordRatio: 0.08, aiPrompt: '展现英雄在冒险开始前的日常世界，建立读者对角色的同理心' },
    { id: 'hj_call', label: '冒险召唤', description: '打破日常的召唤或挑战', position: 10, wordRatio: 0.05, aiPrompt: '一个不可忽视的事件或人物将冒险召唤带到英雄面前' },
    { id: 'hj_refusal', label: '拒绝召唤', description: '英雄因恐惧或责任而拒绝', position: 15, wordRatio: 0.05, aiPrompt: '英雄出于恐惧、自我怀疑或现实牵挂而拒绝冒险' },
    { id: 'hj_mentor', label: '遇见导师', description: '获得指引和工具', position: 20, wordRatio: 0.05, aiPrompt: '英雄遇见导师角色，获得关键的知识、工具或鼓励' },
    { id: 'hj_threshold', label: '跨越门槛', description: '正式进入冒险世界', position: 25, wordRatio: 0.05, aiPrompt: '英雄做出决定，离开熟悉的世界，踏入未知领域' },
    { id: 'hj_tests', label: '试炼盟敌', description: '面对考验，结识盟友和敌人', position: 35, wordRatio: 0.15, aiPrompt: '英雄在新世界中经历各种考验，结识盟友，辨识敌人' },
    { id: 'hj_approach', label: '接近深渊', description: '为最大考验做准备', position: 50, wordRatio: 0.08, aiPrompt: '英雄接近最危险的核心地带，为终极考验做最后准备' },
    { id: 'hj_ordeal', label: '严峻考验', description: '面对最大恐惧，近乎死亡', position: 60, wordRatio: 0.10, aiPrompt: '英雄面对最大的恐惧和考验，经历一次"死亡与重生"' },
    { id: 'hj_reward', label: '获得奖赏', description: '获得宝藏或新能力', position: 70, wordRatio: 0.08, aiPrompt: '英雄在严峻考验后获得奖赏——可以是物品、知识或内心力量' },
    { id: 'hj_road_back', label: '回程之路', description: '带着奖赏踏上归途', position: 80, wordRatio: 0.08, aiPrompt: '英雄带着奖赏踏上回家的路，但旅途并不平静' },
    { id: 'hj_resurrection', label: '复活考验', description: '最终考验，死而复生', position: 88, wordRatio: 0.12, aiPrompt: '英雄在即将回到平凡世界时面对最后的终极考验，完成彻底的蜕变' },
    { id: 'hj_return', label: '满载而归', description: '带着灵药回到日常世界', position: 95, wordRatio: 0.11, aiPrompt: '英雄带着改变了的自我和获得的"灵药"回到日常世界，两个世界融合' },
  ],
};

const QICHENGZHUANHE: BeatSheetTemplate = {
  id: 'qichengzhuanhe',
  name: '起承转合',
  description: '中国传统叙事结构，简洁有力',
  icon: '📜',
  suitableFor: '武侠、历史、文学类中文小说',
  beats: [
    { id: 'qc_qi', label: '起——开端', description: '故事缘起，人物登场，世界初现', position: 0, wordRatio: 0.20, aiPrompt: '建立故事背景，介绍主要角色和核心冲突的起源' },
    { id: 'qc_cheng', label: '承——发展', description: '情节推进，矛盾加深，人物关系展开', position: 25, wordRatio: 0.30, aiPrompt: '推进情节发展，加深人物关系和矛盾冲突，引入新的挑战' },
    { id: 'qc_zhuan', label: '转——转折', description: '重大转折，真相揭示，局势逆转', position: 60, wordRatio: 0.30, aiPrompt: '制造重大转折，揭示意想不到的真相，彻底改变故事走向' },
    { id: 'qc_he', label: '合——结局', description: '矛盾解决，故事收束，余韵悠长', position: 85, wordRatio: 0.20, aiPrompt: '解决核心矛盾，完成角色弧线，给读者留下深刻回味' },
  ],
};

const SAVE_THE_CAT: BeatSheetTemplate = {
  id: 'save-the-cat',
  name: 'Save the Cat',
  description: 'Blake Snyder 的 15 拍点结构，精确到页数比例',
  icon: '🐱',
  suitableFor: '类型小说、商业小说、网文',
  beats: [
    { id: 'stc_opening', label: '开场画面', description: '展现"之前"的世界', position: 0, wordRatio: 0.02, aiPrompt: '用一个画面或场景展现主角改变前的状态' },
    { id: 'stc_theme', label: '主题陈述', description: '有人对主角说出主题', position: 5, wordRatio: 0.03, aiPrompt: '通过对话或事件暗示全书的核心主题' },
    { id: 'stc_setup', label: '铺垫', description: '展示主角的缺陷和需求', position: 8, wordRatio: 0.08, aiPrompt: '展示主角的生活、缺陷和内心深处的需求' },
    { id: 'stc_catalyst', label: '催化事件', description: '改变一切的事件', position: 12, wordRatio: 0.03, aiPrompt: '发生一个改变主角人生轨迹的重大事件' },
    { id: 'stc_debate', label: '纠结犹豫', description: '主角是否应该行动', position: 15, wordRatio: 0.05, aiPrompt: '主角面对改变犹豫不决，权衡利弊' },
    { id: 'stc_break2', label: '进入第二幕', description: '主角做出选择', position: 25, wordRatio: 0.05, aiPrompt: '主角做出关键选择，进入"颠倒的世界"' },
    { id: 'stc_bstory', label: 'B故事线', description: '引入爱情线或导师线', position: 30, wordRatio: 0.05, aiPrompt: '引入次要故事线（通常是爱情或友情），承载主题' },
    { id: 'stc_fun', label: '游戏时间', description: '展示"概念的承诺"', position: 35, wordRatio: 0.15, aiPrompt: '充分展现故事概念的魅力，这是读者"买票想看的内容"' },
    { id: 'stc_midpoint', label: '中点', description: '虚假胜利或虚假失败', position: 50, wordRatio: 0.05, aiPrompt: '中点转折——虚假胜利（后面会变糟）或虚假失败（后面会好转）' },
    { id: 'stc_bad', label: '反派逼近', description: '反派加强攻势', position: 55, wordRatio: 0.10, aiPrompt: '反派势力加强，内部矛盾激化，形势急转直下' },
    { id: 'stc_alllost', label: '一切尽失', description: '最低谷', position: 75, wordRatio: 0.05, aiPrompt: '主角失去一切——朋友、希望、信心，跌入最低谷' },
    { id: 'stc_darksoul', label: '灵魂至暗', description: '放弃前的最后一刻', position: 78, wordRatio: 0.04, aiPrompt: '主角几乎放弃，在绝望中反思，找到继续前进的理由' },
    { id: 'stc_break3', label: '进入第三幕', description: '灵感降临，制定计划', position: 82, wordRatio: 0.05, aiPrompt: '主角获得新的灵感或力量，制定最终计划' },
    { id: 'stc_finale', label: '终幕', description: '运用一切力量达成目标', position: 85, wordRatio: 0.15, aiPrompt: '主角运用第一二幕中获得的一切力量和智慧，面对终极考验' },
    { id: 'stc_final_img', label: '终场画面', description: '展现"之后"的世界', position: 99, wordRatio: 0.05, aiPrompt: '用一个画面展现主角改变后的状态，与开场画面形成对照' },
  ],
};

const FIVE_ACT: BeatSheetTemplate = {
  id: 'five-act',
  name: '五幕剧结构',
  description: '莎士比亚式经典五幕结构',
  icon: '🎭',
  suitableFor: '文学小说、历史小说、戏剧性强的作品',
  beats: [
    { id: '5a_exposition', label: '第一幕：阐述', description: '背景介绍，人物登场，初始冲突', position: 0, wordRatio: 0.15, aiPrompt: '建立故事世界，介绍主要角色和他们之间的关系，暗示核心冲突' },
    { id: '5a_rising', label: '第二幕：上升', description: '冲突升级，情节复杂化', position: 20, wordRatio: 0.20, aiPrompt: '情节层层递进，冲突不断升级，新的障碍和人物登场' },
    { id: '5a_climax', label: '第三幕：高潮', description: '转折点，不可逆的决定', position: 45, wordRatio: 0.20, aiPrompt: '故事达到最高潮，主角做出不可逆转的决定，命运在此刻改变' },
    { id: '5a_falling', label: '第四幕：下降', description: '后果显现，走向结局', position: 70, wordRatio: 0.25, aiPrompt: '高潮的后果逐渐显现，所有情节线开始收束，走向不可避免的结局' },
    { id: '5a_denouement', label: '第五幕：收场', description: '所有矛盾解决，秩序重建', position: 90, wordRatio: 0.20, aiPrompt: '所有矛盾获得解决，新的秩序建立，角色命运尘埃落定' },
  ],
};

const WANGWEN_STRUCTURE: BeatSheetTemplate = {
  id: 'wangwen',
  name: '网文黄金结构',
  description: '适合连载网文的高频爽点结构',
  icon: '📱',
  suitableFor: '网文、轻小说、爽文',
  beats: [
    { id: 'ww_hook', label: '黄金三章', description: '开头三章必须抓住读者：金手指+冲突+爽点', position: 0, wordRatio: 0.05, aiPrompt: '开篇快速建立主角处境、展示金手指/系统、制造第一个爽点' },
    { id: 'ww_origin', label: '身世铺垫', description: '主角身世之谜和初始实力', position: 5, wordRatio: 0.08, aiPrompt: '铺垫主角的特殊身世、初始实力和成长潜力' },
    { id: 'ww_smallboss1', label: '小高潮1：立威', description: '打脸第一个反派，确立地位', position: 12, wordRatio: 0.08, aiPrompt: '主角击败第一个对手，展现实力，周围人刮目相看' },
    { id: 'ww_upgrade1', label: '第一次升级', description: '获得新能力/新装备/新境界', position: 20, wordRatio: 0.05, aiPrompt: '主角完成第一次重大升级，实力显著提升' },
    { id: 'ww_faction', label: '势力扩张', description: '组建团队或加入组织', position: 25, wordRatio: 0.10, aiPrompt: '主角开始组建自己的势力或加入更大的组织' },
    { id: 'ww_midboss', label: '中期大战', description: '面对中级BOSS的生死之战', position: 40, wordRatio: 0.10, aiPrompt: '主角面对实力远超自己的中期BOSS，险胜或获得突破' },
    { id: 'ww_secret', label: '秘密揭示', description: '世界观/身世的重大揭秘', position: 50, wordRatio: 0.08, aiPrompt: '揭示一个改变主角认知的重大秘密' },
    { id: 'ww_setback', label: '重大挫折', description: '主角遭遇重创', position: 60, wordRatio: 0.08, aiPrompt: '主角遭遇重大挫折，失去重要的人或物' },
    { id: 'ww_comeback', label: '绝境逆袭', description: '在绝境中爆发', position: 70, wordRatio: 0.10, aiPrompt: '主角在绝境中爆发出前所未有的力量，完成逆袭' },
    { id: 'ww_finalboss', label: '终极大战', description: '面对最终BOSS', position: 85, wordRatio: 0.15, aiPrompt: '主角集结所有力量，与最终BOSS展开终极对决' },
    { id: 'ww_ending', label: '大结局', description: '收束所有剧情线', position: 95, wordRatio: 0.13, aiPrompt: '所有悬念解开，感情线收束，展望主角的未来' },
  ],
};

// ═══ 模板注册 ═══

export const BEAT_SHEET_TEMPLATES: BeatSheetTemplate[] = [
  THREE_ACT,
  HERO_JOURNEY,
  SAVE_THE_CAT,
  QICHENGZHUANHE,
  FIVE_ACT,
  WANGWEN_STRUCTURE,
];

/**
 * 根据当前小说的进度，检测最匹配的 Beat 位置
 */
export function detectCurrentBeat(
  template: BeatSheetTemplate,
  currentPosition: number, // 0-100 (当前字数/目标字数 * 100)
): { current: BeatSheetBeat | null; next: BeatSheetBeat | null; progress: number } {
  const beats = [...template.beats].sort((a, b) => a.position - b.position);

  let currentBeat: BeatSheetBeat | null = null;
  let nextBeat: BeatSheetBeat | null = null;

  for (let i = 0; i < beats.length; i++) {
    if (currentPosition >= beats[i].position) {
      currentBeat = beats[i];
      nextBeat = i + 1 < beats.length ? beats[i + 1] : null;
    }
  }

  return {
    current: currentBeat,
    next: nextBeat,
    progress: currentPosition / 100,
  };
}

/**
 * 为 AI 生成大纲驱动写作的提示词
 */
export function buildBeatDrivenPrompt(
  template: BeatSheetTemplate,
  beat: BeatSheetBeat,
  novelSynopsis: string,
  previousBeatContent?: string,
): string {
  const parts: string[] = [];
  parts.push(`你正在按照"${template.name}"结构写作。`);
  parts.push(`当前拍点：【${beat.label}】— ${beat.description}`);
  parts.push('');

  if (novelSynopsis) {
    parts.push(`小说简介：${novelSynopsis.slice(0, 300)}`);
  }

  if (previousBeatContent) {
    parts.push(`\n前一拍点的内容摘要：\n${previousBeatContent.slice(0, 500)}`);
  }

  parts.push(`\n请求：${beat.aiPrompt}`);
  parts.push('\n直接输出小说正文，不要添加额外说明。保持文风一致，情节流畅。');

  return parts.join('\n');
}

/**
 * 根据模板和目标字数，生成章节大纲建议
 */
export function generateOutlineFromTemplate(
  template: BeatSheetTemplate,
  totalWordGoal: number,
): { beatId: string; title: string; wordGoal: number; outline: string }[] {
  return template.beats.map(beat => ({
    beatId: beat.id,
    title: beat.label,
    wordGoal: Math.round(totalWordGoal * beat.wordRatio),
    outline: `${beat.description}\n\n${beat.aiPrompt}`,
  }));
}
