import { create } from "zustand";
import type {
  DagGraph,
  GlobalState,
  SingleAgentState,
  SceneConfig,
} from "../types";

// 生成唯一 ID
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * 从场景配置构建初始 GlobalState
 */
export function buildInitialState(scene: SceneConfig): GlobalState {
  const agents: Record<string, SingleAgentState> = {};

  for (const a of scene.agents) {
    agents[a.id] = {
      id: a.id,
      name: a.name,
      status: "idle",
      systemPrompt: a.systemPrompt,
      messages: [],
      toolHistory: [],
      tokenUsage: { input: 0, output: 0 },
    };
  }

  const dag: DagGraph = {
    agents: scene.dag.agents,
    edges: scene.dag.edges.map(e => ({ ...e })),
    entryAgentId: scene.dag.entryAgentId,
  };

  const files: Record<string, GlobalState["virtualFileSystem"]["files"][string]> = {};
  // 预置文件
  for (const f of scene.initialFiles ?? []) {
    files[f.path] = {
      path: f.path,
      content: f.content,
      type: f.type === "csv" || f.type === "markdown" || f.type === "json" ? "text" : "text",
      size: f.content.length,
      lastModified: Date.now(),
    };
  }

  return {
    dag,
    agents,
    executionLog: [],
    virtualFileSystem: { files, rootPath: "/workspace" },
    config: {
      mode: "demo",
      canvasMode: "lane",
    },
  };
}

// Zustand store
export interface AppStore extends GlobalState {
  // ========== Actions ==========

  /** 重置到初始场景 */
  reset: (scene: SceneConfig) => void;

  /** 更新单个 Agent 状态（内部引用已共享，一般不需要） */
  setAgent: (agentId: string, updater: (agent: SingleAgentState) => void) => void;

  /** 设置配置 */
  setConfig: (patch: Partial<GlobalState["config"]>) => void;

  /** 清空执行日志 */
  clearLog: () => void;

  /** 往虚拟文件系统写文件 */
  writeFile: (path: string, content: string, type?: "text" | "image" | "binary") => void;

  /** 从虚拟文件系统读文件 */
  readFile: (path: string) => string | Uint8Array | null;

  /** 清空虚拟文件系统 */
  clearVFS: () => void;

  /** 生成 UUID */
  uid: () => string;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // 初始占位（实际会在 App.tsx 里通过 reset(scene) 覆盖）
  dag: { agents: [], edges: [], entryAgentId: "" },
  agents: {},
  executionLog: [],
  virtualFileSystem: { files: {}, rootPath: "/workspace" },
  config: { mode: "demo", canvasMode: "lane" },

  reset: (scene) => {
    const initial = buildInitialState(scene);
    set(initial);
  },

  setAgent: (agentId, updater) => {
    const state = get();
    const agent = state.agents[agentId];
    if (agent) {
      updater(agent);
      set({ agents: { ...state.agents } });
    }
  },

  setConfig: (patch) => set(state => ({ config: { ...state.config, ...patch } })),

  clearLog: () => set({ executionLog: [] }),

  writeFile: (path, content, type = "text") =>
    set(state => ({
      virtualFileSystem: {
        ...state.virtualFileSystem,
        files: {
          ...state.virtualFileSystem.files,
          [path]: {
            path,
            content,
            type,
            size: content.length,
            lastModified: Date.now(),
          },
        },
      },
    })),

  readFile: (path) => get().virtualFileSystem.files[path]?.content ?? null,

  clearVFS: () =>
    set(state => ({
      virtualFileSystem: { ...state.virtualFileSystem, files: {} },
    })),

  uid,
}));
