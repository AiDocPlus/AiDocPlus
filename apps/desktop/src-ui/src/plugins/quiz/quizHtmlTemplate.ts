import type { QuizData } from './types';

/**
 * 生成独立的 HTML 测试题页面
 */
export function generateQuizHtml(quiz: QuizData): string {
  const questionsJson = JSON.stringify(quiz.questions);
  const title = escapeHtml(quiz.title);
  const totalScore = quiz.totalScore;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #f5f7fa;
    color: #333;
    line-height: 1.6;
    padding: 20px;
  }
  .container {
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    padding: 32px;
  }
  h1 {
    text-align: center;
    font-size: 24px;
    margin-bottom: 8px;
    color: #1a1a1a;
  }
  .subtitle {
    text-align: center;
    color: #888;
    font-size: 14px;
    margin-bottom: 24px;
  }
  .score-bar {
    display: flex;
    justify-content: center;
    gap: 24px;
    padding: 12px 0;
    margin-bottom: 24px;
    border-top: 1px solid #eee;
    border-bottom: 1px solid #eee;
    font-size: 14px;
    color: #666;
  }
  .score-bar span { font-weight: 600; color: #333; }
  .section-title {
    font-size: 18px;
    font-weight: 600;
    color: #1a73e8;
    margin: 28px 0 16px;
    padding-left: 12px;
    border-left: 4px solid #1a73e8;
  }
  .question {
    margin-bottom: 24px;
    padding: 16px;
    border-radius: 8px;
    background: #fafbfc;
    border: 1px solid #eee;
    transition: border-color 0.2s;
  }
  .question.correct { border-color: #34a853; background: #f0faf3; }
  .question.wrong { border-color: #ea4335; background: #fef0ef; }
  .question-text {
    font-size: 15px;
    font-weight: 500;
    margin-bottom: 12px;
  }
  .question-type {
    display: inline-block;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    margin-right: 8px;
    font-weight: 600;
  }
  .type-single { background: #e8f0fe; color: #1a73e8; }
  .type-multiple { background: #fce8e6; color: #ea4335; }
  .type-truefalse { background: #e6f4ea; color: #34a853; }
  .options { list-style: none; }
  .options li {
    padding: 8px 12px;
    margin: 4px 0;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  .options li:hover { background: #f0f2f5; }
  .options li.selected { background: #e8f0fe; font-weight: 500; }
  .options li.disabled { pointer-events: none; }
  .options li.correct-answer { background: #e6f4ea; }
  .options li.wrong-answer { background: #fce8e6; text-decoration: line-through; opacity: 0.7; }
  .radio, .checkbox {
    width: 18px; height: 18px;
    border: 2px solid #ccc;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .checkbox { border-radius: 4px; }
  .radio.checked, .checkbox.checked {
    border-color: #1a73e8;
    background: #1a73e8;
  }
  .radio.checked::after {
    content: '';
    width: 8px; height: 8px;
    background: #fff;
    border-radius: 50%;
  }
  .checkbox.checked::after {
    content: '✓';
    color: #fff;
    font-size: 12px;
    font-weight: bold;
  }
  .explanation {
    display: none;
    margin-top: 12px;
    padding: 12px;
    background: #fff;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    font-size: 13px;
    color: #555;
  }
  .explanation .answer-label {
    font-weight: 600;
    color: #34a853;
    margin-bottom: 4px;
  }
  .explanation.show { display: block; }
  .score-label {
    display: none;
    font-size: 13px;
    font-weight: 600;
    margin-top: 8px;
  }
  .score-label.show { display: block; }
  .score-label.got { color: #34a853; }
  .score-label.lost { color: #ea4335; }
  .actions {
    text-align: center;
    margin-top: 32px;
    display: flex;
    justify-content: center;
    gap: 12px;
  }
  button {
    padding: 12px 32px;
    font-size: 16px;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-submit { background: #1a73e8; color: #fff; }
  .btn-submit:hover:not(:disabled) { background: #1557b0; }
  .btn-reset { background: #f0f2f5; color: #333; }
  .btn-reset:hover:not(:disabled) { background: #e0e2e5; }
  .result {
    display: none;
    text-align: center;
    margin: 24px 0;
    padding: 24px;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
  .result.show { display: block; }
  .result .final-score { font-size: 48px; font-weight: 700; }
  .result .final-label { font-size: 14px; opacity: 0.9; margin-top: 4px; }
  .result .final-detail { font-size: 14px; opacity: 0.8; margin-top: 8px; }
</style>
</head>
<body>
<div class="container">
  <h1>${title}</h1>
  <div class="subtitle">总分 ${totalScore} 分</div>
  <div class="score-bar" id="scoreBar">
    <div>单选题：<span id="singleInfo"></span></div>
    <div>多选题：<span id="multiInfo"></span></div>
    <div>判断题：<span id="tfInfo"></span></div>
  </div>
  <div id="quizBody"></div>
  <div class="result" id="result">
    <div class="final-score" id="finalScore"></div>
    <div class="final-label">总分 ${totalScore} 分</div>
    <div class="final-detail" id="finalDetail"></div>
  </div>
  <div class="actions">
    <button class="btn-submit" id="btnSubmit" onclick="submitQuiz()">提交答案</button>
    <button class="btn-reset" id="btnReset" onclick="resetQuiz()" style="display:none">重新作答</button>
  </div>
</div>

<script>
var questions = ${questionsJson};
var submitted = false;
var userAnswers = {};

function init() {
  var body = document.getElementById('quizBody');
  var html = '';
  var singleCount = 0, multiCount = 0, tfCount = 0;
  var singleTotal = 0, multiTotal = 0, tfTotal = 0;

  var sections = { single: [], multiple: [], truefalse: [] };
  questions.forEach(function(q) { sections[q.type].push(q); });

  var globalIdx = 0;
  var typeNames = { single: '单选题', multiple: '多选题', truefalse: '判断题' };
  var typeCss = { single: 'type-single', multiple: 'type-multiple', truefalse: 'type-truefalse' };
  var order = ['single', 'multiple', 'truefalse'];

  order.forEach(function(type) {
    var qs = sections[type];
    if (qs.length === 0) return;
    html += '<div class="section-title">' + typeNames[type] + '</div>';
    qs.forEach(function(q) {
      globalIdx++;
      if (type === 'single') { singleCount++; singleTotal += q.score; }
      else if (type === 'multiple') { multiCount++; multiTotal += q.score; }
      else { tfCount++; tfTotal += q.score; }

      var isMulti = type === 'multiple';
      var widget = isMulti ? 'checkbox' : 'radio';
      html += '<div class="question" id="q' + q.id + '">';
      html += '<div class="question-text"><span class="question-type ' + typeCss[type] + '">' + typeNames[type] + '</span>' + globalIdx + '. ' + escapeHtml(q.question) + '</div>';
      html += '<ul class="options">';
      q.options.forEach(function(opt, oi) {
        var letter = opt.charAt(0);
        html += '<li id="q' + q.id + 'o' + oi + '" onclick="selectOption(' + q.id + ',' + oi + ',\\'' + letter + '\\',' + isMulti + ')">';
        html += '<span class="' + widget + '" id="q' + q.id + 'w' + oi + '"></span>';
        html += '<span>' + escapeHtml(opt) + '</span>';
        html += '</li>';
      });
      html += '</ul>';
      html += '<div class="score-label" id="q' + q.id + 'score"></div>';
      html += '<div class="explanation" id="q' + q.id + 'exp">';
      html += '<div class="answer-label">正确答案：' + escapeHtml(q.answer.join(', ')) + '</div>';
      html += '<div>' + escapeHtml(q.explanation) + '</div>';
      html += '</div>';
      html += '</div>';
    });
  });

  body.innerHTML = html;
  document.getElementById('singleInfo').textContent = singleCount + ' 题 / ' + singleTotal + ' 分';
  document.getElementById('multiInfo').textContent = multiCount + ' 题 / ' + multiTotal + ' 分';
  document.getElementById('tfInfo').textContent = tfCount + ' 题 / ' + tfTotal + ' 分';
}

function escapeHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function selectOption(qid, oi, letter, isMulti) {
  if (submitted) return;
  if (!userAnswers[qid]) userAnswers[qid] = [];

  if (isMulti) {
    var idx = userAnswers[qid].indexOf(letter);
    if (idx >= 0) userAnswers[qid].splice(idx, 1);
    else userAnswers[qid].push(letter);
  } else {
    userAnswers[qid] = [letter];
  }

  // 更新 UI
  var q = questions.find(function(x) { return x.id === qid; });
  q.options.forEach(function(opt, i) {
    var li = document.getElementById('q' + qid + 'o' + i);
    var w = document.getElementById('q' + qid + 'w' + i);
    var l = opt.charAt(0);
    var sel = userAnswers[qid].indexOf(l) >= 0;
    li.className = sel ? 'selected' : '';
    w.className = (isMulti ? 'checkbox' : 'radio') + (sel ? ' checked' : '');
  });
}

function submitQuiz() {
  if (submitted) return;
  submitted = true;

  var totalGot = 0;
  var correctCount = 0;

  questions.forEach(function(q) {
    var ua = (userAnswers[q.id] || []).sort().join(',');
    var ca = q.answer.slice().sort().join(',');
    var isCorrect = ua === ca;
    var got = isCorrect ? q.score : 0;
    totalGot += got;
    if (isCorrect) correctCount++;

    var qEl = document.getElementById('q' + q.id);
    qEl.className = 'question ' + (isCorrect ? 'correct' : 'wrong');

    // 标记选项
    q.options.forEach(function(opt, i) {
      var li = document.getElementById('q' + q.id + 'o' + i);
      var l = opt.charAt(0);
      li.classList.add('disabled');
      if (q.answer.indexOf(l) >= 0) li.classList.add('correct-answer');
      else if ((userAnswers[q.id] || []).indexOf(l) >= 0) li.classList.add('wrong-answer');
    });

    // 显示得分
    var scoreEl = document.getElementById('q' + q.id + 'score');
    scoreEl.className = 'score-label show ' + (isCorrect ? 'got' : 'lost');
    scoreEl.textContent = isCorrect ? '✓ 得 ' + q.score + ' 分' : '✗ 得 0 分（本题 ' + q.score + ' 分）';

    // 显示解析
    document.getElementById('q' + q.id + 'exp').className = 'explanation show';
  });

  // 显示总分
  var result = document.getElementById('result');
  result.className = 'result show';
  document.getElementById('finalScore').textContent = totalGot + ' 分';
  document.getElementById('finalDetail').textContent = '答对 ' + correctCount + ' / ' + questions.length + ' 题';

  document.getElementById('btnSubmit').disabled = true;
  document.getElementById('btnReset').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetQuiz() {
  submitted = false;
  userAnswers = {};
  document.getElementById('result').className = 'result';
  document.getElementById('btnSubmit').disabled = false;
  document.getElementById('btnReset').style.display = 'none';
  init();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

init();
</script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
