#!/usr/bin/env python3
"""
Claude Code Session Learner Hook
只从用户消息中提取明确的反馈和纠正，写入 memory
"""
import sys
import json
import re
from datetime import datetime
from pathlib import Path

MEMORY_DIR = Path.home() / ".claude/projects/-Users-jdh-Code-AiDocPlus/memory"

# 明确的反馈指示词
CORRECTION_KEYWORDS = [
    # 中文
    "不要", "别", "停止", "不要重复", "不要再", "永远不要",
    "记得", "要记住", "以后要",
    "应该用", "改成", "改用",
    "不要用", "不要做",
    "要这样做", "不是这样",
    # English
    "don't", "stop doing", "never", "remember to", "always",
    "instead of", "you should use", "use this",
    "not that", "wrong", "incorrect",
]

FEEDBACK_TRIGGER_LENGTH = 20  # 用户反馈至少要这么长才提取


def get_latest_session_jsonl():
    """找到最新的会话 JSONL 文件"""
    project_dir = Path.home() / ".claude/projects/-Users-jdh-Code-AiDocPlus"
    jsonl_files = list(project_dir.glob("*.jsonl"))
    if not jsonl_files:
        return None
    return max(jsonl_files, key=lambda p: p.stat().st_mtime)


def contains_feedback_keyword(text):
    """检查文本是否包含反馈关键词"""
    text_lower = text.lower()
    for kw in CORRECTION_KEYWORDS:
        if kw.lower() in text_lower:
            return True
    return False


def is_user_feedback(text):
    """判断是否是用户反馈（而非代码或文档内容）"""
    # 太短不是反馈
    if len(text) < FEEDBACK_TRIGGER_LENGTH:
        return False

    # 不包含反馈关键词不是反馈
    if not contains_feedback_keyword(text):
        return False

    # 包含太多代码特征可能不是反馈
    code_chars = text.count('`') + text.count('(') + text.count(')') + text.count('{') + text.count('}')
    alpha_chars = sum(1 for c in text if c.isalpha())
    if alpha_chars > 0 and code_chars / alpha_chars > 0.3:
        return False

    # 包含换行符后面的内容太杂乱也不是反馈
    lines = text.split('\n')
    if len(lines) > 3:
        return False

    return True


def extract_user_feedback_from_entry(entry):
    """从一个 JSONL 条目中提取用户反馈文本"""
    if not isinstance(entry, dict):
        return []

    messages = []

    # 直接的 messages 数组
    msgs = entry.get("messages", [])
    if isinstance(msgs, list):
        for msg in msgs:
            if isinstance(msg, dict) and msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, str):
                    messages.append(content)
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            messages.append(block.get("text", ""))

    # 嵌套的 message 字段
    msg = entry.get("message", {})
    if isinstance(msg, dict) and msg.get("role") == "user":
        content = msg.get("content", "")
        if isinstance(content, str):
            messages.append(content)

    # text 字段（有些条目直接放 text）
    text = entry.get("text", "")
    if isinstance(text, str) and text.strip():
        messages.append(text)

    return messages


def parse_session_for_feedback(jsonl_path):
    """解析会话 JSONL，只提取用户反馈"""
    corrections = []

    try:
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except:
                    continue

                user_messages = extract_user_feedback_from_entry(entry)

                for text in user_messages:
                    if is_user_feedback(text):
                        # 提取关键词所在句子
                        for kw in CORRECTION_KEYWORDS:
                            if kw.lower() in text.lower():
                                # 找到关键词周围的上下文
                                idx = text.lower().find(kw.lower())
                                start = max(0, idx - 30)
                                end = min(len(text), idx + len(kw) + 50)
                                snippet = text[start:end].strip()

                                # 清理
                                snippet = re.sub(r'\s+', ' ', snippet)
                                if len(snippet) > 10 and snippet not in corrections:
                                    corrections.append(snippet)
                                break

    except Exception as e:
        print(f"[session_learner] Parse error: {e}", file=sys.stderr)
        return []

    return corrections


def append_to_memory(corrections):
    """追加教训到 memory 文件"""
    if not corrections:
        return 0

    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    feedback_file = MEMORY_DIR / "user-feedback.md"

    ts = datetime.now().strftime("%Y-%m-%d")
    entries = [f"- [{ts}] **修正**: {c}" for c in corrections]

    existing = []
    if feedback_file.exists():
        with open(feedback_file, "r", encoding="utf-8") as f:
            existing = f.read()

    # 去重
    new_entries = [e for e in entries if e not in existing]

    if new_entries:
        with open(feedback_file, "a", encoding="utf-8") as f:
            f.write("\n" + "\n".join(new_entries))

    return len(new_entries)


def main():
    jsonl_path = get_latest_session_jsonl()
    if not jsonl_path:
        return 0

    corrections = parse_session_for_feedback(jsonl_path)
    if not corrections:
        return 0

    count = append_to_memory(corrections)
    if count > 0:
        print(f"[session_learner] Saved {count} corrections to memory", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
