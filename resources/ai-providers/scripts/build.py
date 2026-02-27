#!/usr/bin/env python3
"""
AiDocPlus-AIProviders 构建脚本
扫描 data/ 目录，生成 ai-providers.generated.ts
"""
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(REPO_DIR, "data")
DIST_DIR = os.path.join(REPO_DIR, "dist")

os.makedirs(DIST_DIR, exist_ok=True)


def ts_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def find_providers(data_dir: str):
    providers = []
    for root, dirs, files in os.walk(data_dir):
        if "manifest.json" in files:
            manifest_path = os.path.join(root, "manifest.json")
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            providers.append(manifest)
    providers.sort(key=lambda p: p.get("order", 0))
    return providers


def generate_provider_entry(p: dict) -> str:
    lines = []
    lines.append("  {")
    lines.append(f"    id: {ts_string(p['id'])} as AIProvider,")
    lines.append(f"    name: {ts_string(p['name'])},")
    lines.append(f"    baseUrl: {ts_string(p.get('baseUrl', ''))},")
    lines.append(f"    defaultModel: {ts_string(p.get('defaultModel', ''))},")

    # authHeader
    auth = p.get("authHeader", "bearer")
    if auth and auth != "bearer":
        lines.append(f"    authHeader: {ts_string(auth)},")

    # capabilities
    caps = p.get("capabilities", {})
    cap_parts = []
    for k in ["webSearch", "thinking", "functionCalling", "vision"]:
        cap_parts.append(f"{k}: {'true' if caps.get(k) else 'false'}")
    lines.append(f"    capabilities: {{ {', '.join(cap_parts)} }},")

    # models
    models = p.get("models", [])
    if models:
        model_entries = []
        for m in models:
            model_entries.append(f"      {{ id: {ts_string(m['id'])}, name: {ts_string(m['name'])} }}")
        lines.append("    models: [")
        lines.append(",\n".join(model_entries) + ",")
        lines.append("    ],")
    else:
        lines.append("    models: [],")

    lines.append("  },")
    return "\n".join(lines)


def main():
    print("[build] 构建 AI 提供商数据...")
    providers = find_providers(DATA_DIR)

    if not providers:
        print("[warn] 未找到任何提供商数据")
        sys.exit(1)

    entries = [generate_provider_entry(p) for p in providers]

    # 生成 AIProvider 类型联合
    provider_ids = [p["id"] for p in providers]
    type_union = " | ".join(f"'{pid}'" for pid in provider_ids)

    output = f"""/**
 * 自动生成文件 — 请勿手动编辑
 * 由 AiDocPlus-AIProviders/scripts/build.py 生成
 */
import type {{ AIProviderConfig }} from '../index';
import type {{ AIProvider }} from '../index';

export const AI_PROVIDERS: AIProviderConfig[] = [
{chr(10).join(entries)}
];

export function getProviderConfig(providerId: AIProvider): AIProviderConfig | undefined {{
  return AI_PROVIDERS.find(p => p.id === providerId);
}}
"""

    output_path = os.path.join(DIST_DIR, "ai-providers.generated.ts")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(output)

    print(f"[done] 构建完成: {output_path}")
    print(f"   共 {len(providers)} 个提供商")


if __name__ == "__main__":
    main()
