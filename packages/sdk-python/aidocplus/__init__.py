"""
AiDocPlus Python SDK

用于在脚本中调用 AiDocPlus 主程序的各种功能。
自动通过环境变量连接正在运行的 AiDocPlus 实例。

用法:
    import aidocplus
    api = aidocplus.connect()
    docs = api.document.list(project_id="xxx")
"""

from .client import AiDocPlusClient, connect

__version__ = "0.1.0"
__all__ = ["AiDocPlusClient", "connect"]
