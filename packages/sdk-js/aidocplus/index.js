/**
 * AiDocPlus JavaScript SDK — HTTP 客户端
 *
 * 通过本地 HTTP Server 与 AiDocPlus 主程序通信。
 * 连接参数自动从环境变量或 ~/.aidocplus/api.json 读取。
 *
 * @example
 * const aidocplus = require('aidocplus');
 * const api = aidocplus.connect();
 * const projects = await api.project.list();
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================
// 错误类
// ============================================================

class ApiError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = 'ApiError';
    this.code = code;
  }
}

// ============================================================
// 命名空间代理
// ============================================================

/**
 * 动态命名空间代理，支持 api.document.list() 风格调用
 */
function createNamespaceProxy(client, namespace) {
  return new Proxy({}, {
    get(_target, action) {
      if (typeof action !== 'string') return undefined;
      return function (params) {
        return client.call(`${namespace}.${action}`, params);
      };
    },
  });
}

// ============================================================
// 客户端
// ============================================================

class AiDocPlusClient {
  /**
   * @param {number} port
   * @param {string} token
   * @param {string} [callerLevel='script']
   */
  constructor(port, token, callerLevel) {
    this._baseUrl = `http://127.0.0.1:${port}`;
    this._port = port;
    this._token = token;
    this._callerLevel = callerLevel || 'script';
    this._reqCounter = 0;

    // 命名空间代理
    this.app = createNamespaceProxy(this, 'app');
    this.document = createNamespaceProxy(this, 'document');
    this.project = createNamespaceProxy(this, 'project');
    this.ai = createNamespaceProxy(this, 'ai');
    this.search = createNamespaceProxy(this, 'search');
    this.template = createNamespaceProxy(this, 'template');
    this.export = createNamespaceProxy(this, 'export');
    this.email = createNamespaceProxy(this, 'email');
    this.plugin = createNamespaceProxy(this, 'plugin');
    this.file = createNamespaceProxy(this, 'file');
    this.tts = createNamespaceProxy(this, 'tts');
    this.script = createNamespaceProxy(this, 'script');
  }

  /**
   * 调用 API 方法
   * @param {string} method - 方法名，如 "document.list"
   * @param {object} [params] - 参数
   * @returns {Promise<any>} result 字段
   */
  call(method, params) {
    this._reqCounter++;
    const reqId = `js_${this._reqCounter}`;

    const payload = JSON.stringify({
      method,
      params: params || {},
      id: reqId,
    });

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this._port,
          path: '/api/v1/call',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this._token}`,
            'X-Caller-Level': this._callerLevel,
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 60000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const body = JSON.parse(data);
              if (body.error) {
                reject(new ApiError(body.error.code || 500, body.error.message || '未知错误'));
              } else {
                resolve(body.result);
              }
            } catch (e) {
              reject(new ApiError(500, `解析响应失败: ${e.message}`));
            }
          });
        },
      );

      req.on('error', (e) => {
        reject(new Error(`无法连接到 AiDocPlus (127.0.0.1:${this._port}): ${e.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new ApiError(408, 'API 请求超时（60s）'));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * 获取运行状态（无需认证）
   * @returns {Promise<object>}
   */
  status() {
    return new Promise((resolve, reject) => {
      const req = http.get(
        `${this._baseUrl}/api/v1/status`,
        { timeout: 5000 },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error(`解析状态响应失败: ${e.message}`)); }
          });
        },
      );
      req.on('error', (e) => reject(new Error(`无法连接到 AiDocPlus: ${e.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error('状态查询超时')); });
    });
  }

  /**
   * 获取 API Schema（无需认证）
   * @returns {Promise<object>}
   */
  schema() {
    return new Promise((resolve, reject) => {
      const req = http.get(
        `${this._baseUrl}/api/v1/schema`,
        { timeout: 5000 },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error(`解析 Schema 响应失败: ${e.message}`)); }
          });
        },
      );
      req.on('error', (e) => reject(new Error(`无法连接到 AiDocPlus: ${e.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error('Schema 查询超时')); });
    });
  }
}

// ============================================================
// 自动连接
// ============================================================

/**
 * 读取 ~/.aidocplus/api.json
 * @returns {object|null}
 */
function readApiJson() {
  const apiJsonPath = path.join(os.homedir(), '.aidocplus', 'api.json');
  try {
    if (!fs.existsSync(apiJsonPath)) return null;
    const content = fs.readFileSync(apiJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 连接到正在运行的 AiDocPlus 实例。
 *
 * 连接参数按以下优先级获取：
 * 1. 函数参数（port, token）
 * 2. 环境变量（AIDOCPLUS_API_PORT, AIDOCPLUS_API_TOKEN）
 * 3. ~/.aidocplus/api.json 文件
 *
 * @param {object} [options]
 * @param {number} [options.port]
 * @param {string} [options.token]
 * @returns {AiDocPlusClient}
 */
function connect(options) {
  const opts = options || {};
  let port = opts.port || null;
  let token = opts.token || null;

  // 优先级 2: 环境变量
  if (!port && process.env.AIDOCPLUS_API_PORT) {
    port = parseInt(process.env.AIDOCPLUS_API_PORT, 10);
  }
  if (!token && process.env.AIDOCPLUS_API_TOKEN) {
    token = process.env.AIDOCPLUS_API_TOKEN;
  }

  // 优先级 3: api.json
  if (!port || !token) {
    const info = readApiJson();
    if (info) {
      if (!port) port = info.port;
      if (!token) token = info.token;
    }
  }

  if (!port || !token) {
    throw new Error(
      '无法找到 AiDocPlus 连接信息。\n' +
      '请确保 AiDocPlus 正在运行，或手动指定 port 和 token 参数。\n' +
      '提示：在 AiDocPlus 编程区中运行脚本时，连接参数会自动注入。'
    );
  }

  return new AiDocPlusClient(port, token);
}

// ============================================================
// 导出
// ============================================================

module.exports = { AiDocPlusClient, ApiError, connect };
