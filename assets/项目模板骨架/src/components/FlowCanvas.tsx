import React, { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import type { GlobalState } from "../../types";

// Agent 颜色分配
const AGENT_COLORS = [
  { bg: "#E3F2FD", border: "#2196F3", text: "#1565C0" },
  { bg: "#E8F5E9", border: "#4CAF50", text: "#2E7D32" },
  { bg: "#FFF3E0", border: "#FF9800", text: "#EF6C00" },
  { bg: "#F3E5F5", border: "#9C27B0", text: "#7B1FA2" },
  { bg: "#FFEBEE", border: "#F44336", text: "#C62828" },
  { bg: "#E0F7FA", border: "#00BCD4", text: "#00838F" },
];

function getAgentColor(agentId: string) {
  let h = 0;
  for (const c of agentId) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return AGENT_COLORS[Math.abs(h) % AGENT_COLORS.length];
}

// ========== 自定义节点 ==========

const ThinkingNode: React.FC<NodeProps> = ({ data }) => {
  const color = getAgentColor(data.agentId);
  return (
    <Handle type="target" position={Position.Left} />
    <div
      className="flow-node thinking-node"
      style={{ borderColor: color.border, background: color.bg }}
    >
      <div className="node-header" style={{ color: color.text }}>💭 思考中</div>
      <div className="node-content">{data.content || "..."}</div>
    </div>
    <Handle type="source" position={Position.Right} />
  );
};

const ToolCallNode: React.FC<NodeProps> = ({ data }) => {
  const color = getAgentColor(data.agentId);
  const statusColor =
    data.toolStatus === "running" ? "#fff"
    : data.toolStatus === "success" ? "#E8F5E9"
    : "#FFEBEE";
  return (
    <Handle type="target" position={Position.Left} />
    <div
      className="flow-node tool-node"
      style={{ borderColor: color.border, background: statusColor }}
    >
      <div className="node-header" style={{ color: color.text }}>
        🔧 {data.toolName}
        {data.toolStatus === "running" && <span className="spinner" />}
        {data.toolStatus === "success" && <span> ✓</span>}
        {data.toolStatus === "error" && <span> ✗</span>}
      </div>
      {data.toolParams && Object.keys(data.toolParams).length > 0 && (
        <details className="node-params">
          <summary>参数</summary>
          <pre>{JSON.stringify(data.toolParams, null, 2)}</pre>
        </details>
      )}
    </div>
    <Handle type="source" position={Position.Right} />
  );
};

const ResultNode: React.FC<NodeProps> = ({ data }) => {
  const color = getAgentColor(data.agentId);
  return (
    <Handle type="target" position={Position.Left} />
    <div
      className="flow-node result-node"
      style={{ borderColor: color.border, background: "#fafafa" }}
    >
      <div className="node-header" style={{ color: color.text }}>📋 结果</div>
      <div className="node-content result-content">{data.content || "(空)"}</div>
    </div>
    <Handle type="source" position={Position.Right} />
  );
};

const DoneNode: React.FC<NodeProps> = ({ data }) => {
  const color = getAgentColor(data.agentId);
  return (
    <Handle type="target" position={Position.Left} />
    <div
      className="flow-node done-node"
      style={{ borderColor: color.border, background: "#C8E6C9", textAlign: "center" }}
    >
      ✅ 完成
      {data.agentName && <div className="agent-label">{data.agentName}</div>}
    </div>
    <Handle type="source" position={Position.Right} />
  );
};

const nodeTypes = {
  thinking: ThinkingNode,
  tool_call: ToolCallNode,
  result: ResultNode,
  done: DoneNode,
};

// ========== 主组件 ==========

interface FlowCanvasProps {
  store: GlobalState;
  mode: "lane" | "group";
}

const NODE_GAP = 240;
const NODE_WIDTH = 200;
const LANE_HEIGHT = 120;
const LANE_GAP = 20;

export const FlowCanvas: React.FC<FlowCanvasProps> = ({ store, mode }) => {
  const { nodes, edges } = useMemo(() => buildFlowGraph(store, mode), [store, mode]);

  // 自动调整画布大小
  const maxX = Math.max(...nodes.map(n => n.position.x)) + NODE_WIDTH + 40;
  const maxY =
    mode === "lane"
      ? (Object.keys(store.agents).length) * (LANE_HEIGHT + LANE_GAP) + LANE_HEIGHT
      : Math.max(...nodes.map(n => n.position.y)) + 200;

  return (
    <div className="flow-canvas-container" style={{ height: maxY + 100, minHeight: 400 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={n => getAgentColor((n.data as any).agentId).border}
          nodeStrokeWidth={3}
        />
      </ReactFlow>
    </div>
  );
};

// ========== 图构建 ==========

function buildFlowGraph(store: GlobalState, mode: "lane" | "group"): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const agents = Object.values(store.agents);

  agents.forEach((agent, agentIdx) => {
    const color = getAgentColor(agent.id);
    const laneY = agentIdx * (LANE_HEIGHT + LANE_GAP) + 40;
    let stepIndex = 0;
    let prevNodeId: string | null = null;

    // 1. Thinking 节点（最近一个 assistant message）
    const lastAssistant = [...agent.messages].reverse().find(m => m.role === "assistant");
    if (agent.status !== "idle" || agent.toolHistory.length > 0) {
      const thinkNodeId = `${agent.id}-think-${stepIndex}`;
      const x = stepIndex * NODE_GAP + 20;
      const y = mode === "lane" ? laneY : 40 + Math.random() * 40;
      nodes.push({
        id: thinkNodeId,
        type: "thinking",
        position: { x, y },
        data: {
          agentId: agent.id,
          content: lastAssistant?.content?.slice(0, 150) ?? agent.status,
          color,
        },
      });
      if (prevNodeId) edges.push({ id: `e-${prevNodeId}-${thinkNodeId}`, source: prevNodeId, target: thinkNodeId });
      prevNodeId = thinkNodeId;
      stepIndex++;
    }

    // 2. Tool call 节点
    agent.toolHistory.forEach((exec, toolIdx) => {
      const toolNodeId = `${agent.id}-tool-${toolIdx}`;
      const x = stepIndex * NODE_GAP + 20;
      const y = mode === "lane" ? laneY : 40 + Math.random() * 40;
      nodes.push({
        id: toolNodeId,
        type: "tool_call",
        position: { x, y },
        data: {
          agentId: agent.id,
          toolName: exec.toolName,
          toolParams: exec.params,
          toolStatus: exec.status,
          color,
        },
      });
      if (prevNodeId) edges.push({ id: `e-${prevNodeId}-${toolNodeId}`, source: prevNodeId, target: toolNodeId });
      prevNodeId = toolNodeId;

      // 跨 Agent 连线：如果是 agent_call，找目标 Agent 的第一个节点
      if (exec.toolName === "agent_call" && exec.status === "success") {
        const targetId = (exec.params as any)?.agentId;
        if (targetId) {
          const targetNode = nodes.find(n => n.id.startsWith(`${targetId}-`));
          if (targetNode) {
            edges.push({
              id: `cross-${toolNodeId}-${targetNode.id}`,
              source: toolNodeId,
              target: targetNode.id,
              type: "smoothstep",
              style: { strokeDasharray: "6,4", stroke: "#888", strokeWidth: 2 },
              label: `委托 → ${store.agents[targetId]?.name ?? targetId}`,
              labelStyle: { fill: "#666", fontSize: 11 },
            });
          }
        }
      }

      // Result 节点
      const resultNodeId = `${agent.id}-result-${toolIdx}`;
      const rx = (stepIndex + 1) * NODE_GAP + 20;
      nodes.push({
        id: resultNodeId,
        type: "result",
        position: { x: rx, y },
        data: {
          agentId: agent.id,
          content: typeof exec.result === "string"
            ? exec.result.slice(0, 120)
            : exec.error ?? (exec.status === "success" ? "✓ 执行成功" : ""),
          color,
        },
      });
      edges.push({ id: `e-${toolNodeId}-${resultNodeId}`, source: toolNodeId, target: resultNodeId });
      prevNodeId = resultNodeId;
      stepIndex += 2;
    });

    // 3. Done 节点
    if (agent.status === "done") {
      const doneNodeId = `${agent.id}-done`;
      const x = stepIndex * NODE_GAP + 20;
      const y = mode === "lane" ? laneY : 40 + Math.random() * 40;
      nodes.push({
        id: doneNodeId,
        type: "done",
        position: { x, y },
        data: { agentId: agent.id, agentName: agent.name, color },
      });
      if (prevNodeId) edges.push({ id: `e-${prevNodeId}-${doneNodeId}`, source: prevNodeId, target: doneNodeId });
    }

    // 4. Agent 泳道标题（lane 模式）
    if (mode === "lane") {
      const titleId = `${agent.id}-title`;
      nodes.push({
        id: titleId,
        type: "thinking", // 复用一个简单的展示类型
        position: { x: -250, y: laneY - 20 },
        data: {
          agentId: agent.id,
          content: `【${agent.name}】(${agent.status})`,
          color,
        },
        draggable: false,
      });
    }
  });

  return { nodes, edges };
}
