---
name: agent-workflow-visualizer
description: Generate AI Agent workflow visualization frontend with single-agent and multi-agent DAG support. Use when the user asks for Agent flow UI, Agent execution teaching demo, tool-call visualization, or multi-agent collaboration display. Do not use for backend Agent execution logic or generic chat UI.
---

# Agent Workflow Visualizer

生成一个可直接运行的 AI Agent 执行过程可视化前端项目。支持单 Agent 和多 Agent DAG 协作，把 Agent 的思考、工具调用、结果返回完整呈现在流程画布上。

## 触发条件

当用户提到以下意图时触发本 Skill：
- Agent 可视化界面 / Agent 流程图 / Agent flow 展示
- AI Agent 执行过程展示 / Agent 教学演示
- 工具调用可视化 / tool call 实时展示
- 多 Agent 协作界面 / Agent 分工可视化
- 观察 Agent 思考过程 / Agent trace 展示

## 参考资料（生成时按需加载）

- `references/架构设计.md` — 整体架构分层、单/多 Agent 统一设计哲学
- `references/DAG调度器设计.md` — AgentScheduler 核心调度逻辑
- `references/工具注册机制.md` — AgentTool 接口规范 + 12 种工具清单
- `references/多Agent可视化方案.md` — ReactFlow 泳道/分组双模式实现要点
- `references/演示场景模板.md` — 预设场景结构和自定义场景写法

## 生成流程

### Step 1：需求澄清

在动手前，用 3 个问题锁定用户意图（都有默认值，用户可直接跳过）：

1. **项目路径** — 默认在当前工作目录下新建 `agent-visualizer/`
2. **Agent 规模** — 默认多 Agent 就绪（骨架天生支持），单 Agent 只需配置 DAG 为 1 个节点
3. **Python 沙箱** — 默认需要（Pyodide WASM 动态加载，不阻塞首屏）

### Step 2：创建项目

1. 用 Vite 初始化 React + TypeScript 项目
   ```bash
   npm create vite@latest <project-path> -- --template react-ts
   ```

2. 安装依赖
   ```bash
   npm install reactflow zustand jszip xlsx mammoth zod
   ```

3. 安装 Pyodide + MuPDF（动态加载，体积较大）
   ```bash
   npm install pyodide @mupdf/mupdf
   ```

### Step 3：复制骨架代码

将 `assets/项目模板骨架/` 下的所有文件复制到目标项目根目录（覆盖 Vite 默认的 src/）：
- `package.json` 中的依赖已预填，需合并
- `vite.config.ts` 需合并 Pyodide WASM 相关配置
- `src/` 目录整体复制

### Step 4：按用户需求配置

根据用户描述的 Agent 数量和协作关系，编辑 `src/presets/` 下的场景文件或新建：

**单 Agent 示例：**
```typescript
// src/presets/myPreset.ts
export default {
  dag: {
    agents: ["assistant"],
    edges: [],
    entryAgentId: "assistant",
  },
  agents: [
    { id: "assistant", name: "助手", systemPrompt: "你是一个有用的 AI 助手" },
  ],
  userPrompt: "用户的初始指令",
};
```

**多 Agent 示例：**
```typescript
export default {
  dag: {
    agents: ["planner", "researcher", "writer"],
    edges: [
      { from: "planner", to: "researcher", type: "delegate" },
      { from: "researcher", to: "writer", type: "depends_on" },
    ],
    entryAgentId: "planner",
  },
  agents: [
    { id: "planner", name: "规划师", systemPrompt: "..." },
    { id: "researcher", name: "搜索员", systemPrompt: "..." },
    { id: "writer", name: "写作者", systemPrompt: "..." },
  ],
  userPrompt: "用户的初始指令",
};
```

然后在 `src/App.tsx` 的 `import preset from "./presets/myPreset"` 处改为实际场景。

### Step 5：（可选）对接真实 LLM

默认骨架内置 **mock 模式**（演示用，不走真实 API）。

如需对接真实 LLM，编辑 `src/core/LLMClient.ts` 中的 `callLLM` 方法，改为真实 API 调用。LLM 提供商选择：
- OpenAI 兼容 API（OpenAI / Deepseek / 本地部署都兼容）
- 具体实现方式参见 `references/架构设计.md` 的 LLM 对接章节

### Step 6：验证运行

```bash
npm install
npm run dev
```

确保：
- 构建无 TypeScript 错误
- 浏览器打开后能看到预设场景的流程图
- 点击"开始"后 Agent 状态能流转（thinking → tool_call → result → done）

## 骨架核心说明

生成的项目包含以下关键模块，修改/扩展时参考 `references/` 文档：

| 模块 | 位置 | 职责 |
|------|------|------|
| DAG 调度器 | `src/core/AgentScheduler.ts` | 驱动所有 Agent 的状态流转，处理 Agent 间委托 |
| LLM 客户端 | `src/core/LLMClient.ts` | 封装 LLM 调用，支持 mock 和真实 API |
| 工具注册中心 | `src/core/ToolRegistry.ts` | 注册和查找所有工具 |
| 虚拟文件系统 | `src/core/VFS.ts` | 跨 Agent 共享的内存文件系统 |
| 全局状态 | `src/store/globalStore.ts` | Zustand store，`agents: Record<string, AgentState>` 天然支持多 Agent |
| 工具实现 | `src/tools/*.ts` | 12 种标准工具 + `agent_call` 多 Agent 委托 |
| UI 画布 | `src/components/FlowCanvas.tsx` | ReactFlow 双模式：泳道 / 分组 |
| Office 预览 | `src/components/officePreview/` | docx / xlsx / pptx / pdf 浏览器端解析 |

## 扩展指南

### 添加新工具
1. 在 `src/tools/` 下新建 `MyTool.ts`，实现 `AgentTool` 接口
2. 在 `src/tools/index.ts` 的默认导出数组中加入 `new MyTool()`
3. 所有已注册的工具会自动出现在 LLM 的 system prompt 中

### 添加新 Agent
1. 在场景配置的 `agents[]` 中加一项
2. 在 `dag.edges[]` 中声明与其他 Agent 的关系
3. UI 画布会自动为新 Agent 分配泳道/颜色

### 替换 Python 执行后端
默认 `PythonExecTool` 用 Pyodide WASM。如需改为后端服务：只需重写 `execute` 函数，其他代码不动。
