import React from "react";
import type { GlobalState } from "../types";

interface SidebarProps {
  store: GlobalState;
  canvasMode: "lane" | "group";
  onCanvasModeChange: (mode: "lane" | "group") => void;
  onStart: () => void;
  onStep: () => void;
  onReset: () => void;
  running: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  store,
  canvasMode,
  onCanvasModeChange,
  onStart,
  onReset,
  running,
}) => {
  const agents = Object.values(store.agents);
  const totalTokens = agents.reduce(
    (sum, a) => sum + a.tokenUsage.input + a.tokenUsage.output,
    0
  );
  const allDone = agents.length > 0 && agents.every(a => a.status === "done");
  const hasError = agents.some(a => a.status === "error");

  return (
    <div className="sidebar">
      <div className="sidebar-section">
        <h3>🎬 执行控制</h3>
        <div className="btn-group">
          {!allDone && !hasError && (
            <button className="btn-primary" onClick={onStart} disabled={running}>
              {running ? "⏳ 执行中..." : "▶ 开始执行"}
            </button>
          )}
          <button className="btn-secondary" onClick={onReset}>
            ↺ 重置
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <h3>👥 Agent 列表</h3>
        <div className="agent-list">
          {agents.map(agent => (
            <div key={agent.id} className={`agent-card agent-status-${agent.status}`}>
              <div className="agent-name">{agent.name}</div>
              <div className="agent-status-badge">{agent.status}</div>
              <div className="agent-tools">
                工具调用: {agent.toolHistory.length}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <h3>🎨 画布模式</h3>
        <div className="mode-switch">
          <label>
            <input
              type="radio"
              value="lane"
              checked={canvasMode === "lane"}
              onChange={() => onCanvasModeChange("lane")}
            />
            泳道模式
          </label>
          <label>
            <input
              type="radio"
              value="group"
              checked={canvasMode === "group"}
              onChange={() => onCanvasModeChange("group")}
            />
            分组模式
          </label>
        </div>
      </div>

      <div className="sidebar-section">
        <h3>📊 统计</h3>
        <div className="stat-row">
          <span>Agent 数量</span>
          <span>{agents.length}</span>
        </div>
        <div className="stat-row">
          <span>总 Token</span>
          <span>{totalTokens.toLocaleString()}</span>
        </div>
        <div className="stat-row">
          <span>工具调用</span>
          <span>{agents.reduce((s, a) => s + a.toolHistory.length, 0)}</span>
        </div>
        <div className="stat-row">
          <span>日志条数</span>
          <span>{store.executionLog.length}</span>
        </div>
      </div>
    </div>
  );
};
