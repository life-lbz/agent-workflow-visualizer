// ============================================================
// AgentFlow Visualizer — 全部类型定义
// ============================================================

// ---------- Agent 状态 ----------

export type AgentStatus =
  | "idle"          // 等待启动
  | "thinking"      // LLM 思考中
  | "tool_call"     // 执行工具中
  | "awaiting_input" // 等待用户输入或子 Agent 返回
  | "done"          // 完成
  | "error";        // 出错

export interface AgentMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  toolCallId?: string;
}

export interface ToolExecution {
  id: string;
  toolName: string;
  agentId: string;
  params: Record<string, unknown>;
  status: "running" | "success" | "error";
  result?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
}

export interface SingleAgentState {
  id: string;
  name: string;
  status: AgentStatus;
  systemPrompt: string;
  messages: AgentMessage[];
  currentToolCall?: ToolExecution;
  toolHistory: ToolExecution[];
  tokenUsage: { input: number; output: number };
  error?: string;
}

// ---------- DAG 拓扑 ----------

export type DagEdgeType = "delegate" | "depends_on" | "parallel";

export interface DagEdge {
  from: string;
  to: string;
  type: DagEdgeType;
  description?: string;
}

export interface DagGraph {
  agents: string[];
  edges: DagEdge[];
  entryAgentId: string;
}

// ---------- 工具接口 ----------

import type { z } from "zod";

export interface Artifact {
  type: "file" | "image" | "chart" | "code";
  name: string;
  data: unknown;
}

export interface ToolResult {
  success: boolean;
  output: string;
  raw?: unknown;
  artifacts?: Artifact[];
}

export interface ToolContext {
  agentId: string;
  store: GlobalState;
  scheduler?: import("../core/AgentScheduler").AgentScheduler;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: z.ZodType;
  execute: (params: unknown, context: ToolContext) => Promise<ToolResult>;
}

// ---------- LLM ----------

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  stream?: boolean;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  params: Record<string, unknown>;
}

export interface LLMResponse {
  text: string;
  toolCalls?: ToolCallRequest[];
  usage?: { input: number; output: number };
}

// ---------- 虚拟文件系统 ----------

export interface VFSFile {
  path: string;
  content: string | Uint8Array;
  type: "text" | "image" | "binary";
  size: number;
  lastModified: number;
}

export interface VFSState {
  files: Record<string, VFSFile>;
  rootPath: string;
}

// ---------- 全局状态 ----------

export interface LogEntry {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error";
  agentId?: string;
  message: string;
}

export interface GlobalConfig {
  mode: "demo" | "live";     // 演示模式 / 实时模式
  llm?: LLMConfig;
  canvasMode: "lane" | "group"; // 泳道 / 分组
}

export interface GlobalState {
  dag: DagGraph;
  agents: Record<string, SingleAgentState>;
  executionLog: LogEntry[];
  virtualFileSystem: VFSState;
  config: GlobalConfig;
}

// ---------- 场景配置 ----------

export interface SceneConfig {
  dag: {
    agents: string[];
    edges: Array<{
      from: string;
      to: string;
      type: DagEdgeType;
      description?: string;
    }>;
    entryAgentId: string;
  };
  agents: Array<{
    id: string;
    name: string;
    systemPrompt: string;
  }>;
  userPrompt: string;
  initialFiles?: Array<{
    path: string;
    content: string;
    type?: "text" | "csv" | "markdown" | "json";
  }>;
  meta?: {
    title?: string;
    description?: string;
    tags?: string[];
  };
}
