import React, { useEffect, useRef, useState } from "react";
import { FlowCanvas } from "./components/FlowCanvas";
import { Sidebar } from "./components/Sidebar";
import { ChatLog } from "./components/ChatLog";
import { FileViewer } from "./components/FileViewer";
import { useAppStore, buildInitialState } from "./store/globalStore";
import { AgentScheduler } from "./core/AgentScheduler";
import { LLMClient } from "./core/LLMClient";
import { ToolRegistry } from "./core/ToolRegistry";
import { defaultTools } from "./tools";
import travelPlanner from "./presets/travelPlanner";
import multiAgentResearch from "./presets/multiAgentResearch";
import type { SceneConfig } from "./types";

type TabKey = "chat" | "files" | "logs";

const SCENES: Record<string, SceneConfig> = {
  travelPlanner,
  multiAgentResearch,
};

function App() {
  // 初始化 store 状态（从 travelPlanner 开始）
  const initialState = useRef(buildInitialState(travelPlanner));
  const [sceneKey, setSceneKey] = useState<string>("travelPlanner");
  const [tab, setTab] = useState<TabKey>("chat");
  const [canvasMode, setCanvasMode] = useState<"lane" | "group">("lane");
  const [running, setRunning] = useState(false);
  const schedulerRef = useRef<AgentScheduler | null>(null);

  // Zustand store —— 直接使用 initialState 作为初始状态
  // 每次 reset 都调用 buildInitialState 重新构建
  const store = useAppStore();
  const [, forceUpdate] = useState(0);

  // 初始化 store
  useEffect(() => {
    useAppStore.setState(initialState.current);
  }, []);

  // 强制重新渲染（因为我们直接修改 store 对象，Zustand 需要订阅变化）
  useEffect(() => {
    const unsub = useAppStore.subscribe(() => {
      forceUpdate(v => v + 1);
    });
    return unsub;
  }, []);

  // 切换场景
  const handleSceneChange = (key: string) => {
    if (running) return;
    setSceneKey(key);
    const scene = SCENES[key] ?? travelPlanner;
    useAppStore.setState(buildInitialState(scene));
    schedulerRef.current = null;
  };

  // 开始执行
  const handleStart = async () => {
    if (running) return;
    setRunning(true);

    // 构建调度器
    const state = useAppStore.getState();
    const registry = new ToolRegistry();
    for (const t of defaultTools) registry.register(t);
    const llm = new LLMClient();
    const scheduler = new AgentScheduler(
      state as unknown as GlobalState,
      registry,
      llm
    );
    schedulerRef.current = scheduler;

    const scene = SCENES[sceneKey] ?? travelPlanner;

    try {
      await scheduler.run(scene.userPrompt);
    } catch (err) {
      console.error("执行出错:", err);
    } finally {
      setRunning(false);
      schedulerRef.current = null;
    }
  };

  // 重置
  const handleReset = () => {
    if (running) return;
    const scene = SCENES[sceneKey] ?? travelPlanner;
    useAppStore.setState(buildInitialState(scene));
    schedulerRef.current = null;
    setRunning(false);
  };

  // 获取实际的全局状态（Zustand store 的完整数据）
  const globalState = useAppStore.getState() as unknown as import("./types").GlobalState;

  return (
    <div className="app-root">
      {/* 顶部栏 */}
      <header className="app-header">
        <div className="app-logo">🚀 AgentFlow</div>
        <div className="app-subtitle">AI Agent 全流程可视化工作台</div>
        <div className="scene-selector">
          <label>场景：</label>
          <select value={sceneKey} onChange={e => handleSceneChange(e.target.value)} disabled={running}>
            {Object.entries(SCENES).map(([key, scene]) => (
              <option key={key} value={key}>
                {scene.meta?.title ?? key}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="app-body">
        {/* 左侧栏 */}
        <aside className="app-sidebar">
          <Sidebar
            store={globalState}
            canvasMode={canvasMode}
            onCanvasModeChange={setCanvasMode}
            onStart={handleStart}
            onStep={() => {}}
            onReset={handleReset}
            running={running}
          />
        </aside>

        {/* 中间主画布 */}
        <main className="app-main">
          <div className="canvas-header">
            <span className="canvas-title">
              🎯 流程图 —— {Object.values(globalState.agents).length} 个 Agent
            </span>
            <span className="canvas-hint">
              {canvasMode === "lane" ? "泳道模式" : "分组模式"} · 虚线 = Agent 委托
            </span>
          </div>
          <FlowCanvas store={globalState} mode={canvasMode} />
        </main>
      </div>

      {/* 底部标签面板 */}
      <footer className="app-footer">
        <div className="tabs">
          <button className={`tab ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>
            💬 对话记录
          </button>
          <button className={`tab ${tab === "files" ? "active" : ""}`} onClick={() => setTab("files")}>
            📁 文件系统
          </button>
          <button className={`tab ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}>
            📜 执行日志 ({globalState.executionLog.length})
          </button>
        </div>
        <div className="tab-content">
          {tab === "chat" && <ChatLog store={globalState} />}
          {tab === "files" && <FileViewer store={globalState} />}
          {tab === "logs" && (
            <div className="log-viewer">
              {globalState.executionLog.length === 0 ? (
                <div className="empty-state">暂无日志</div>
              ) : (
                globalState.executionLog.map(log => (
                  <div key={log.id} className={`log-entry log-${log.level}`}>
                    <span className="log-time">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {log.agentId && (
                      <span className="log-agent">[{globalState.agents[log.agentId]?.name ?? log.agentId}]</span>
                    )}
                    <span className="log-msg">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;

// 避免 TS 未使用警告
export type GlobalState = import("./types").GlobalState;
