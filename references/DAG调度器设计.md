# DAG 调度器设计

> 核心引擎，所有 Agent 的状态流转由它驱动

---

## 一、职责

AgentScheduler 是整个骨架的心脏，负责：

1. 按 DAG 拓扑启动 Agent
2. 驱动每个 Agent 内部的线性状态机
3. 处理 Agent 间的委托（agent_call 工具）和依赖（depends_on 边）
4. 将状态变更实时写入 Zustand store，UI 自动刷新

---

## 二、单 Agent 线性状态机

每个 Agent 内部独立运行这个循环：

```
  idle ── run() ──→ thinking ──┐
                     │          │
                     │  LLM 返回  │
                     │  tool_calls│
                     ↓          │
                 tool_call ─────┤
                     │          │
                     │  工具执行  │
                     │  拿到结果  │
                     ↓          │
                 thinking ←────┘
                     │
                     │  LLM 返回纯文本（无 tool_calls）
                     ↓
                    done

  异常随时可能进入 → error
```

---

## 三、多 Agent DAG 协作

### 3.1 两种协作机制

| 机制 | 实现 | 时序 |
|------|------|------|
| **委托（delegate）** | Agent A 通过 `agent_call` 工具启动 Agent B | 同步等待子 Agent 完成后继续 |
| **依赖（depends_on）** | DAG 边约束：Agent B 必须等 Agent A done 后才能启动 | 调度器自动处理 |

### 3.2 agent_call 工具的执行流程

```
Agent A (thinking)
   │
   │ LLM 返回 tool_call: { name: "agent_call", params: { agentId: "B", task: "..." } }
   ↓
Agent A (tool_call)
   │
   │ ToolRegistry.get("agent_call").execute(params, context)
   │ context.scheduler 就是 AgentScheduler 实例
   ↓
AgentScheduler.executeAgent("B", task)
   │
   │ 1. Agent B.status = thinking
   │ 2. Agent B 完整跑一轮状态机（内部可能再委托 C）
   │ 3. Agent B.status = done
   ↓
返回 Agent A
   │
   │ 把 Agent B 的最终输出作为 tool result 追加到 Agent A.messages
   ↓
Agent A (thinking ← 继续循环)
```

### 3.3 DAG 拓扑约束

```typescript
// 边类型决定调度器行为
type DagEdgeType = "delegate" | "depends_on" | "parallel";

// delegate — Agent A 主动委托 B，同步等待 B 完成
// depends_on — Agent B 必须等 A 完成才能启动（调度器保证）
// parallel — Agent A 和 B 可以并行启动（无约束）
```

调度器的 `run()` 入口逻辑：

```typescript
async run(userPrompt: string) {
  // 1. 初始化所有 Agent
  for (const agentId of this.dag.agents) {
    this.store.agents[agentId].status = "idle";
  }

  // 2. 处理 depends_on 边：拓扑排序
  //    没有入度的 Agent 可以立即启动
  //    有 depends_on 入边的 Agent 等所有前驱 done 后启动
  const readyAgents = topoSort(this.dag);

  // 3. 并行启动无依赖的 Agent
  await Promise.all(
    readyAgents.map(agentId => this.executeAgent(agentId, userPrompt))
  );

  // 4. 子 Agent 通过 agent_call 工具被动态触发
  //    depends_on 约束在 executeAgent 内部处理
}
```

---

## 四、完整状态机伪代码

```typescript
class AgentScheduler {
  constructor(private store: GlobalState, private registry: ToolRegistry) {}

  async run(userPrompt: string): Promise<void> {
    this.store.executionLog = [];
    this.initAllAgents(userPrompt);

    // 拓扑排序，找到可立即启动的 Agent
    const ready = this.findReadyAgents();
    await Promise.all(ready.map(id => this.executeAgent(id, userPrompt)));
  }

  async executeAgent(agentId: string, task: string): Promise<SingleAgentState> {
    const agent = this.store.agents[agentId];
    
    // 等 depends_on 的前驱 Agent 完成
    await this.waitForDependencies(agentId);

    agent.status = "thinking";
    agent.messages.push({ role: "user", content: task });

    while (agent.status !== "done" && agent.status !== "error") {
      // 调用 LLM
      const llmResponse = await this.callLLM(agent);
      agent.messages.push({ role: "assistant", content: llmResponse.text });
      
      // Token 统计
      agent.tokenUsage.input += llmResponse.usage?.input ?? 0;
      agent.tokenUsage.output += llmResponse.usage?.output ?? 0;

      if (!llmResponse.toolCalls?.length) {
        // 纯文本回复 → Agent 完成
        agent.status = "done";
        break;
      }

      // 执行所有工具调用
      for (const toolCall of llmResponse.toolCalls) {
        agent.status = "tool_call";
        
        const execution: ToolExecution = {
          id: toolCall.id,
          toolName: toolCall.name,
          agentId,
          params: toolCall.params,
          status: "running",
          startTime: Date.now(),
        };
        agent.currentToolCall = execution;
        agent.toolHistory.push(execution);

        try {
          const tool = this.registry.get(toolCall.name);
          const result = await tool.execute(toolCall.params, {
            agentId,
            store: this.store,
            scheduler: this,  // agent_call 工具拿到这个可以启动子 Agent
          });

          execution.status = result.success ? "success" : "error";
          execution.result = result.raw ?? result.output;
          execution.error = result.success ? undefined : result.output;
          execution.endTime = Date.now();

          agent.messages.push({
            role: "tool",
            content: result.output,
            toolCallId: toolCall.id,
          });
        } catch (err) {
          execution.status = "error";
          execution.error = String(err);
          execution.endTime = Date.now();
          agent.status = "error";
          agent.error = String(err);
        }
      }

      agent.status = "thinking";
    }

    agent.currentToolCall = undefined;
    return agent;
  }

  private async waitForDependencies(agentId: string): Promise<void> {
    const deps = this.dag.edges.filter(
      e => e.to === agentId && e.type === "depends_on"
    );
    for (const dep of deps) {
      while (this.store.agents[dep.from].status !== "done") {
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  private findReadyAgents(): string[] {
    const hasDep = new Set(
      this.dag.edges.filter(e => e.type === "depends_on").map(e => e.to)
    );
    return this.dag.agents.filter(id => !hasDep.has(id));
  }
}
```

---

## 五、UI 同步

调度器每改变一次 `agent.status`、`agent.messages`、`agent.toolHistory`，Zustand store 自动更新，ReactFlow 画布通过 `useStore` hook 响应式渲染。

关键状态 → UI 映射：

| 状态变化 | UI 表现 |
|---------|---------|
| status = thinking | 画布新增 thinking 节点，流式显示 LLM 输出文字 |
| status = tool_call | 画布新增 tool_call 节点，显示工具名和参数 |
| tool 执行中 | tool_call 节点显示 loading 动画 |
| tool 完成 | tool_call 节点变绿 + 新增 result 节点 |
| agent_call 触发子 Agent | 子 Agent 泳道自动出现并开始状态流转 |
| status = done | 该 Agent 最后一个节点显示完成标识 |
