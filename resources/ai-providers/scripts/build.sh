#!/bin/bash
# AiDocPlus-AIProviders build.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
python3 "${SCRIPT_DIR}/build.py"
