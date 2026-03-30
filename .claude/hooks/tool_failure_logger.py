#!/usr/bin/env python3
"""
Claude Code Tool Failure Logger Hook
在工具失败时记录错误信息到 memory
"""
import sys
import json
import os
from datetime import datetime
from pathlib import Path

MEMORY_DIR = Path.home() / ".claude/projects/-Users-jdh-Code-AiDocPlus/memory"

def main():
    # 从 stdin 读取 hook event 数据
    try:
        event_data = json.loads(sys.stdin.read())
    except:
        # 无输入数据时静默退出
        return 0

    tool_name = event_data.get("tool_name", "unknown")
    error_msg = event_data.get("error", "")
    session_id = event_data.get("session_id", "")

    if not error_msg:
        return 0

    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    log_entry = f"- [{ts}] **{tool_name}** failed: {error_msg[:200]}"

    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    error_log = MEMORY_DIR / "tool-failures.md"

    existing = []
    if error_log.exists():
        with open(error_log, "r", encoding="utf-8") as f:
            existing = f.read()

    # 去重
    if log_entry not in existing:
        header = "# Tool Failure Log\n\n记录工具执行失败的历史，防止重复犯错。\n\n"
        if not error_log.exists():
            with open(error_log, "w", encoding="utf-8") as f:
                f.write(header + log_entry)
        else:
            with open(error_log, "a", encoding="utf-8") as f:
                f.write("\n" + log_entry)

    return 0

if __name__ == "__main__":
    sys.exit(main())
