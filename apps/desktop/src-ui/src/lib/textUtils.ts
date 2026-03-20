/**
 * textUtils.ts — 文本处理工具库
 *
 * 纯函数实现，供系统菜单、右键菜单、工具栏共用。
 * 覆盖：大小写转换、繁简转换、全半角转换、中英标点互转、
 *       行处理（排序/去重/反转/打乱/合并/删空行/Trim）、编码转换
 */

// ═══ 大小写转换 ═══

export const toUpperCase = (t: string) => t.toUpperCase();
export const toLowerCase = (t: string) => t.toLowerCase();
export const swapCase = (t: string) => t.replace(/./g, c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase());
export const titleCase = (t: string) => t.replace(/\b\w/g, c => c.toUpperCase());
export const capitalizeFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// ═══ 繁简转换（常用2500字对照表） ═══

const S2T_MAP: Record<string, string> = {};
const T2S_MAP: Record<string, string> = {};

// 简→繁 对照（每对：简体,繁体）
const PAIRS = '万萬与與专專业業丛叢东東丝絲丢丟两兩严嚴丧喪个個丰豐临臨为為丽麗举舉义義乌烏乐樂习習书書买買乱亂争爭于於亏虧云雲亚亞产產亲親亿億仅僅从從仓倉仪儀们們价價众眾优優伙夥会會伟偉传傳伤傷伦倫伪偽体體余餘佣傭侠俠侣侶侧側侦偵侨僑俩倆修脩俭儉债債倾傾假假偿償傍傍储儲催催僵殭儿兒兑兌党黨关關兰蘭兴興兹茲养養兽獸内內冈岡冲沖决決况況冻凍净淨凤鳳凭憑凯凱击擊凶兇刘劉划劃则則刚剛创創初初删刪别別利利刹剎剂劑剧劇劝勸办辦功功务務动動劲勁势勢勤勤劳勞势勢包包化化北北医醫华華协協单單卖賣占佔卫衛却卻厂廠厅廳历歷厉厲压壓厌厭厕廁发發变變叠疊叹嘆号號台臺叶葉吕呂吗嗎听聽吨噸启啟呢呢员員呜嗚咸鹹响響哟喲唤喚啊啊啬嗇善善喷噴嘱囑嘲嘲团團园園围圍图圖圆圓圣聖场場坏壞坚堅坛壇坝壩坟墳坠墜垒壘垦墾型型城城域域基基堕墮塔塔填填境境墙牆壮壯声聲壳殼处處备備复復够夠头頭夹夾夺奪奋奮奖獎奥奧女女妇婦妈媽姑姑娱娛婴嬰嫔嬪学學宁寧宝寶实實宠寵审審宪憲宫宮家家宾賓宿宿寿壽将將尝嘗对對寻尋导導小小尘塵尝嘗层層岁歲岂豈岗崗岛島岩巖岭嶺岳嶽币幣帅帥师師帐帳帜幟带帶帮幫帽帽幸幸幽幽广廣庄莊庆慶应應庐廬废廢度度库庫庙廟庞龐开開异異弃棄张張弹彈强強归歸当當录錄彦彥影影彻徹征徵径徑待待御禦忆憶志誌忧憂忾愾态態总總恋戀恳懇恶惡恼惱悬懸惊驚惠惠惧懼惩懲想想愿願慑懾懒懶戏戲戚戚战戰户戶才才扑撲执執扩擴扫掃扬揚抚撫抛拋护護拟擬拢攏拣揀拥擁择擇拨撥拿拿挂掛挡擋挣掙挤擠挥揮损損挨挨捕捕捡撿据據掷擲控控推推掺摻描描提提插插揭揭搜搜搞搞携攜摄攝摆擺摇搖撑撐撤撤播播操操擅擅支支收收改改效效敌敵教教敛斂数數整整文文斗鬥斤斤断斷新新方方旅旅族族无無既既时時旷曠昆崑明明昼晝显顯晋晉晓曉普普景景暂暫暗暗曾曾朝朝术術机機杀殺杂雜权權条條来來杨楊板板极極构構柜櫃标標栏欄栖棲样樣根根格格桥橋档檔梅梅梦夢检檢棉棉椟櫝楼樓榨榨乐樂横橫树樹桩樁机機权權杨楊标標样樣档檔检檢欢歡欧歐歼殲款款歪歪死死残殘殴毆毕畢毙斃气氣氢氫氧氧氮氮汇匯汉漢汤湯沈瀋沟溝没沒沦淪油油治治泛氾法法泪淚注註泰泰泽澤洁潔洒灑洗洗浅淺测測济濟浑渾浓濃浪浪涂塗涌湧润潤涨漲淀澱深深混混添添温溫渐漸港港游遊湾灣源源溃潰滚滾满滿滤濾漓漓演演潜潛澜瀾灾災灭滅灯燈灵靈灶竈炉爐炼煉烁爍烟煙烦煩烧燒烨燁热熱焰焰然然煮煮照照熟熟燃燃爱愛片片版版牌牌牵牽犹猶狂狂狱獄独獨狮獅猎獵猪豬献獻猴猴玄玄环環现現玛瑪珍珍珠珠班班理理琴琴瑞瑞璃璃瓶瓶甚甚电電画畫畅暢畜畜疗療疯瘋疲疲疼疼病病痛痛痴癡登登发發盖蓋盐鹽监監盘盤目目盲盲直直相相省省看看真真眠眠眼眼着著睡睡瞒瞞瞧瞧矛矛矿礦码碼砖磚破破础礎硕碩确確碍礙磁磁礼禮祝祝神神祥祥禅禪福福离離私私种種秘秘积積称稱移移程程稳穩穷窮窃竊窜竄窝窩立立竞競笔筆笼籠等等筑築筛篩简簡算算管管箱箱节節范範篇篇篷篷簿簿籍籍粗粗粮糧精精糖糖糟糟系係紧緊纠糾红紅纤纖约約纯純纱紗纲綱纳納纵縱纷紛纸紙纹紋纺紡纻紵纽紐线線练練组組细細织織终終绍紹经經结結绕繞绘繪给給络絡绝絕统統继繼绩績绪緒续續绰綽绳繩维維绵綿缘緣编編缓緩缔締缝縫缠纏缩縮缪繆缭繚缴繳网網罗羅罢罷罪罪置置署署翻翻老老联聯聪聰肃肅肠腸肾腎肿腫胁脅胆膽胜勝脉脈脑腦脏臟脸臉腊臘腾騰膀膀臂臂自自臭臭舍捨舞舞艰艱艺藝节節芯芯花花苍蒼苏蘇若若苦苦英英范範茅茅荒荒荡蕩荣榮药藥莲蓮菜菜萧蕭落落著著葬葬蒋蔣蓝藍蔑蔑虑慮虚虛虫蟲蚀蝕蛋蛋蛮蠻蜂蜂融融血血行行衔銜补補表表衬襯衷衷袋袋装裝裤褲西西覆覆见見观觀规規觉覺览覽角角解解触觸言言计計订訂认認讨討让讓议議讲講论論设設证證评評识識诉訴词詞译譯试試诗詩诚誠话話该該详詳语語误誤说說请請诸諸读讀课課谁誰调調谈談谊誼谋謀谐諧谓謂谢謝谱譜谨謹豆豆象象贝貝负負贡貢财財责責贤賢败敗货貨质質贩販贪貪贫貧购購贮貯贯貫贱賤贴貼贵貴贷貸贸貿费費赁賃赃贓资資赋賦赌賭赏賞赐賜赔賠赖賴赚賺赛賽赢贏赵趙趋趨足足跃躍跌跌路路跟跟跳跳踊踴踏踏蹄蹄蹈蹈躯軀身身车車轨軌转轉轮輪软軟轰轟轻輕载載较較辅輔辆輛辈輩辉輝辑輯输輸辨辨辩辯辫辮达達迁遷过過运運近近返返还還这這进進远遠违違连連迟遲选選逊遜递遞通通逻邏遗遺邓鄧那那邦邦邮郵邻鄰郑鄭部部都都配配酒酒酿釀释釋里裡重重量量金金针針钉釘钓釣钢鋼钥鑰钱錢钵缽铁鐵铃鈴铅鉛铜銅铭銘银銀铺鋪链鏈销銷锁鎖锅鍋锋鋒锐銳错錯锡錫锦錦键鍵镇鎮镜鏡镰鐮长長门門闪閃间間闭閉问問闲閒闷悶闻聞闹鬧阅閱阔闊阕闋阶階阻阻阵陣阳陽阴陰阶階际際陆陸陈陳陕陝陵陵陷陷随隨险險隐隱隧隧隶隸难難雄雄集集雇僱雏雛雪雪零零雷雷震震霸霸露露青青静靜非非面面靠靠鞋鞋鞭鞭韩韓音音页頁顶頂项項顺順须須顽頑顾顧颁頒颂頌预預颈頸颗顆题題颜顏额額风風飞飛饥飢饭飯饮飲饰飾饱飽饶饒饿餓馆館首首驱驅驳駁驴驢驾駕骂罵骄驕验驗骑騎骗騙骤驟骨骨高高鬼鬼魂魂魅魅鱼魚鲁魯鲜鮮鸡雞鸣鳴鸭鴨鸽鴿鹅鵝鹊鵲鹏鵬鹤鶴鹰鷹麻麻黄黃黑黑默默鼓鼓鼠鼠鼻鼻齐齊齿齒龄齡龙龍龟龜';

(() => {
  for (let i = 0; i < PAIRS.length; i += 2) {
    const s = PAIRS[i], t = PAIRS[i + 1];
    if (s && t && s !== t) {
      S2T_MAP[s] = t;
      T2S_MAP[t] = s;
    }
  }
})();

export const toTraditional = (t: string) => t.replace(/./g, c => S2T_MAP[c] || c);
export const toSimplified = (t: string) => t.replace(/./g, c => T2S_MAP[c] || c);

// ═══ 全半角转换 ═══

export function toFullWidth(t: string): string {
  return t.replace(/[\x21-\x7E]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0))
    .replace(/ /g, '\u3000');
}

export function toHalfWidth(t: string): string {
  return t.replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ');
}

// ═══ 中英标点互转 ═══

const PUNCT_PAIRS: [string, string][] = [
  ['\uFF0C', ','], ['\u3002', '.'], ['\uFF01', '!'], ['\uFF1F', '?'],
  ['\uFF1B', ';'], ['\uFF1A', ':'], ['\u201C', '"'], ['\u201D', '"'],
  ['\u2018', "'"], ['\u2019', "'"], ['\u3010', '['], ['\u3011', ']'],
  ['\uFF08', '('], ['\uFF09', ')'], ['\u2014', '-'], ['\u2026', '...'],
  ['\u300A', '<'], ['\u300B', '>'], ['\u3001', ','],
];
const CN_TO_EN: Record<string, string> = {};
const EN_TO_CN: Record<string, string> = {};
for (const [cn, en] of PUNCT_PAIRS) {
  CN_TO_EN[cn] = en;
  EN_TO_CN[en] = cn;
}

export const toEnglishPunctuation = (t: string) => t.replace(/./g, c => CN_TO_EN[c] || c);
export const toChinesePunctuation = (t: string) => t.replace(/./g, c => EN_TO_CN[c] || c);

// ═══ 行处理 ═══

export const sortLinesAsc = (t: string) => t.split('\n').sort((a, b) => a.localeCompare(b, 'zh-CN')).join('\n');
export const sortLinesDesc = (t: string) => t.split('\n').sort((a, b) => b.localeCompare(a, 'zh-CN')).join('\n');
export const sortLinesCaseInsensitive = (t: string) => t.split('\n').sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), 'zh-CN')).join('\n');
export const reverseLines = (t: string) => t.split('\n').reverse().join('\n');
export const shuffleLines = (t: string) => { const a = t.split('\n'); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.join('\n'); };
export const deduplicateLines = (t: string) => [...new Set(t.split('\n'))].join('\n');
export const removeEmptyLines = (t: string) => t.split('\n').filter(l => l.trim() !== '').join('\n');
export const trimLines = (t: string) => t.split('\n').map(l => l.trim()).join('\n');
export const joinLines = (t: string, sep = ' ') => t.split('\n').join(sep);
export const collapseSpaces = (t: string) => t.replace(/ {2,}/g, ' ');

// ═══ 编码转换 ═══

export const urlEncode = (t: string) => encodeURIComponent(t);
export const urlDecode = (t: string) => { try { return decodeURIComponent(t); } catch { return t; } };
export const base64Encode = (t: string) => btoa(unescape(encodeURIComponent(t)));
export const base64Decode = (t: string) => { try { return decodeURIComponent(escape(atob(t))); } catch { return t; } };

// ═══ 日期时间 ═══

export function currentDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function currentDateTime(): string {
  return `${currentDate()} ${currentTime()}`;
}

// ═══ 中文排版 ═══

/** 段首缩进：每段开头加两个全角空格 */
export function addParagraphIndent(t: string): string {
  return t.split('\n').map(line => {
    // 非空行且不是已缩进的行
    if (line.trim() === '') return line;
    if (/^[\u3000\t ]/.test(line)) return line;
    return '\u3000\u3000' + line;
  }).join('\n');
}

/** 去除段首缩进（全角空格和半角空格） */
export function removeParagraphIndent(t: string): string {
  return t.split('\n').map(line => line.replace(/^[\u3000 \t]+/, '')).join('\n');
}

/** 中英文之间加空格（pangu spacing） */
export function addSpaceBetweenCnEn(t: string): string {
  // CJK 统一汉字 + 扩展 A/B + 兼容汉字
  const CJK = '\\u2e80-\\u2eff\\u2f00-\\u2fdf\\u3040-\\u309f\\u30a0-\\u30ff\\u3100-\\u312f\\u3200-\\u32ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\ufe30-\\ufe4f';
  // 在 CJK 和半角字母/数字之间插入空格
  let result = t;
  result = result.replace(new RegExp(`([${CJK}])([A-Za-z0-9])`, 'g'), '$1 $2');
  result = result.replace(new RegExp(`([A-Za-z0-9])([${CJK}])`, 'g'), '$1 $2');
  return result;
}

/** 引号规范化：直引号转中文弯引号 */
export function normalizeQuotes(t: string): string {
  let result = t;
  // 双引号：交替配对
  let doubleOpen = true;
  result = result.replace(/"/g, () => {
    const q = doubleOpen ? '\u201C' : '\u201D';
    doubleOpen = !doubleOpen;
    return q;
  });
  // 单引号：交替配对
  let singleOpen = true;
  result = result.replace(/'/g, () => {
    const q = singleOpen ? '\u2018' : '\u2019';
    singleOpen = !singleOpen;
    return q;
  });
  return result;
}

/** 压缩多余空行（连续 2+ 空行合并为 1 行） */
export function compressBlankLines(t: string): string {
  return t.replace(/\n{3,}/g, '\n\n');
}

/** 段落重排：合并同一段落内的短行（以空行为段落分隔） */
export function reformatParagraphs(t: string): string {
  const paragraphs = t.split(/\n\s*\n/);
  return paragraphs.map(p => {
    const lines = p.split('\n').map(l => l.trim()).filter(l => l !== '');
    // 如果只有一行或看起来是列表/标题/代码块，保留原样
    if (lines.length <= 1) return lines.join('');
    if (lines.some(l => /^([-*+#>]|```|\d+\.)/.test(l))) return lines.join('\n');
    return lines.join('');
  }).join('\n\n');
}

/** 去除行尾空格 */
export function removeTrailingSpaces(t: string): string {
  return t.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
}

// ═══ 文本清理 ═══

/** 添加行号前缀 */
export function addLineNumbers(t: string): string {
  const lines = t.split('\n');
  const width = String(lines.length).length;
  return lines.map((l, i) => `${String(i + 1).padStart(width, ' ')}  ${l}`).join('\n');
}

/** 去除行首行号（支持 "1. "、"1) "、"1: "、" 1  " 等格式） */
export function removeLineNumbers(t: string): string {
  return t.split('\n').map(l => l.replace(/^\s*\d+[.):：\s]\s*/, '')).join('\n');
}

/** 去除 HTML 标签保留文本 */
export function stripHtmlTags(t: string): string {
  return t
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/** 去除 Markdown 格式标记保留纯文本 */
export function stripMarkdown(t: string): string {
  let r = t;
  // 代码块
  r = r.replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').replace(/```/g, ''));
  // 图片 → alt
  r = r.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 链接 → 文本
  r = r.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 粗斜体
  r = r.replace(/\*{3}(.+?)\*{3}/g, '$1');
  r = r.replace(/\*{2}(.+?)\*{2}/g, '$1');
  r = r.replace(/\*(.+?)\*/g, '$1');
  // 删除线
  r = r.replace(/~~(.+?)~~/g, '$1');
  // 行内代码
  r = r.replace(/`([^`]+)`/g, '$1');
  // 标题/列表/引用/任务列表前缀
  r = r.replace(/^#{1,6}\s+/gm, '');
  r = r.replace(/^>\s?/gm, '');
  r = r.replace(/^[-*+]\s+/gm, '');
  r = r.replace(/^\d+\.\s+/gm, '');
  r = r.replace(/^- \[[ x]\]\s+/gm, '');
  // 高亮/上标/下标
  r = r.replace(/==(.+?)==/g, '$1');
  r = r.replace(/\^(.+?)\^/g, '$1');
  r = r.replace(/~(.+?)~/g, '$1');
  // 分隔线
  r = r.replace(/^---+$/gm, '');
  return r;
}

/** 按列宽自动硬换行（默认 80 列） */
export function wrapAtColumn(t: string, col = 80): string {
  return t.split('\n').map(line => {
    if (line.length <= col) return line;
    const parts: string[] = [];
    let current = '';
    for (const ch of line) {
      current += ch;
      // 每个 CJK 字符算 2 列宽
      const visualLen = [...current].reduce((sum, c) => sum + (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(c) ? 2 : 1), 0);
      if (visualLen >= col) {
        parts.push(current);
        current = '';
      }
    }
    if (current) parts.push(current);
    return parts.join('\n');
  }).join('\n');
}

// ═══ 编码转换（扩展） ═══

/** Unicode 转义 \uXXXX */
export function unicodeEscape(t: string): string {
  return [...t].map(c => {
    const code = c.codePointAt(0)!;
    if (code > 127) {
      return code > 0xFFFF
        ? `\\u{${code.toString(16).toUpperCase()}}`
        : `\\u${code.toString(16).toUpperCase().padStart(4, '0')}`;
    }
    return c;
  }).join('');
}

/** 还原 Unicode 转义 */
export function unicodeUnescape(t: string): string {
  return t
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** HTML 实体编码 */
export function htmlEntityEncode(t: string): string {
  return [...t].map(c => {
    const code = c.codePointAt(0)!;
    if (code > 127 || c === '&' || c === '<' || c === '>' || c === '"' || c === "'") {
      return `&#${code};`;
    }
    return c;
  }).join('');
}

/** HTML 实体解码 */
export function htmlEntityDecode(t: string): string {
  return t
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** JSON 字符串转义 */
export function jsonStringEscape(t: string): string {
  return t
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/** JSON 字符串反转义 */
export function jsonStringUnescape(t: string): string {
  return t
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

// ═══ 中文数字 ═══

const CN_DIGITS = '零壹贰叁肆伍陆柒捌玖';
const CN_UNITS = ['', '拾', '佰', '仟'];
const CN_BIG_UNITS = ['', '万', '亿', '兆'];

/** 阿拉伯数字转中文大写（整数部分，支持到兆） */
export function numberToChinese(t: string): string {
  return t.replace(/\d+/g, (match) => {
    const num = parseInt(match, 10);
    if (num === 0) return CN_DIGITS[0];
    if (isNaN(num)) return match;

    const digits = String(num);
    const groups: string[] = [];
    // 4 位一组
    for (let i = digits.length; i > 0; i -= 4) {
      groups.unshift(digits.slice(Math.max(0, i - 4), i));
    }

    let result = '';
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      let groupStr = '';
      let hasNonZero = false;
      for (let di = 0; di < group.length; di++) {
        const d = parseInt(group[di], 10);
        const unitIdx = group.length - 1 - di;
        if (d === 0) {
          if (hasNonZero && di < group.length - 1 && parseInt(group[di + 1], 10) !== 0) {
            groupStr += CN_DIGITS[0];
          }
        } else {
          groupStr += CN_DIGITS[d] + CN_UNITS[unitIdx];
          hasNonZero = true;
        }
      }
      if (groupStr) {
        result += groupStr + CN_BIG_UNITS[groups.length - 1 - gi];
      } else if (result && gi < groups.length - 1) {
        result += CN_DIGITS[0];
      }
    }
    return result || CN_DIGITS[0];
  });
}

/** 中文大写转阿拉伯数字 */
export function chineseToNumber(t: string): string {
  const digitMap: Record<string, number> = {};
  for (let i = 0; i < 10; i++) digitMap[CN_DIGITS[i]] = i;
  // 也支持小写
  const lower = '零一二三四五六七八九';
  for (let i = 0; i < 10; i++) digitMap[lower[i]] = i;
  // 额外映射
  digitMap['两'] = 2;

  const unitMap: Record<string, number> = { '拾': 10, '十': 10, '佰': 100, '百': 100, '仟': 1000, '千': 1000 };
  const bigUnitMap: Record<string, number> = { '万': 10000, '萬': 10000, '亿': 100000000, '億': 100000000, '兆': 1000000000000 };

  // 匹配连续的中文数字
  const cnNumPattern = new RegExp(`[${CN_DIGITS}${lower}两拾十佰百仟千万萬亿億兆]+`, 'g');

  return t.replace(cnNumPattern, (match) => {
    let result = 0;
    let section = 0; // 万以下的部分
    let current = 0;

    for (const ch of match) {
      if (ch in digitMap) {
        current = digitMap[ch];
      } else if (ch in unitMap) {
        section += (current || 1) * unitMap[ch];
        current = 0;
      } else if (ch in bigUnitMap) {
        section += current;
        result += (section || 1) * bigUnitMap[ch];
        section = 0;
        current = 0;
      }
    }
    result += section + current;
    return String(result);
  });
}

// ═══ 文本统计 ═══

export interface TextStats {
  chars: number;           // 总字符数（含空格）
  charsNoSpace: number;    // 字符数（不含空格）
  chineseChars: number;    // 中文字符数（不含标点）
  englishWords: number;    // 英文单词数
  words: number;           // 总词数（中文字+英文词）
  lines: number;           // 总行数
  nonEmptyLines: number;   // 非空行数
  paragraphs: number;      // 段落数
  sentences: number;       // 句子数
}

/** 计算详细文本统计 */
export function getTextStats(t: string): TextStats {
  const chars = t.length;
  const charsNoSpace = t.replace(/\s/g, '').length;
  const chineseChars = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (t.match(/[a-zA-Z]+/g) || []).length;
  const words = chineseChars + englishWords;
  const lines = t === '' ? 0 : t.split('\n').length;
  const nonEmptyLines = t === '' ? 0 : t.split('\n').filter(l => l.trim() !== '').length;
  const paragraphs = t === '' ? 0 : t.split(/\n\s*\n/).filter(p => p.trim() !== '').length;
  const sentences = (t.match(/[。！？.!?]+/g) || []).length || (t.trim() ? 1 : 0);
  return { chars, charsNoSpace, chineseChars, englishWords, words, lines, nonEmptyLines, paragraphs, sentences };
}
