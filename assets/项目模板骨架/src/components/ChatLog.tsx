import React from "react";
import type { GlobalState } from "../types";

interface ChatLogProps {
  store: GlobalState;
}

export const ChatLog: React.FC<ChatLogProps> = ({ store }) => {
  const agents = Object.values(store.agents);
  const allMessages: Array<{ agent: string; messages: GlobalState["agents"][string]["messages"][number] }> = [];

  for (const agent of agents) {
    for (const msg of agent.messages) {
      allMessages.push({ agent: agent.name, messages: msg });
    }
  }

  allMessages.sort((a, b) => a.messages.timestamp - b.messages.timestamp);

  return (
    <div className="chat-log">
      {allMessages.length === 0 ? (
        <div className="empty-state">暂无对话记录，点击"开始执行"后会实时显示</div>
      ) : (
        allMessages.map((item, idx) => (
          <div key={idx} className={`chat-message role-${item.messages.role}`}>
            <div className="chat-meta">
              <span className="chat-agent">[{item.agent}]</span>
              <span className="chat-role">{item.messages.role}</span>
              <span className="chat-time">
                {new Date(item.messages.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="chat-content">{item.messages.content}</div>
          </div>
        ))
      )}
    </div>
  );
};
