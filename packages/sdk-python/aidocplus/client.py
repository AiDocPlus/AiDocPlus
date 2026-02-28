"""
AiDocPlus Python SDK — HTTP 客户端

通过本地 HTTP Server 与 AiDocPlus 主程序通信。
连接参数自动从环境变量或 ~/.aidocplus/api.json 读取。
"""

import json
import os
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional, Union


class ApiError(Exception):
    """API 调用错误"""
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}")


class _NamespaceProxy:
    """命名空间代理，支持 api.document.list() 风格调用"""

    def __init__(self, client: "AiDocPlusClient", namespace: str):
        self._client = client
        self._namespace = namespace

    def __getattr__(self, action: str):
        method = f"{self._namespace}.{action}"
        def caller(**kwargs):
            return self._client.call(method, kwargs)
        caller.__name__ = method
        caller.__doc__ = f"调用 {method}"
        return caller


class AiDocPlusClient:
    """AiDocPlus API 客户端"""

    def __init__(self, port: int, token: str, caller_level: str = "script"):
        self._base_url = f"http://127.0.0.1:{port}"
        self._token = token
        self._caller_level = caller_level
        self._req_counter = 0

        # 命名空间代理
        self.app = _NamespaceProxy(self, "app")
        self.document = _NamespaceProxy(self, "document")
        self.project = _NamespaceProxy(self, "project")
        self.ai = _NamespaceProxy(self, "ai")
        self.search = _NamespaceProxy(self, "search")
        self.template = _NamespaceProxy(self, "template")
        self.export = _NamespaceProxy(self, "export")
        self.email = _NamespaceProxy(self, "email")
        self.plugin = _NamespaceProxy(self, "plugin")
        self.file = _NamespaceProxy(self, "file")
        self.tts = _NamespaceProxy(self, "tts")
        self.script = _NamespaceProxy(self, "script")

    def call(self, method: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """
        调用 API 方法

        Args:
            method: 方法名，如 "document.list"
            params: 参数字典

        Returns:
            API 返回的 result 字段

        Raises:
            ApiError: 当 API 返回错误时
            ConnectionError: 当无法连接到 AiDocPlus 时
        """
        self._req_counter += 1
        req_id = f"py_{self._req_counter}"

        payload = {
            "method": method,
            "params": params or {},
            "id": req_id,
        }

        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._token}",
            "X-Caller-Level": self._caller_level,
        }

        req = urllib.request.Request(
            f"{self._base_url}/api/v1/call",
            data=data,
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                body = json.loads(e.read().decode("utf-8"))
            except Exception:
                raise ApiError(e.code, f"HTTP {e.code}: {e.reason}")
        except urllib.error.URLError as e:
            raise ConnectionError(
                f"无法连接到 AiDocPlus (127.0.0.1:{self._base_url.split(':')[-1]}): {e.reason}"
            )

        if "error" in body and body["error"]:
            err = body["error"]
            raise ApiError(err.get("code", 500), err.get("message", "未知错误"))

        return body.get("result")

    def status(self) -> Dict[str, Any]:
        """获取 AiDocPlus 运行状态（无需认证）"""
        req = urllib.request.Request(f"{self._base_url}/api/v1/status")
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            raise ConnectionError(f"无法连接到 AiDocPlus: {e}")

    def schema(self) -> Dict[str, Any]:
        """获取 API Schema（无需认证）"""
        req = urllib.request.Request(f"{self._base_url}/api/v1/schema")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))


def _read_api_json() -> Optional[Dict[str, Any]]:
    """读取 ~/.aidocplus/api.json"""
    api_json_path = Path.home() / ".aidocplus" / "api.json"
    if not api_json_path.exists():
        return None
    try:
        with open(api_json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def connect(
    port: Optional[int] = None,
    token: Optional[str] = None,
) -> AiDocPlusClient:
    """
    连接到正在运行的 AiDocPlus 实例。

    连接参数按以下优先级获取：
    1. 函数参数（port, token）
    2. 环境变量（AIDOCPLUS_API_PORT, AIDOCPLUS_API_TOKEN）
    3. ~/.aidocplus/api.json 文件

    Returns:
        AiDocPlusClient 实例

    Raises:
        ConnectionError: 无法找到连接信息或连接失败
    """
    # 优先级 1: 函数参数
    _port = port
    _token = token

    # 优先级 2: 环境变量
    if _port is None:
        env_port = os.environ.get("AIDOCPLUS_API_PORT")
        if env_port:
            _port = int(env_port)
    if _token is None:
        _token = os.environ.get("AIDOCPLUS_API_TOKEN")

    # 优先级 3: api.json
    if _port is None or _token is None:
        api_info = _read_api_json()
        if api_info:
            if _port is None:
                _port = api_info.get("port")
            if _token is None:
                _token = api_info.get("token")

    if _port is None or _token is None:
        raise ConnectionError(
            "无法找到 AiDocPlus 连接信息。\n"
            "请确保 AiDocPlus 正在运行，或手动指定 port 和 token 参数。\n"
            "提示：在 AiDocPlus 编程区中运行脚本时，连接参数会自动注入。"
        )

    client = AiDocPlusClient(port=_port, token=_token)

    # 验证连接
    try:
        client.status()
    except Exception as e:
        raise ConnectionError(
            f"无法连接到 AiDocPlus (127.0.0.1:{_port}): {e}\n"
            "请确保 AiDocPlus 正在运行。"
        )

    return client
