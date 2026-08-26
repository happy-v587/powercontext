---
title: 完整功能 Quick Start
description: 5 分钟启动 PowerContext 完整功能。
---

# 完整功能 Quick Start

## 先确定 Scope ID

Scope ID 是 PowerContext 的数据命名空间，可以把它理解成“项目 ID”。Source、Memory 和 Handoff 都归属于某个
Scope；只有 Dashboard 和 Coding Agent 使用同一个 Scope ID，网页里才能看到 Agent 写入的数据。

同一个 Server 可以保存多个 Scope。Server 启动时配置的是 **Dashboard 可以查看哪些 Scope**，Coding Agent 启动时
配置的是 **本次会话把数据读写到哪个 Scope**：

```text
Coding Agent ──读写──> project:quickstart <──展示── Dashboard
```

Scope ID 可以使用任意简短、稳定、非空的字符串，不要包含密钥或其他秘密。例如：

```text
project:quickstart
git:github.com/oceanbase/powercontext
team:payment-service
```

下面的 Quick Start 统一使用：

```text
project:quickstart
```

## 快速启动

### 第一部分：启动 Server

#### 1. 安装

```bash
uv tool install "powercontext[cli,server] @ git+https://github.com/oceanbase/powercontext.git@master"
```

#### 2. 生成配置

```bash
powercontext config init --output .env
```

生成完成后会列出 Codex、Claude Code、DeepSeek Harness、OpenCode 和 Pi 的全部 setup 与启动命令。

#### 3. 启动 Server

```bash
powercontext server run --env-file .env
```

#### 4. 验证 Server

在第二个终端执行：

```bash
set -a
. ./.env
set +a
powercontext ready
powercontext capabilities
```

只需要确认下面三项：

```text
Status: ready
Memory extraction: enabled
Search modes: auto, fts, vector, hybrid
```

看到 `Status: ready`、`Memory extraction: enabled` 和四种搜索模式，同时 Dashboard 中存在 `Quick Start`，说明完整功能已经启动。

### 第二部分：启动 Coding Agent

Config Generator 已经打印全部受支持 Coding Agent 的 setup 和启动命令。新开一个终端，找到要使用的 Agent，复制它下面
的两行即可；第一行安装 PowerContext 集成，第二行加载刚生成的 `.env` 并启动 Agent，因此不需要再次填写 Scope ID。

Coding Agent 启动后，在项目中发送一条普通 prompt。集成会先从 `project:quickstart` 召回相关 Memory，再把本轮 prompt
保存为 Source；Scheduler 最多等待 60 秒后尝试从 Source 提取 Memory。刷新 Dashboard，即可从同一个 Scope 查看数据。


## 快速排障

| 现象 | 处理方式 |
| --- | --- |
| Dashboard 为空 | 对比 Dashboard 与 Agent 的完整 scope 字符串 |
| `ready` 为 `degraded` | 检查 Generation、Embedding 的模型、密钥和 Base URL |
| 没有 `vector`、`hybrid` | 同时配置 Embedding model、profile ID 和正确维度 |
| Source 一直 pending | 启用 scheduler，或调用 `/v1/memory/flush` |
| 原有数据不见了 | 恢复之前的数据库 URL 或 `POWERCONTEXT_HOME` |

更多错误状态见[排查问题](troubleshoot.md)，完整变量见[配置参考](../reference/configuration.md)。
