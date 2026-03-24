/**
 * essayTemplates.ts — 散文写作模板数据
 *
 * Phase 4: 每种散文子类型 2-3 个模板
 * 模板包含：标题、描述、结构框架、预设设置、写作提示
 */

import type { EssaySubtype, EssayMood, MasterStyle } from './types';

export interface EssayTemplate {
  id: string;
  title: string;
  description: string;
  subtype: EssaySubtype;
  mood: EssayMood;
  targetStyle: MasterStyle;
  targetWordCount: number;
  keyImagery: string[];
  theme: string;
  /** 结构框架：按段落提供写作方向提示 */
  skeleton: {
    role: 'open' | 'carry' | 'turn' | 'close';
    label: string;
    prompt: string;
    placeholder: string;
  }[];
  /** 模板缩略预览文字 */
  preview: string;
}

const TEMPLATES: EssayTemplate[] = [
  // ═══ 抒情散文 ═══
  {
    id: 'lyrical-hometown',
    title: '故乡的月色',
    description: '以月色为载体，抒写对故乡的思念与时光流逝的感慨',
    subtype: 'lyrical',
    mood: 'melancholy',
    targetStyle: 'yu-qiuyu',
    targetWordCount: 1500,
    keyImagery: ['月色', '故乡', '老屋', '炊烟'],
    theme: '乡愁与时光',
    skeleton: [
      {
        role: 'open',
        label: '引入·月色初现',
        prompt: '以一个具体的月夜场景开篇，引出对故乡的记忆',
        placeholder: '那轮月亮，从我离开故乡的那天起，就一直挂在记忆深处……',
      },
      {
        role: 'carry',
        label: '承接·故乡往事',
        prompt: '展开对故乡具体场景和人物的回忆，细节要鲜活',
        placeholder: '记忆中的老屋，总在夜里亮着一盏灯……',
      },
      {
        role: 'turn',
        label: '转折·时光变迁',
        prompt: '写现实中故乡的变化与心中故乡的落差，引发更深思考',
        placeholder: '再回故乡时，那棵老槐树已不见了踪影……',
      },
      {
        role: 'close',
        label: '收束·月是故乡明',
        prompt: '以月色作结，升华乡愁的主题，留有余味',
        placeholder: '月色从未变过，变的只是漂泊的心……',
      },
    ],
    preview: '以月色贯穿全文，通过老屋、炊烟、老槐树等具体意象，编织出一幅乡愁图景……',
  },
  {
    id: 'lyrical-letter',
    title: '一封给时光的信',
    description: '以书信体抒发对已逝时光的留恋，语调温柔而悠远',
    subtype: 'lyrical',
    mood: 'warm',
    targetStyle: 'bing-xin',
    targetWordCount: 1200,
    keyImagery: ['信纸', '旧照片', '夏天', '少年'],
    theme: '时光·青春',
    skeleton: [
      {
        role: 'open',
        label: '引入·提笔写信',
        prompt: '以"亲爱的时光"或类似称谓起笔，营造书信氛围',
        placeholder: '亲爱的时光，当我提起这支笔的时候……',
      },
      {
        role: 'carry',
        label: '承接·往日细节',
        prompt: '列举三五个具体的往日场景，每个都要有感官细节',
        placeholder: '记得那个夏天的午后，知了叫个不停……',
      },
      {
        role: 'turn',
        label: '转折·人事已非',
        prompt: '写那些已经改变或消逝的人与事，引出思考',
        placeholder: '那些人还好吗？那条小路是否还在……',
      },
      {
        role: 'close',
        label: '收束·与时光和解',
        prompt: '以一种平和而感恩的态度作结，不留遗憾',
        placeholder: '谢谢你，时光。谢谢你留下的，也谢谢你带走的……',
      },
    ],
    preview: '书信体抒情散文，以温柔笔调与时光对话，追忆青春往事……',
  },

  // ═══ 叙事散文 ═══
  {
    id: 'narrative-father',
    title: '父亲的背影',
    description: '致敬朱自清，以父亲的某个具体动作或细节为核心，写父子深情',
    subtype: 'narrative',
    mood: 'warm',
    targetStyle: 'zhu-ziqing',
    targetWordCount: 1800,
    keyImagery: ['背影', '手', '皱纹', '老照片'],
    theme: '父子深情',
    skeleton: [
      {
        role: 'open',
        label: '引入·定格背影',
        prompt: '从一个具体的场景或动作切入，直接描写父亲的背影或某个细节',
        placeholder: '那个背影，在我脑海中已存了二十年……',
      },
      {
        role: 'carry',
        label: '承接·往事叙述',
        prompt: '按时间顺序叙述与父亲相关的几个典型故事，用细节说话',
        placeholder: '父亲不善言辞，他的爱藏在那些细小的举动里……',
      },
      {
        role: 'turn',
        label: '转折·距离与理解',
        prompt: '写曾经的隔阂或误解，以及后来的理解与感恩',
        placeholder: '年少时我不懂他的沉默，总以为是冷漠……',
      },
      {
        role: 'close',
        label: '收束·背影永存',
        prompt: '回到开篇的背影意象，完成情感的升华',
        placeholder: '如今，我也开始懂得了那个背影的重量……',
      },
    ],
    preview: '以背影为核心意象，通过细腻叙事展现父子情深，质朴中见深情……',
  },
  {
    id: 'narrative-street',
    title: '老街记忆',
    description: '记录一条即将消逝或已经消逝的老街，以街道为经，人事为纬',
    subtype: 'narrative',
    mood: 'melancholy',
    targetStyle: 'wang-zengqi',
    targetWordCount: 2000,
    keyImagery: ['青石板', '老招牌', '茶馆', '剃头匠'],
    theme: '城市记忆·消逝',
    skeleton: [
      {
        role: 'open',
        label: '引入·街道初貌',
        prompt: '用几笔勾勒老街的整体印象，时间可以是现在或过去',
        placeholder: '那条街叫什么名字，我已记不清了……',
      },
      {
        role: 'carry',
        label: '承接·街上的人',
        prompt: '重点写街上的几个典型人物，每人一两个细节',
        placeholder: '街头的剃头匠王大爷，每天早上准时开张……',
      },
      {
        role: 'turn',
        label: '转折·时代的痕迹',
        prompt: '写城市改造或时代变迁给这条街带来的变化',
        placeholder: '那一年，推土机开进来，什么都没了……',
      },
      {
        role: 'close',
        label: '收束·记忆留存',
        prompt: '表达对老街的珍重与告别，留下记忆的重量',
        placeholder: '街已不在，但它住在所有曾经走过它的人心里……',
      },
    ],
    preview: '以老街为舞台，以人物为主角，记录一段即将消逝的市井记忆……',
  },

  // ═══ 议论散文 ═══
  {
    id: 'argumentative-reading',
    title: '论读书',
    description: '谈读书的意义与方法，观点鲜明，论据充分，语言雅致',
    subtype: 'argumentative',
    mood: 'serene',
    targetStyle: 'free',
    targetWordCount: 1500,
    keyImagery: ['书页', '灯光', '窗', '时间'],
    theme: '读书·成长',
    skeleton: [
      {
        role: 'open',
        label: '引入·读书之问',
        prompt: '以一个关于读书的问题或现象引入，引发读者思考',
        placeholder: '有人问，在这个信息爆炸的时代，我们为什么还要读书？',
      },
      {
        role: 'carry',
        label: '承接·读书之益',
        prompt: '从几个维度论述读书的价值，可引用名人名言',
        placeholder: '读书，是一场与古今智者的对话……',
      },
      {
        role: 'turn',
        label: '转折·读书之法',
        prompt: '提出自己对读书方法的见解，避免泛泛而谈',
        placeholder: '然而，读书非多益善，选书亦是一门学问……',
      },
      {
        role: 'close',
        label: '收束·读书之境',
        prompt: '以一种诗意的方式收尾，点明读书的最高境界',
        placeholder: '最好的读书，是让书中的光照进你的生命……',
      },
    ],
    preview: '以议论为主，散文笔法，探讨读书在当代的意义与方法……',
  },

  // ═══ 游记散文 ═══
  {
    id: 'travel-jiangnan',
    title: '江南烟雨',
    description: '描写江南的烟雨风情，山水人文融为一体',
    subtype: 'travel',
    mood: 'melancholy',
    targetStyle: 'yu-qiuyu',
    targetWordCount: 2000,
    keyImagery: ['烟雨', '乌篷船', '白墙', '青苔'],
    theme: '江南水乡',
    skeleton: [
      {
        role: 'open',
        label: '引入·初见烟雨',
        prompt: '以到达江南的第一印象开篇，抓住最典型的视觉细节',
        placeholder: '江南的雨，是有温度的……',
      },
      {
        role: 'carry',
        label: '承接·游览所见',
        prompt: '按游览顺序描写几处典型景致，每处突出一个特点',
        placeholder: '小巷深处，一扇半开的木门，漏出几声琴声……',
      },
      {
        role: 'turn',
        label: '转折·历史人文',
        prompt: '融入江南的历史文化背景，让景物有了时间的厚度',
        placeholder: '这片水土，曾养育了多少文人墨客……',
      },
      {
        role: 'close',
        label: '收束·烟雨离情',
        prompt: '以离别或回望的方式作结，留下对江南的深情',
        placeholder: '离开的那天，又下起了雨。我知道，江南留住了我一部分的魂……',
      },
    ],
    preview: '以烟雨为笔，描绘江南水乡的诗情画意，历史与自然交融……',
  },
  {
    id: 'travel-northwest',
    title: '西北行记',
    description: '记录西北大漠戈壁之旅，写苍茫壮阔与内心震撼',
    subtype: 'travel',
    mood: 'heroic',
    targetStyle: 'shi-tiesheng',
    targetWordCount: 2000,
    keyImagery: ['大漠', '胡杨', '夕阳', '骆驼'],
    theme: '苍茫·壮阔',
    skeleton: [
      {
        role: 'open',
        label: '引入·进入荒漠',
        prompt: '描写第一次见到西北大漠时的震撼感受',
        placeholder: '当公路两旁的绿色渐渐消失，我知道，西北到了……',
      },
      {
        role: 'carry',
        label: '承接·大漠风物',
        prompt: '描写西北特有的景观和人文，如胡杨林、古城、当地人',
        placeholder: '胡杨站在戈壁上，千年不死，千年不倒……',
      },
      {
        role: 'turn',
        label: '转折·内心触动',
        prompt: '写大漠的苍凉如何触动了你对生命或人生的思考',
        placeholder: '在这片广袤面前，我忽然觉得自己的烦恼如此渺小……',
      },
      {
        role: 'close',
        label: '收束·西北归来',
        prompt: '以回望或心灵蜕变作结，表达这段旅途的深远影响',
        placeholder: '从西北回来，我像是换了一个人……',
      },
    ],
    preview: '以苍茫壮阔为底色，写西北行旅对内心的洗涤与震撼……',
  },

  // ═══ 哲理散文 ═══
  {
    id: 'philosophical-leaf',
    title: '落叶的启示',
    description: '由秋天的落叶引发对生命、告别与新生的哲理思考',
    subtype: 'philosophical',
    mood: 'serene',
    targetStyle: 'lin-qingxuan',
    targetWordCount: 1500,
    keyImagery: ['落叶', '秋风', '土地', '新芽'],
    theme: '生命·循环',
    skeleton: [
      {
        role: 'open',
        label: '引入·观叶而思',
        prompt: '从一片具体的落叶写起，自然引入哲思',
        placeholder: '一片叶子从树上落下来，在空中划了一道弧，然后轻轻落地……',
      },
      {
        role: 'carry',
        label: '承接·落叶之道',
        prompt: '展开对落叶这一现象的多角度观察与思考',
        placeholder: '落叶从不哀叹，它只是完成了自己的使命……',
      },
      {
        role: 'turn',
        label: '转折·告别与新生',
        prompt: '将落叶的告别与人生的种种告别相联系',
        placeholder: '人生中也有许多落叶的时刻——离开、失去、结束……',
      },
      {
        role: 'close',
        label: '收束·归于泥土',
        prompt: '以落叶化为泥土滋养新芽作结，完成生命循环的主题',
        placeholder: '落叶归根，不是终结，而是另一种开始……',
      },
    ],
    preview: '以落叶为引，探讨生命的告别与新生，哲理融于自然意象之中……',
  },
  {
    id: 'philosophical-water',
    title: '水的智慧',
    description: '从水的特性中提炼处世哲学，上善若水，以柔克刚',
    subtype: 'philosophical',
    mood: 'serene',
    targetStyle: 'wang-zengqi',
    targetWordCount: 1200,
    keyImagery: ['流水', '山涧', '湖面', '大海'],
    theme: '处世·智慧',
    skeleton: [
      {
        role: 'open',
        label: '引入·水之形态',
        prompt: '描写水在不同形态下的特征，引出思考',
        placeholder: '水没有固定的形状，它是什么容器就是什么形状……',
      },
      {
        role: 'carry',
        label: '承接·水的智慧',
        prompt: '从不争、柔韧、利万物等角度展开水的哲学',
        placeholder: '水往低处流，却滋养了最高处的生命……',
      },
      {
        role: 'turn',
        label: '转折·以水观人',
        prompt: '将水的品质与人的处世之道相对应',
        placeholder: '做人如水，不是软弱，而是一种深邃的智慧……',
      },
      {
        role: 'close',
        label: '收束·上善若水',
        prompt: '呼应老子"上善若水"，收束全文',
        placeholder: '圣人早已说过——上善若水。我在水边，终于读懂了这四个字……',
      },
    ],
    preview: '以水为师，从水的特性中提炼处世哲学，语言洗练而富有禅意……',
  },
];

/** 按子类型获取模板 */
export function getTemplatesBySubtype(subtype: EssaySubtype): EssayTemplate[] {
  return TEMPLATES.filter(t => t.subtype === subtype);
}

/** 获取全部模板 */
export function getAllTemplates(): EssayTemplate[] {
  return TEMPLATES;
}

/** 按 ID 获取单个模板 */
export function getTemplateById(id: string): EssayTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export default TEMPLATES;
