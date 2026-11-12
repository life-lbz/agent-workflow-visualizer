# Agent Workflow Visualizer

一个用于生成 **AI Agent 执行过程可视化前端项目** 的 skill。

## 描述

当用户需要一个能"看见"Agent 在干什么的界面时，这个 skill 会生成一个可直接运行的前端项目：把 Agent 的思考、工具调用、结果返回，按时间顺序铺在流程画布上，支持单 Agent 与多 Agent DAG 协作两种规模。

**触发场景：**

- Agent 执行过程可视化、Agent 流程图界面
- AI Agent 演示、执行链路回放
- 工具调用（tool call）实时展示
- 多 Agent 协作分工与委托关系展示

**不适用：** 后端 Agent 执行逻辑、通用聊天界面。

## 内容

```
.
├── SKILL.md                     入口指令：触发条件 + 生成流程
├── README.md                    本文件
├── references/                  生成时按需加载的架构文档
│   ├── 架构设计.md               分层结构、数据流、LLM 对接
│   ├── DAG调度器设计.md          调度器职责、状态机、拓扑约束
│   ├── 工具注册机制.md           工具接口规范与 12 种工具说明
│   ├── 多Agent可视化方案.md      画布双模式、节点渲染、布局算法
│   └── 演示场景模板.md           场景配置结构与自定义写法
└── assets/
    └── 项目模板骨架/             完整可运行的 Vite + React 项目
        ├── package.json
        ├── vite.config.ts
        ├── tsconfig.json
        ├── index.html
        └── src/
            ├── core/           AgentScheduler / LLMClient / VFS / ToolRegistry
            ├── store/          Zustand 全局状态
            ├── tools/          12 种工具 + agent_call
            ├── components/     流程画布、侧边栏、对话日志、文件预览
            ├── presets/        内置演示场景
            ├── types/          类型定义
            └── styles/         全局样式
```

SKILL.md 是唯一必需文件，references 提供生成时的深度参考，assets 提供可直接复制的项目骨架。

## 方案

### 一、单 Agent 与多 Agent 统一为同一个引擎

不区分"单 Agent 模式"和"多 Agent 模式"，统一用 DAG 表达：

```
单 Agent = DAG 只有 1 个节点，内部是线性状态机
多 Agent = DAG 有 N 个节点，节点间用边声明委托或依赖
```

Agent 数量只是配置差异，引擎代码不需要分叉。

### 二、每个 Agent 内部是线性状态机

```
idle → thinking → tool_call → thinking → ... → done
                     ↑            │
                     └── 结果回填 ─┘
```

LLM 返回纯文本则结束，返回工具调用则执行后继续思考，直到不再需要工具。

### 三、Agent 之间三条协作通路

| 层级 | 机制 | 说明 |
|------|------|------|
| 调度层 | `AgentScheduler` | 按 DAG 拓扑决定谁先启动、谁等谁完成 |
| 工具层 | `agent_call` | Agent A 把子任务委托给 Agent B，同步等待结果后继续 |
| 数据层 | 虚拟文件系统 | Agent 之间通过共享内存文件间接传递上下文 |

三种通路可以叠加使用：规划师委托搜索员，搜索员把结果写文件，写作者读文件产出报告。

### 四、工具层用统一接口解耦

所有工具实现同一个 `AgentTool` 接口：

```
name         唯一标识，LLM 据此选择工具
description  能力说明，注入 LLM 的 system prompt
parameters   参数校验 Schema，拦截非法入参
execute      执行逻辑，接收参数与上下文，返回统一结果
```

状态机只认接口不认实现，因此工具可以独立开关、独立替换。默认提供 12 种：

| 类别 | 工具 |
|------|------|
| 文件系统 | `file_read` / `file_write` / `file_edit` / `file_search` |
| 代码执行 | `python_exec`（浏览器内 WASM 沙箱） |
| Shell | `shell`（前端模拟管道、通配符、grep、find、wc） |
| 网络 | `web_search` / `web_fetch` / `http_request` |
| 交互 | `user_input` |
| 多 Agent | `agent_call` |

### 五、画布提供两种布局

| 模式 | 表现 | 适用 |
|------|------|------|
| 泳道模式 | 每个 Agent 占一行横向分区，各自独立生长 | Agent 数量少，职责边界清晰 |
| 分组模式 | 全部节点在同一画布，用颜色区分 Agent，委托关系画虚线 | Agent 数量多，交互频繁 |

两种模式共用同一份状态，切换只影响布局计算。

### 六、重资源按需加载

Python 沙箱、Office 解析、PDF 渲染体积都很大，全部做成动态加载，首屏只加载画布与状态管理，不阻塞启动。

### 七、默认 mock，可替换为真实模型

骨架内置 mock LLM，无需 API Key 即可完整演示整条链路。对接真实模型只需替换 `LLMClient` 中的一次调用，协议按 OpenAI 兼容格式，可适配云端 API 或本地部署。

## 使用

把整个目录放入全局 skill 目录后，在对话中提出需求即可触发，例如：

- "帮我做一个 Agent 执行过程的可视化演示页面"
- "需要一个展示多 Agent 协作的流程图界面"
- "给我的 AI Agent 做个可视化前端"

也可以直接复制 `assets/项目模板骨架/` 手动运行：

```bash
cd assets/项目模板骨架
npm install
npm run dev
```

打开页面点击「开始执行」，即可看到流程图实时生长、状态逐个流转。
