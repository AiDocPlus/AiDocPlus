/**
 * 示例小说数据 —《断剑山庄》
 * 武侠·悬疑，3卷9章，8角色，完整设定集
 */
import type { NovelDocumentContent } from './types';

let _id = 1000;
function did(p: string) { return `demo_${p}_${_id++}`; }

export function createDemoNovelContent(): NovelDocumentContent {
  _id = 1000;
  // 预生成 ID
  const cLu = did('c'); const cLiu = did('c'); const cZhao = did('c'); const cZhou = did('c');
  const cLeng = did('c'); const cFang = did('c'); const cShen = did('c'); const cXiao = did('c');
  const loc1 = did('l'); const loc2 = did('l'); const loc3 = did('l');
  const loc4 = did('l'); const loc5 = did('l'); const loc6 = did('l');
  const fac1 = did('f'); const fac2 = did('f');
  const pl1 = did('p'); const pl2 = did('p'); const pl3 = did('p');
  const v1 = did('v'); const v2 = did('v'); const v3 = did('v');
  const ch1 = did('h'); const ch2 = did('h'); const ch3 = did('h');
  const ch4 = did('h'); const ch5 = did('h'); const ch6 = did('h');
  const ch7 = did('h'); const ch8 = did('h'); const ch9 = did('h');

  // 模拟30天写作统计
  const dailyStats: { date: string; words: number }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const words = isWeekend ? 2000 + Math.floor(Math.random() * 1500) : 800 + Math.floor(Math.random() * 700);
    dailyStats.push({ date: d.toISOString().slice(0, 10), words });
  }

  const deadline = new Date(now); deadline.setMonth(deadline.getMonth() + 6);

  return {
    version: 1,
    settings: {
      genre: '武侠·悬疑', era: '明朝永乐年间', style: '金庸式古典武侠',
      synopsis: '断剑山庄少庄主陆青云，幼年目睹灭门惨案后隐修十年。重出江湖后，他发现当年的灭门真相远比想象中复杂——武林盟主赵无极正是幕后主谋。在青梅竹马柳含烟、神秘杀手冷月等人的帮助下，陆青云一步步揭开尘封二十年的真相，最终在秘谷中与赵无极展开宿命对决。',
      worldView: '明朝永乐年间，武林以武林盟为正道领袖，下辖十三大门派。断剑山庄原为十三大门派之首，灭门后武林格局大变。\n\n武学分外功、内功、轻功、暗器四类。断剑山庄的「断剑诀」被誉为天下第一剑法，精髓在于"以意驭剑"。',
      outlineGlobal: '## 三幕结构\n\n### 第一幕（第1-3章）：旧案重提\n陆青云重返断剑山庄，发现密室线索，确认赵无极是灭门主谋。\n\n### 第二幕（第4-6章）：江湖暗涌\n在锦绣客栈收集情报，与冷月结盟，赵无极发出邀请。\n\n### 第三幕（第7-9章）：真相与抉择\n赴武林盟总舵，冷月发现身世，秘谷最终对决。',
      historicalBackground: '明朝永乐年间，靖难之役后天下初定。武林中人借修武之名暗中积蓄势力，朝廷与江湖关系微妙复杂。',
      characters: [
        { id: cLu, name: '陆青云', aliases: ['青云', '陆公子'], role: 'protagonist', description: '断剑山庄遗孤，沉稳内敛', gender: '男', age: '25', appearance: '身材修长，面容清俊，常着青衫，腰悬半截断剑', personality: '内敛坚毅，重情重义', background: '五岁目睹灭门，被老周救出，翠微山学艺十年', motivation: '查明真相，为父母报仇', arc: '从隐忍复仇到领悟断剑真意', strengths: '剑法精妙，观察力敏锐', weaknesses: '过于执着复仇', dialogueStyle: '言简意赅，偶有古风雅韵', sortOrder: 0, color: '#3b82f6' },
        { id: cLiu, name: '柳含烟', aliases: ['含烟'], role: 'supporting', description: '陆青云青梅竹马，精通医术', gender: '女', age: '24', appearance: '容貌秀丽，素白衣裙，腰悬药囊', personality: '温婉聪慧，外柔内刚', background: '断剑山庄管家之女，灭门后被临安柳氏收养', motivation: '守护陆青云，查明身世秘密', arc: '从被动等待到主动介入', dialogueStyle: '温和有礼，遇不公时尖锐果断', sortOrder: 1, color: '#ec4899' },
        { id: cZhao, name: '赵无极', aliases: ['赵盟主'], role: 'antagonist', description: '武林盟主，灭门案主谋', gender: '男', age: '50', appearance: '银发如瀑，面容威严，常穿玄色锦袍', personality: '城府极深，善于伪装', background: '出身寒微，设计灭门断剑山庄以夺断剑诀', motivation: '维护盟主地位，消灭威胁', arc: '从伪善者被逐步揭穿', dialogueStyle: '言辞优雅从容，暗含威压', sortOrder: 2, color: '#ef4444' },
        { id: cZhou, name: '老周', aliases: ['周叔'], role: 'supporting', description: '断剑山庄老仆，忠心耿耿', gender: '男', age: '60', appearance: '佝偻老者，左脸长疤', personality: '忠心沉默，为护少主不惜一切', background: '原山庄护院总管，灭门夜拼死救出幼年陆青云', motivation: '保护陆青云，交出关键证物', dialogueStyle: '朴实无华，偶有深意', sortOrder: 3, color: '#6b7280' },
        { id: cLeng, name: '冷月', aliases: ['暗影'], role: 'supporting', description: '神秘杀手，身世成谜', gender: '女', age: '22', appearance: '黑衣银面纱，身形纤细', personality: '冷峻寡言，内心矛盾', background: '自幼被武林盟暗部收养训练，实为断剑山庄遗孤', motivation: '完成任务求自由，后转向帮助陆青云', arc: '从冷血杀手到发现身世真相', dialogueStyle: '极其简洁，偶尔流露脆弱', sortOrder: 4, color: '#8b5cf6' },
        { id: cFang, name: '方正一', aliases: ['方掌柜'], role: 'minor', description: '锦绣客栈掌柜，消息灵通', gender: '男', age: '40', personality: '圆滑世故但有侠义心', dialogueStyle: '油嘴滑舌，爱说江湖切口', sortOrder: 5, color: '#f97316' },
        { id: cShen, name: '沈万山', aliases: ['沈护法'], role: 'supporting', description: '武林盟左护法，赵无极干将', gender: '男', age: '45', personality: '对赵无极愚忠，手段狠辣', dialogueStyle: '粗犷直接', sortOrder: 6, color: '#dc2626' },
        { id: cXiao, name: '小翠', aliases: [], role: 'minor', description: '客栈侍女，冷月安插的眼线', gender: '女', age: '18', personality: '机灵活泼', dialogueStyle: '天真活泼', sortOrder: 7, color: '#22c55e' },
      ],
      characterRelations: [
        { id: did('r'), fromId: cLu, toId: cLiu, type: '青梅竹马', label: '互有情愫', bidirectional: true },
        { id: did('r'), fromId: cLu, toId: cZhou, type: '主仆', label: '亦师亦友' },
        { id: did('r'), fromId: cLu, toId: cZhao, type: '仇敌', label: '不共戴天' },
        { id: did('r'), fromId: cZhao, toId: cShen, type: '主从', label: '忠心部下' },
        { id: did('r'), fromId: cLeng, toId: cLu, type: '盟友', label: '从敌到友', bidirectional: true },
        { id: did('r'), fromId: cLeng, toId: cXiao, type: '主从', label: '暗线联络' },
      ],
      locations: [
        { id: loc1, name: '断剑山庄', description: '曾经江南第一庄，灭门后沦为废墟', type: '废墟', atmosphere: '荒凉萧瑟', significance: '隐藏密室和断剑诀残卷', sortOrder: 0, tags: ['主场景'] },
        { id: loc2, name: '锦绣客栈', description: '临安城最大客栈，江湖人士汇聚之地', type: '客栈', atmosphere: '热闹喧嚣', significance: '信息中转站', sortOrder: 1, tags: ['主场景'] },
        { id: loc3, name: '武林盟总舵', description: '天目山巅的宏伟建筑群', type: '山寨', atmosphere: '庄严肃穆', significance: '权力中枢', sortOrder: 2 },
        { id: loc4, name: '秘谷', description: '天目山深处幽谷，极少人知入口', type: '山谷', atmosphere: '幽静神秘', significance: '最终对决之地', sortOrder: 3 },
        { id: loc5, name: '临安城', description: '南宋故都，繁华江南大城', type: '城市', atmosphere: '繁华但暗流涌动', sortOrder: 4 },
        { id: loc6, name: '翠微山', description: '陆青云师父隐居之地', type: '山林', atmosphere: '清幽宁静', sortOrder: 5 },
      ],
      factions: [
        { id: fac1, name: '断剑山庄', description: '曾经的江南第一武林世家，已灭门', memberIds: [cLu, cLiu, cZhou, cLeng], leader: cLu, type: '武林世家', goal: '查明真相，重振山庄', color: '#3b82f6', sortOrder: 0 },
        { id: fac2, name: '武林盟', description: '统领江湖正道的最高组织', memberIds: [cZhao, cShen, cFang, cXiao, cLeng], leader: cZhao, type: '武林组织', goal: '巩固权力', color: '#ef4444', sortOrder: 1 },
      ],
      foreshadowing: [
        { id: did('fs'), content: '断剑剑身上的神秘铭文是打开密室的钥匙', chapterId: ch1, status: 'open', note: '第三章已部分揭示' },
        { id: did('fs'), content: '老周左脸伤疤形状诡异，实为断剑诀剑气所伤', chapterId: ch2, status: 'open', note: '暗示凶手身份' },
        { id: did('fs'), content: '柳含烟的玉佩与断剑山庄信物吻合', chapterId: ch2, status: 'open', note: '身份比她自己知道的更重要' },
        { id: did('fs'), content: '冷月反复梦到燃烧的大宅', chapterId: ch5, status: 'resolved', resolvedChapterId: ch7, note: '冷月就是山庄遗孤' },
        { id: did('fs'), content: '方正一提到二十年前穿玄色锦袍的年轻人', chapterId: ch4, status: 'resolved', resolvedChapterId: ch6, note: '那人就是年轻时的赵无极' },
        { id: did('fs'), content: '密室中的武林盟令牌残片', chapterId: ch3, status: 'abandoned', note: '改用其他线索推进' },
      ],
      materials: [
        { id: did('m'), title: '断剑山庄月夜描写', category: 'scene', content: '月色如水，洒在断壁残垣之上。空气中似乎还残留着当年的血腥味——又或许那只是记忆的幻觉。', createdAt: Date.now() - 86400000 * 20 },
        { id: did('m'), title: '陆青云与柳含烟重逢对话', category: 'dialogue', content: '「二十年了。」陆青云低声说。\n「是啊，二十年。」柳含烟轻轻笑了笑，「你还是那么不爱说话。」', createdAt: Date.now() - 86400000 * 15 },
        { id: did('m'), title: '赵无极的权术哲学', category: 'inspiration', content: '赵无极真心相信灭门是"必要之恶"。他不是纯粹的恶人，而是被权力腐蚀的理想主义者。', createdAt: Date.now() - 86400000 * 10 },
        { id: did('m'), title: '秘谷对决创意', category: 'plot', content: '最终对决不是武力对抗。断剑不是断敌之剑，而是断自己心中的执念。', createdAt: Date.now() - 86400000 * 5 },
      ],
      timeline: [
        { id: did('t'), title: '断剑山庄灭门', date: '永乐三年正月十五', sortOrder: 0, importance: 'turning-point', characterIds: [cZhao, cLu], locationId: loc1 },
        { id: did('t'), title: '老周救出幼年陆青云', date: '永乐三年正月十五夜', sortOrder: 1, importance: 'major', characterIds: [cZhou, cLu] },
        { id: did('t'), title: '陆青云拜师翠微山', date: '永乐三年三月', sortOrder: 2, importance: 'major', characterIds: [cLu], locationId: loc6 },
        { id: did('t'), title: '赵无极当选武林盟主', date: '永乐五年', sortOrder: 3, importance: 'major', characterIds: [cZhao], locationId: loc3 },
        { id: did('t'), title: '冷月被暗部收养', date: '永乐三年二月', sortOrder: 4, importance: 'minor', characterIds: [cLeng] },
        { id: did('t'), title: '柳含烟在临安开药堂', date: '永乐十八年', sortOrder: 5, importance: 'minor', characterIds: [cLiu], locationId: loc5 },
        { id: did('t'), title: '陆青云下山重返江湖', date: '永乐二十三年春', sortOrder: 6, importance: 'turning-point', characterIds: [cLu] },
        { id: did('t'), title: '陆青云重返断剑山庄', date: '永乐二十三年三月', sortOrder: 7, importance: 'major', characterIds: [cLu, cZhou], locationId: loc1, chapterIds: [ch1] },
        { id: did('t'), title: '锦绣客栈交锋', date: '永乐二十三年四月', sortOrder: 8, importance: 'major', characterIds: [cLu, cLeng, cShen], locationId: loc2, chapterIds: [ch5] },
        { id: did('t'), title: '秘谷对决', date: '永乐二十三年五月', sortOrder: 9, importance: 'turning-point', characterIds: [cLu, cZhao], locationId: loc4, chapterIds: [ch8] },
      ],
      plotlines: [
        { id: pl1, title: '主线·复仇真相', color: '#3b82f6', sortOrder: 0, description: '陆青云查明灭门真相、对抗武林盟' },
        { id: pl2, title: '感情线·青云与含烟', color: '#ec4899', sortOrder: 1, description: '二十年后重逢的感情发展' },
        { id: pl3, title: '暗线·冷月身世', color: '#8b5cf6', sortOrder: 2, description: '冷月从杀手到发现身世真相' },
      ],
      worldRules: '武学四境：入门→精通→宗师→天人。天人境界全天下不超五人。\n\n灭门之仇不共戴天，江湖人有义务协助。',
      worldGeography: '临安城（杭州）为江南武林中心，天目山为武林盟总舵所在，翠微山为隐士聚居地。',
      worldCulture: '以武会友，点到即止。药堂在江湖中中立不受侵犯。',
    },
    volumes: buildVolumes(v1, v2, v3, ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ch9, cLu, cLiu, cZhao, cZhou, cLeng, cFang, cShen, loc1, loc2, loc3, loc4, loc5, pl1, pl2, pl3),
    metadata: {
      dailyGoal: 2000, totalGoal: 200000, deadline: deadline.toISOString().slice(0, 10),
      chapterDefaultGoal: 3000,
      dailyWordStats: dailyStats,
      writingSessions: [
        { date: dailyStats[25]?.date || '', startTime: Date.now() - 86400000 * 4, endTime: Date.now() - 86400000 * 4 + 3600000, wordsWritten: 1200 },
        { date: dailyStats[26]?.date || '', startTime: Date.now() - 86400000 * 3, endTime: Date.now() - 86400000 * 3 + 5400000, wordsWritten: 2100 },
        { date: dailyStats[27]?.date || '', startTime: Date.now() - 86400000 * 2, endTime: Date.now() - 86400000 * 2 + 2700000, wordsWritten: 900 },
        { date: dailyStats[28]?.date || '', startTime: Date.now() - 86400000, endTime: Date.now() - 86400000 + 4800000, wordsWritten: 1800 },
        { date: dailyStats[29]?.date || '', startTime: Date.now() - 3600000, endTime: Date.now(), wordsWritten: 600 },
      ],
      milestones: [
        { id: did('ms'), label: '5万字', targetWords: 50000, reached: false },
        { id: did('ms'), label: '10万字', targetWords: 100000, reached: false },
        { id: did('ms'), label: '完稿20万字', targetWords: 200000, reached: false },
      ],
    },
  };
}

function buildVolumes(
  v1: string, v2: string, v3: string,
  ch1: string, ch2: string, ch3: string, ch4: string, ch5: string, ch6: string, ch7: string, ch8: string, ch9: string,
  cLu: string, cLiu: string, cZhao: string, cZhou: string, cLeng: string, cFang: string, cShen: string,
  loc1: string, loc2: string, loc3: string, loc4: string, loc5: string,
  pl1: string, pl2: string, pl3: string,
): NovelDocumentContent['volumes'] {
  return [
    // ═══ 第一卷「旧案重提」 ═══
    { id: v1, title: '第一卷 旧案重提', sortOrder: 0, synopsis: '陆青云重返断剑山庄，发现密室线索，确认赵无极是灭门主谋', chapters: [
      { id: ch1, title: '第一章 山庄惊变', sortOrder: 0, content: '', status: 'done' as const, outline: '陆青云月夜重返废墟→发现密室入口→与黑衣人短暂相遇', summary: '陆青云重返断剑山庄废墟，发现密室机关和神秘黑衣人踪迹。', authorNotes: '开篇需要营造悬疑氛围，断剑铭文是全书关键伏笔', wordGoal: 3000, povCharacterId: cLu, sceneType: 'action' as const, colorLabel: '#3b82f6', lastEditedAt: Date.now() - 86400000 * 5, tags: ['开篇', '伏笔'], scenes: [
        { id: did('s'), title: '故地重游', sortOrder: 0, status: 'done' as const, synopsis: '月夜重返断剑山庄废墟', povCharacterId: cLu, locationId: loc1, characterIds: [cLu], sceneType: 'description' as const, plotlineIds: [pl1], tags: ['回忆'], content: `月色如霜，洒在断壁残垣之上。

陆青云立于山庄大门的废墟前，二十年的风霜将曾经气势恢宏的门楼化作了一片瓦砾。门楣上"断剑山庄"四个大字只剩下残缺的"断"和"庄"，在月光下显得格外凄凉。

他缓缓抬起手，抚上门柱上的青苔。指尖触到冰凉的石面时，五岁那年的记忆如潮水般涌来——火光、惨叫、母亲将他推入暗道时绝望的眼神。

「二十年了。」他低声说，声音被夜风吞没。

腰间半截断剑发出一声轻吟，仿佛在回应主人的感慨。这把剑是父亲遗物，断口处至今锋利如新，剑身上刻着细如发丝的铭文，他辨认了十年也只认出寥寥数字。` },
        { id: did('s'), title: '废墟探索', sortOrder: 1, status: 'done' as const, synopsis: '发现脚印和密室入口', povCharacterId: cLu, locationId: loc1, characterIds: [cLu], sceneType: 'action' as const, plotlineIds: [pl1], content: `他穿过倒塌的回廊，脚步极轻，像一只警觉的猫。师父教过他：废墟之中，往往藏着活人。

果然，在后院的一处墙角，他发现了新鲜的脚印。脚印不大，步幅匀称——是一个身手不错的人留下的。脚印延伸到一堵看似完整的墙壁前，消失了。

陆青云蹲下身，指尖拂过墙根的缝隙。一阵若有若无的气流从缝隙中透出，带着一股陈年腐朽和金属的混合气味。

「密室。」他心中一动。断剑山庄建庄百年，他幼年时就听父亲提起过庄中有一处密室，藏着山庄最重要的秘密。但那时他太小，父亲来不及告诉他密室的位置。` },
        { id: did('s'), title: '暗夜惊鸿', sortOrder: 2, status: 'done' as const, synopsis: '与黑衣人（冷月）短暂相遇', povCharacterId: cLu, locationId: loc1, characterIds: [cLu, cLeng], sceneType: 'action' as const, plotlineIds: [pl1, pl3], tags: ['悬念'], content: `一道黑影从墙头掠过，快得像一缕烟。

陆青云右手握住断剑柄，身形暴退三步，背靠一根断柱。他的眼睛在黑暗中锐利如鹰。

黑影在对面的屋脊上停了一瞬——那是一个纤细的身影，一袭黑衣，面覆银色面纱。月光照在面纱上，映出一双冷冽的眼睛。两人对视了不到一个呼吸的时间。然后，黑影消失了。无声无息，仿佛从未出现过。

陆青云慢慢松开剑柄，注意到自己的手心出了一层薄汗——那个人的功夫在他之上。

「是谁？也在找密室的秘密？」他望着空荡荡的屋脊，眉头紧锁。` },
      ] },
      { id: ch2, title: '第二章 旧友来访', sortOrder: 1, content: '', status: 'revised' as const, outline: '临安药堂重逢柳含烟→老周带来武林盟追查消息→玉佩伏笔', summary: '陆青云与柳含烟重逢，老周带来武林盟追踪的警告和柳含烟身世的线索。', wordGoal: 2500, povCharacterId: cLu, sceneType: 'dialogue' as const, colorLabel: '#ec4899', lastEditedAt: Date.now() - 86400000 * 4, tags: ['感情', '伏笔'], scenes: [
        { id: did('s'), title: '药堂重逢', sortOrder: 0, status: 'revised' as const, synopsis: '二十年后在济世药堂重逢', povCharacterId: cLu, locationId: loc5, characterIds: [cLu, cLiu], sceneType: 'dialogue' as const, plotlineIds: [pl1, pl2], colorLabel: '#ec4899', content: `临安城东街的济世药堂，门面不大，但在城中颇有名气。

陆青云推门而入时，一股草药的清香扑面而来。柜台后的年轻女子正低头研磨药材，听到门响抬起头来——一双明亮的眼睛先是惊讶，然后慢慢蓄满了泪水。

「青云哥哥？」柳含烟的声音微微发颤。

「含烟。」他点了点头，不知该说什么。二十年的离别压缩成了两个字。

柳含烟放下药杵，绕过柜台走到他面前。她比记忆中高了许多，容貌秀丽，但眉间多了一抹挥之不去的忧色。

「你瘦了。」她说。「你也长大了。」他说。两人相视片刻，都笑了——笑中带着苦涩。` },
        { id: did('s'), title: '线索与警告', sortOrder: 1, status: 'revised' as const, synopsis: '老周带来武林盟追查消息和玉佩线索', povCharacterId: cLu, locationId: loc5, characterIds: [cLu, cLiu, cZhou], sceneType: 'dialogue' as const, plotlineIds: [pl1, pl2], tags: ['情报', '伏笔'], content: `老周从后门进来时，身上还带着赶路的风尘。

「少主，不好了。」老周的脸色很难看，「有人在查您的行踪。」

陆青云接过老周递来的一块残破布帛。上面画着一个符号——武林盟的暗部标记。

「武林盟？」柳含烟脱口而出，「他们为什么要查青云哥哥？」

老周犹豫了一下，从怀中掏出一枚玉佩，递给柳含烟。「柳姑娘，这枚玉佩……您可认得？」

柳含烟接过玉佩，手指不由自主地颤了一下。这枚玉佩的形制、材质，与她自幼佩戴的那枚几乎一模一样。

「这是……断剑山庄的信物？」她失声道。` },
      ] },
      { id: ch3, title: '第三章 夜探密室', sortOrder: 2, content: '', status: 'draft' as const, outline: '用断剑打开密室→发现竹简、令牌残片、书信→确认赵无极', summary: '三人夜返山庄，用断剑铭文打开密室，发现灭门主谋指向赵无极。', wordGoal: 2500, povCharacterId: cLu, sceneType: 'action' as const, lastEditedAt: Date.now() - 86400000 * 3, tags: ['揭秘', '转折'], scenes: [
        { id: did('s'), title: '密道机关', sortOrder: 0, status: 'draft' as const, synopsis: '用断剑铭文开启密室', povCharacterId: cLu, locationId: loc1, characterIds: [cLu, cLiu, cZhou], sceneType: 'action' as const, plotlineIds: [pl1], content: `三人连夜赶回断剑山庄。陆青云将断剑贴近那面墙壁时，剑身上的铭文忽然发出淡淡的蓝光。光芒顺着墙上肉眼几乎看不见的纹路流动，勾勒出一道门的轮廓。

「果然如此。」他深吸一口气，将断剑插入纹路交汇处的凹槽。石门缓缓打开，露出一条向下延伸的石阶。阶梯两侧镶嵌着夜明珠，发出幽幽的青白色光芒。

石阶尽头是一间不大的石室。室中有一张石桌，桌上整齐地放着三样东西：一卷竹简、一块令牌的残片，以及一封已经泛黄的书信。` },
        { id: did('s'), title: '竹简之谜', sortOrder: 1, status: 'draft' as const, synopsis: '辨认密文，发现灭门主谋', povCharacterId: cLu, locationId: loc1, characterIds: [cLu, cLiu, cZhou], sceneType: 'dialogue' as const, plotlineIds: [pl1], colorLabel: '#ef4444', tags: ['转折'], content: `竹简上的文字是断剑山庄独有的密文，陆青云花了半个时辰才勉强辨认出大意。那是一份记录，记述了二十年前灭门之夜的种种异常——内鬼、暗号、以及一个令人心惊的名字。

陆青云的手开始发抖。

「怎么了？」柳含烟关切地问。他沉默了很久，最终将竹简递给老周。老周看了一眼，苍老的面容瞬间扭曲。

「少主……」老周的声音嘶哑。

「我知道。」陆青云打断他，语气平静得可怕，「武林盟主——赵无极。」` },
      ] },
    ] },

    // ═══ 第二卷「江湖暗涌」 ═══
    { id: v2, title: '第二卷 江湖暗涌', sortOrder: 1, synopsis: '收集情报，与冷月结盟，赵无极发出邀请', chapters: [
      { id: ch4, title: '第四章 锦绣客栈', sortOrder: 0, content: '', status: 'done' as const, outline: '拜访方正一→打听二十年前旧事→冷月与沈万山暗中监视', summary: '在锦绣客栈收集情报，方正一回忆可疑住客，冷月和沈万山暗中监视。', wordGoal: 3000, povCharacterId: cLu, colorLabel: '#f97316', lastEditedAt: Date.now() - 86400000 * 2, tags: ['情报'], scenes: [
        { id: did('s'), title: '百事通方掌柜', sortOrder: 0, status: 'done' as const, synopsis: '来到客栈遇方正一', povCharacterId: cLu, locationId: loc2, characterIds: [cLu, cFang], sceneType: 'description' as const, plotlineIds: [pl1], content: `锦绣客栈的大堂永远是热闹的。方正一站在柜台后面，胖脸上堆满笑容，一边打着算盘一边跟客人搭话。

陆青云挑了角落的位置坐下，要了一壶龙井。方正一的目光不动声色地扫过来——这个年轻人不简单，穿着普通但气度沉凝，腰间那把古怪的断剑更是引人注目。` },
        { id: did('s'), title: '往事追忆', sortOrder: 1, status: 'done' as const, synopsis: '方正一回忆二十年前可疑住客', povCharacterId: cLu, locationId: loc2, characterIds: [cLu, cFang], sceneType: 'dialogue' as const, plotlineIds: [pl1], tags: ['伏笔回收'], content: `「客官面生，第一次来小店？」方正一端着茶壶走过来。

「方掌柜消息灵通，我想打听一件旧事。二十年前，有没有一位穿玄色锦袍的年轻人在此住过？」

方正一续水的手顿了一顿。「有。那人在小店住了三天。第三天夜里出去，第四天一早……断剑山庄就出事了。」` },
        { id: did('s'), title: '暗处的目光', sortOrder: 2, status: 'done' as const, synopsis: '冷月和沈万山暗中监视', povCharacterId: cLeng, locationId: loc2, characterIds: [cLu, cLeng, cShen], sceneType: 'transition' as const, plotlineIds: [pl1, pl3], tags: ['反派视角'], content: `陆青云离开客栈时，没有注意到二楼窗后那双冷冽的眼睛。

冷月收回目光，转身面对房间里的另一个人。「目标出现了。」她说。

沈万山坐在椅子上，手指轻叩扶手：「盟主说了，先不要动手。观察他的目的，找到那份东西。」

「什么东西？」

「断剑诀。」沈万山的眼中闪过贪婪的光，「完整版的断剑诀。」` },
      ] },
      { id: ch5, title: '第五章 杀手之约', sortOrder: 1, content: '', status: 'revised' as const, outline: '冷月主动现身→提出交易→身世悬念', summary: '冷月主动接触陆青云，提出用情报换取身世真相的交易。', wordGoal: 2500, povCharacterId: cLeng, sceneType: 'dialogue' as const, colorLabel: '#8b5cf6', lastEditedAt: Date.now() - 86400000, tags: ['转折', '身世'], scenes: [
        { id: did('s'), title: '月下追踪', sortOrder: 0, status: 'revised' as const, synopsis: '冷月主动现身', povCharacterId: cLeng, locationId: loc2, characterIds: [cLu, cLeng], sceneType: 'dialogue' as const, plotlineIds: [pl1, pl3], content: `冷月的任务很简单：跟踪、监视、伺机夺取断剑诀。但她发现自己做不到。不是因为陆青云太强，而是在跟踪他的这些天里，她看到了让她困惑的东西：他在药堂前的温柔眼神，他对老周的恭敬。

今夜，她决定试探他。月光下，她站在客栈对面的屋脊上，没有隐藏身形。

「是你。」陆青云抬头，「在断剑山庄那晚的黑衣人。」

「你很警觉。」冷月跳下屋脊，落地无声。` },
        { id: did('s'), title: '真假同盟', sortOrder: 1, status: 'revised' as const, synopsis: '冷月提出交易', povCharacterId: cLeng, locationId: loc2, characterIds: [cLu, cLeng], sceneType: 'dialogue' as const, plotlineIds: [pl1, pl3], tags: ['同盟'], content: `「你是武林盟的人。」陆青云说，这不是疑问。

冷月沉默了一瞬：「是。但我想和你做一笔交易。你要查的真相，我可以帮你。作为交换，我要知道我是谁。」

她取下面纱——月光下，那是一张年轻而冷峻的脸。「我只知道我叫冷月，暗部代号'暗影'。我的记忆从八岁开始。在那之前，我只有一个反复出现的梦——一座燃烧的大宅。」

陆青云瞳孔微缩。燃烧的大宅——断剑山庄？` },
      ] },
      { id: ch6, title: '第六章 盟主之邀', sortOrder: 2, content: '', status: 'draft' as const, outline: '赵无极发请帖→各方讨论策略→冷月带来情报', summary: '赵无极发出邀请，陆青云决定赴鸿门宴，各方制定策略。', wordGoal: 2000, povCharacterId: cLu, lastEditedAt: Date.now() - 43200000, tags: ['策略'], scenes: [
        { id: did('s'), title: '请帖', sortOrder: 0, status: 'draft' as const, synopsis: '赵无极发邀请', povCharacterId: cLu, locationId: loc5, characterIds: [cLu, cLiu], sceneType: 'dialogue' as const, plotlineIds: [pl1], content: `一封烫金请帖送到了济世药堂。「武林盟盟主赵无极，敬邀陆公子莅临天目山总舵一叙。」

「这是鸿门宴。」柳含烟说。「当然是。」陆青云淡淡一笑，「所以我要去。」` },
        { id: did('s'), title: '各方盘算', sortOrder: 1, status: 'draft' as const, synopsis: '讨论赴约策略', povCharacterId: cLu, locationId: loc5, characterIds: [cLu, cLiu, cZhou, cLeng], sceneType: 'dialogue' as const, plotlineIds: [pl1, pl3], tags: ['团队'], content: `老周坚决反对：「少主不能去！赵无极那老贼诡计多端——」

「正因如此，我才要去。他邀我上山，说明他还不确定我知道多少。」

冷月从窗外翻入，带来更多情报：「武林盟在暗中调集高手。沈万山已回总舵，还有三个暗部杀手潜伏在天目山周围。」

「三个？」陆青云挑眉。「四个，算上我。」冷月的嘴角微微勾起。

陆青云望着窗外夜色，心中已有了计较。` },
      ] },
    ] },

    // ═══ 第三卷「真相与抉择」 ═══
    { id: v3, title: '第三卷 真相与抉择', sortOrder: 2, synopsis: '赴武林盟总舵，冷月发现身世，秘谷最终对决', chapters: [
      { id: ch7, title: '第七章 总舵风云', sortOrder: 0, content: '', status: 'revised' as const, outline: '登上天目山→棋局暗喻→冷月发现身世', summary: '陆青云赴武林盟与赵无极对弈试探，冷月在暗部密档中发现自己是断剑山庄遗孤。', wordGoal: 3000, povCharacterId: cLu, colorLabel: '#ef4444', lastEditedAt: Date.now() - 28800000, tags: ['高潮', '身世'], scenes: [
        { id: did('s'), title: '天目山上', sortOrder: 0, status: 'revised' as const, synopsis: '登上武林盟总舵', povCharacterId: cLu, locationId: loc3, characterIds: [cLu], sceneType: 'description' as const, plotlineIds: [pl1], content: `天目山总舵依山势而建，层层叠叠，远望如一座盘踞山巅的巨兽。陆青云拾级而上，每一步都踩得从容不迫。沿途的武林盟弟子目光各异——有好奇的，有警惕的，也有隐隐带着同情的。

「陆公子，盟主在听风阁等候多时了。」一名管事恭敬地引路。` },
        { id: did('s'), title: '棋局对弈', sortOrder: 1, status: 'revised' as const, synopsis: '赵无极与陆青云以棋暗喻对弈', povCharacterId: cLu, locationId: loc3, characterIds: [cLu, cZhao], sceneType: 'dialogue' as const, plotlineIds: [pl1], colorLabel: '#ef4444', tags: ['心理战'], content: `赵无极端坐在棋盘前，银发如瀑，面容平静如水。

「陆公子请坐。你父亲当年也爱下棋。」他抬手示意对面蒲团。

陆青云坐下，不接话。赵无极落下一子：「天元。老朽开局喜欢占据中心。」

「我知道。」陆青云也落下一子，紧贴天元，「师父教过我——应对占据中心之人，最好的办法不是对抗，而是围困。」

赵无极的手指微微一滞，随即笑了：「令师真是高见。」` },
        { id: did('s'), title: '冷月的抉择', sortOrder: 2, status: 'revised' as const, synopsis: '冷月在密档中发现身世真相', povCharacterId: cLeng, locationId: loc3, characterIds: [cLeng], sceneType: 'action' as const, plotlineIds: [pl3], colorLabel: '#8b5cf6', tags: ['身世揭秘'], content: `冷月潜入武林盟暗部密档室，在积满灰尘的卷宗中翻找。手指停在一份泛黄的名册上——二十年前的暗部行动记录。

「永乐三年正月十五夜，执行'清风'行动。目标：断剑山庄。收容幸存女婴一名，代号'暗影'。」

冷月的手开始发抖。暗影——那是她在暗部的代号。燃烧的大宅不是梦。那是她的记忆。` },
      ] },
      { id: ch8, title: '第八章 秘谷对决', sortOrder: 1, content: '', status: 'draft' as const, outline: '秘谷雾中交锋→断剑之悟→以破对圆', summary: '陆青云与赵无极在秘谷中最终对决，领悟断剑真意。', wordGoal: 3000, povCharacterId: cLu, sceneType: 'action' as const, lastEditedAt: Date.now() - 7200000, tags: ['高潮', '战斗'], scenes: [
        { id: did('s'), title: '困兽之斗', sortOrder: 0, status: 'draft' as const, synopsis: '雾中交锋', povCharacterId: cLu, locationId: loc4, characterIds: [cLu, cZhao], sceneType: 'action' as const, plotlineIds: [pl1], colorLabel: '#ef4444', content: `秘谷中雾气弥漫，能见度不足十步。赵无极的声音从雾中传来：「年轻人，你以为凭半卷断剑诀就能胜我？」

陆青云闭上眼睛。雾中作战，眼睛反而是累赘。他将断剑竖在身前，以意念感知四周气流变化。

一道凌厉剑气划破浓雾，直取他咽喉。陆青云侧身让过，断剑顺势一划——只听一声轻响，赵无极的锦袍被割出一道口子。

「好剑法。」赵无极的声音终于带上了一丝凝重。` },
        { id: did('s'), title: '断剑之悟', sortOrder: 1, status: 'draft' as const, synopsis: '领悟断剑真意', povCharacterId: cLu, locationId: loc4, characterIds: [cLu, cZhao, cLeng], sceneType: 'action' as const, plotlineIds: [pl1], tags: ['高潮', '领悟'], content: `剑断了。陆青云望着手中只剩剑柄的断剑，忽然笑了。

二十年来他一直在追寻完整——完整的真相、完整的复仇、完整的断剑诀。但此刻他忽然明白了师父临终前的话：「断剑非断，断的是执念。」

他松开剑柄，赤手空拳面对赵无极的惊天一剑。没有剑，但他的双手化作了剑。每一指、每一掌，都带着断剑诀的意韵，却又超越了剑招本身。

这一刻，他真正领悟了断剑诀的真谛——不在于剑，在于心。` },
      ] },
      { id: ch9, title: '第九章 断剑重铸', sortOrder: 2, content: '', status: 'draft' as const, outline: '（仅大纲）真相大白→各方命运→断剑山庄重建', authorNotes: '这一章尚未开始写作，仅有大纲构想。需要处理好每个角色的结局。', wordGoal: 3000, povCharacterId: cLu, lastEditedAt: Date.now() - 3600000, tags: ['结局'], scenes: [
        { id: did('s'), title: '尘埃落定', sortOrder: 0, status: 'draft' as const, synopsis: '（待写）真相公之于众，各方命运交代', povCharacterId: cLu, plotlineIds: [pl1, pl2, pl3], content: `（本场景尚未开始写作）\n\n大纲：\n- 赵无极败亡，真相公之于众\n- 冷月确认身份，加入断剑山庄\n- 陆青云与柳含烟的感情明朗化\n- 断剑山庄在废墟上开始重建` },
      ] },
    ] },
  ];
}
