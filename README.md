# AgentFlow Visualizer

一个用于生成 **AI Agent 执行过程可视化前端项目** 的 Trae Skill。支持单 Agent 与多 Agent DAG 协作，复刻 [AgentFlow](https://lab.xiebq.com/agentflow/) 的核心体验。

## 这是什么

这不是一个现成运行的应用，而是一个 **Skill（技能）**——给 AI 编程助手看的指令集 + 可复制的项目骨架。当你提出"帮我做一个 Agent 可视化界面"这类需求时，助手会加载这个 Skill，然后基于 `assets/` 里的骨架快速生成一个可运行的项目。

## 适用场景

- Agent 执行过程可视化 / Agent 流程图展示
- AI Agent 教学演示、工具调用（tool call）实时展示
- 多 Agent 协作界面、Agent 分工可视化
- 观察 Agent 的思考 → 工具调用 → 结果 → 循环

## 核心设计

**单 Agent 和多 Agent 不是两套架构，而是同一个 DAG 引擎的不同实例：**

```
单 Agent = DAG 只有 1 个节点，内部是线性状态机
多 Agent = DAG 有 N 个节点，节点间通过边声明委托 / 依赖关系
```

### 三条协作通路

| 层级 | 机制 | 说明 |
|------|------|------|
| 调度层 | `AgentScheduler` | 按 DAG 拓扑驱动各 Agent 的状态流转 |
| 工具层 | `agent_call` | Agent A 主动委托 Agent B，同步等待结果 |
| 数据层 | 虚拟文件系统 | Agent 之间通过共享文件间接协作 |

### 生成项目的技术栈

| 层级 | 技术 |
|------|------|
| 构建 | Vite 5 + TypeScript |
| 框架 | React 18 |
| 流程图 | ReactFlow 11 |
| 状态管理 | Zustand |
| Python 沙箱 | Pyodide WASM（动态加载） |
| 文件解析 | JSZip / SheetJS / Mammoth / MuPDF WASM |
| 参数校验 | Zod |

## 目录结构

```
agent-flow-visualizer/
├── SKILL.md                    # Skill 入口：触发条件 + 生成流程
├── references/                 # 生成时按需加载的架构文档
│   ├── 架构设计.md
│   ├── DAG调度器设计.md
│   ├── 工具注册机制.md
│   ├── 多Agent可视化方案.md
│   └── 演示场景模板.md
└── assets/
    └── 项目模板骨架/            # 完整可运行的前端项目
        ├── package.json
        ├── vite.config.ts
        ├── tsconfig.json
        ├── index.html
        └── src/
            ├── core/           # AgentScheduler / LLMClient / VFS / ToolRegistry
            ├── store/          # Zustand 全局状态
            ├── tools/          # 12 种工具 + agent_call
            ├── components/     # ReactFlow 画布、侧边栏、日志、文件预览
            ├── presets/        # 内置演示场景
            ├── types/          # 类型定义
            └── styles/
```

## 内置工具（12 种）

| 类别 | 工具 |
|------|------|
| 文件系统 | `file_read` / `file_write` / `file_edit` / `file_search` |
| 代码执行 | `python_exec`（Pyodide WASM 沙箱，自动加载 numpy/pandas/matplotlib） |
| Shell | `shell`（前端模拟管道、通配符、grep、find、wc 等） |
| 网络 | `web_search` / `web_fetch` / `http_request` |
| 交互 | `user_input` |
| 多 Agent | `agent_call`（委托子 Agent 执行任务） |

所有工具实现统一的 `AgentTool` 接口（`name` / `description` / `parameters` / `execute`），可插拔注册、替换、关闭。

## 内置演示场景

- **旅行攻略规划** —— 单 Agent + 文件系统
- **多 Agent 研究团队** —— 规划师 → 搜索员 → 写作者，展示委托与依赖

## 安装使用

把整个目录放到 Trae 的全局 skill 目录：

```
~/.trae-cn/skills/agent-flow-visualizer/
```

然后在对话中提出需求，例如：

- "帮我做一个 Agent 执行过程的可视化演示页面"
- "需要一个展示多 Agent 协作的流程图界面"
- "给我的 AI Agent 做个可视化前端"

## 快速验证骨架

```bash
# 复制骨架
cp -r assets/项目模板骨架 my-agent-visualizer
cd my-agent-visualizer

# 安装依赖并启动
npm install
npm run dev
```

浏览器打开后点击「开始执行」，即可看到流程图实时生长。

## 说明

- 默认使用 **mock 模式**（无需 API Key），修改 `src/core/LLMClient.ts` 可接入真实 LLM（OpenAI 兼容协议，适配 OpenAI / Deepseek / 本地 vLLM 等）。
- 纯前端实现，无后端依赖，可静态托管。
- Office / PDF 解析与 Python 沙箱均为按需动态加载，不阻塞首屏。
