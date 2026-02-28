---
title: 配置 AI 服务
parent: 快速入门
nav_order: 3
permalink: /docs/getting-started/ai-service
---

# 配置智谱 AI API Key

智谱 AI 是国内领先的 AI 服务商，新用户注册即赠送 **2000 万免费 Tokens**，推荐作为首选 AI 服务。

## 步骤一：注册智谱 AI 账号

1. 访问 [智谱 AI 开放平台](https://open.bigmodel.cn/)
2. 点击右上角 **注册**，使用手机号完成注册
3. 登录后进入控制台

## 步骤二：获取 API Key

1. 在控制台左侧菜单中找到 **API Keys**
2. 点击 **创建 API Key**
3. 复制生成的 API Key（以 `.` 分隔的长字符串）

> ⚠️ API Key 只显示一次，请妥善保存

## 步骤三：在 AiDocPlus 中配置

1. 打开 AiDocPlus，点击标签栏右侧的 ⚙️ 按钮
2. 选择 **AI 设置** 标签
3. 在服务商列表中选择 **智谱 AI (ZhipuAI)**
4. 将复制的 API Key 粘贴到输入框中
5. 点击 **测试连接** 验证是否成功
6. 选择要使用的模型（推荐 GLM-4-Flash，免费且速度快）

![AI 设置面板](../../screenshots/settings-ai.PNG)

## 推荐模型

| 模型 | 特点 | 费用 |
|------|------|------|
| GLM-4-Flash | 速度快，适合日常写作 | 免费 |
| GLM-4-Air | 平衡性能与成本 | 低价 |
| GLM-4-Plus | 最强能力 | 较高 |

## 其他支持的 AI 服务商

AiDocPlus 支持 13 个 AI 服务商，包括：
- **国内**：智谱 AI、DeepSeek、百度文心、阿里通义、讯飞星火、月之暗面等
- **国际**：OpenAI、Anthropic Claude、Google Gemini 等

在 AI 设置中选择对应服务商并填入 API Key 即可。

[← 返回快速开始](./quick-start) · [返回文档首页](../)
