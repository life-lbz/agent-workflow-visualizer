# 多 Agent 可视化方案

> ReactFlow 画布双模式实现

---

## 一、两种展示模式

### 模式 A：泳道模式（默认，直观清晰）

每个 Agent 独立一行横向分区，Agent 状态流转在自己的泳道里线性生长。

```
┌─ Agent A: 规划师 ─────────────────────────────────────┐
│  [思考] ──→ [agent_call] ──→ [等待]                   │
│                              │                         │
└──────────────────────────────┼─────────────────────────┘
                               │ 委托
┌─ Agent B: 搜索员 ────────────┼─────────────────────────┐
│                              ↓                         │
│  [思考] ──→ [web_search] ──→ [思考] ──→ [完成]         │
└────────────────────────────────────────────────────────┘

┌─ Agent A 恢复 ────────────────────────────────────────┐
│  [思考: 收到搜索结果] ──→ [file_write] ──→ [完成]      │
└────────────────────────────────────────────────────────┘
```

**优点**：Agent 职责隔离清晰，一眼看出各 Agent 在做什么
**适用**：Agent 数量 ≤ 5 的场景

### 模式 B：分组/颜色模式（紧凑）

所有 Agent 节点在同一画布，用不同颜色区分 Agent，agent_call 画跨 Agent 虚线。

```
          颜色图例：
          ● Agent A (蓝)  ● Agent B (绿)

    ┌─ 蓝:[思考] ──→ 蓝:[agent_call] ──┐
    │                                     │ (虚线: 委托)
    │                                     ↓
    │                          绿:[思考] ──→ 绿:[web_search]
    │                                          │
    │  蓝:[思考:等待] ←───────────────────────┘
    │
    └─ 蓝:[file_write] ──→ 蓝:[完成]
```

**优点**：紧凑，Agent 多的时候省空间，能清楚看到 Agent 间连线
**适用**：Agent 数量 > 5 或 Agent 间交互频繁的场景

---

## 二、ReactFlow 实现要点

### 2.1 节点类型

```typescript
// 画布上只有 3 种节点，按 agentId 区分所属
type FlowNodeType = "thinking" | "tool_call" | "result";

interface FlowNode {
  id: string;                    // 全局唯一
  type: FlowNodeType;
  position: { x: number; y: number };
  data: {
    agentId: string;              // 属于哪个 Agent
    agentName: string;
    stepIndex: number;            // 该 Agent 内部第几步
    timestamp: number;
    // 类型特有数据
    content?: string;             // thinking: LLM 输出文字
    toolName?: string;            // tool_call: 工具名
    toolParams?: unknown;         // tool_call: 工具参数
    toolStatus?: "running" | "success" | "error";
    toolResult?: string;          // result: 工具返回内容
  };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: "default" | "agent-call";  // agent_call 用虚线样式
  animated?: boolean;
  label?: string;
}
```

### 2.2 泳道实现

每个 Agent 对应一个 `AgentLane` 组件，内部用 ReactFlow 的 `nodeGroup` 或自定义容器：

```typescript
function AgentLane({ agent, yOffset }: { agent: SingleAgentState; yOffset: number }) {
  // 该泳道内的节点，x 按 stepIndex 递增，y 固定（泳道高度内居中）
  const nodes = agent.toolHistory.map((exec, idx) => ({
    id: exec.id,
    type: "tool_call",
    position: { x: idx * 200, y: yOffset + 50 },
    data: { agentId: agent.id, toolName: exec.toolName, ... },
  }));

  // 相邻节点连边
  const edges = agent.toolHistory.slice(0, -1).map((_, idx) => ({
    id: `${agent.id}-e${idx}`,
    source: agent.toolHistory[idx].id,
    target: agent.toolHistory[idx + 1].id,
  }));

  return (
    <div style={{ height: 150, borderBottom: "1px solid #e0e0e0" }}>
      <div style={{ padding: "8px 16px", background: getAgentColor(agent.id) }}>
        {agent.name} — {agent.status}
      </div>
      <ReactFlow nodes={nodes} edges={edges} fitView />
    </div>
  );
}
```

### 2.3 agent_call 跨 Agent 连线

```typescript
// 当 Agent A 的 tool_call 是 agent_call 时
// 画一条从 A 的 tool_call 节点到 B 的第一个 thinking 节点的虚线
const crossAgentEdge: FlowEdge = {
  id: `cross-${exec.id}`,
  source: exec.id,                    // Agent A 的 agent_call 节点
  target: firstThinkingNodeOfAgentB.id, // Agent B 的起始节点
  type: "agent-call",
  style: { strokeDasharray: "5,5", stroke: "#888" },
  label: `委托 → ${targetAgentName}`,
};
```

### 2.4 模式切换

左侧配置栏提供一个 Radio 切换：

```typescript
<fieldset>
  <legend>画布模式</legend>
  <label>
    <input type="radio" value="lane" checked={mode === "lane"}
           onChange={() => setMode("lane")} />
    泳道模式
  </label>
  <label>
    <input type="radio" value="group" checked={mode === "group"}
           onChange={() => setMode("group")} />
    分组模式
  </label>
</fieldset>
```

---

## 三、Agent 颜色分配

```typescript
const AGENT_COLORS = [
  { bg: "#E3F2FD", border: "#2196F3", text: "#1565C0" },  // 蓝
  { bg: "#E8F5E9", border: "#4CAF50", text: "#2E7D32" },  // 绿
  { bg: "#FFF3E0", border: "#FF9800", text: "#EF6C00" },  // 橙
  { bg: "#F3E5F5", border: "#9C27B0", text: "#7B1FA2" },  // 紫
  { bg: "#FFEBEE", border: "#F44336", text: "#C62828" },  // 红
  { bg: "#E0F7FA", border: "#00BCD4", text: "#00838F" },  // 青
  { bg: "#FFFDE7", border: "#FFC107", text: "#F57F17" },  // 黄
  { bg: "#ECEFF1", border: "#607D8B", text: "#37474F" },  // 灰
];

function getAgentColor(agentId: string): typeof AGENT_COLORS[0] {
  const idx = hashString(agentId) % AGENT_COLORS.length;
  return AGENT_COLORS[idx];
}

function hashString(s: string): number {
  let h = 0;
  for (const c of s) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}
```

---

## 四、自定义节点渲染

### thinking 节点

```tsx
function ThinkingNode({ data }: { data: FlowNode["data"] }) {
  const [displayed, setDisplayed] = useState("");
  // 如果流式输出中，打字机效果
  useEffect(() => {
    if (data.content) {
      setDisplayed(data.content);
    }
  }, [data.content]);

  return (
    <Handle type="target" position={Position.Left} />
    <div className="node-thinking" style={{ borderColor: data.color?.border }}>
      <div className="node-header">💭 思考中...</div>
      <div className="node-content">{displayed}</div>
      <div className="node-timestamp">{formatTime(data.timestamp)}</div>
    </div>
    <Handle type="source" position={Position.Right} />
  );
}
```

### tool_call 节点

```tsx
function ToolCallNode({ data }: { data: FlowNode["data"] }) {
  const icon = TOOL_ICONS[data.toolName] ?? "🔧";
  return (
    <Handle type="target" position={Position.Left} />
    <div className="node-tool-call" style={{
      borderColor: data.color?.border,
      background: data.toolStatus === "running" ? "#fff"
                : data.toolStatus === "success" ? "#E8F5E9"
                : "#FFEBEE",
    }}>
      <div className="node-header">
        {icon} {data.toolName}
        {data.toolStatus === "running" && <span className="spinner" />}
        {data.toolStatus === "success" && <span>✓</span>}
        {data.toolStatus === "error" && <span>✗</span>}
      </div>
      <details>
        <summary>参数</summary>
        <pre>{JSON.stringify(data.toolParams, null, 2)}</pre>
      </details>
    </div>
    <Handle type="source" position={Position.Right} />
  );
}
```

---

## 五、自适应布局

### 泳道模式 y 坐标计算

```typescript
const LANE_HEIGHT = 150;
const LANE_GAP = 10;

function computeAgentLaneY(agentIndex: number): number {
  return agentIndex * (LANE_HEIGHT + LANE_GAP);
}
```

### 节点 x 坐标自动增长

每个 Agent 内部，第 N 步的节点 x = N * NODE_GAP：

```typescript
const NODE_GAP = 220;

function computeStepX(stepIndex: number): number {
  return stepIndex * NODE_GAP;
}
```

### agent_call 跨泳道连线

```typescript
// 从 Agent A 的第 i 个 tool_call 节点 → Agent B 的第一个 thinking 节点
const sourceY = computeAgentLaneY(agentAIndex) + LANE_HEIGHT / 2;
const targetY = computeAgentLaneY(agentBIndex) + LANE_HEIGHT / 2;
// ReactFlow 的 edge 会自动走贝塞尔曲线连接两个节点
```
