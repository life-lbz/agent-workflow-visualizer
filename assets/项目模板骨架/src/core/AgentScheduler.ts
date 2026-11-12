import type {
  DagGraph,
  GlobalState,
  LogEntry,
  SingleAgentState,
  ToolCallRequest,
} from "../types";
import { LLMClient } from "./LLMClient";
import { ToolRegistry } from "./ToolRegistry";

/**
 * DAG 调度器 —— 整个骨架的心脏
 * - 驱动每个 Agent 的线性状态机
 * - 处理 Agent 间委托 (agent_call) 和依赖 (depends_on)
 * - 状态变更实时写入 GlobalState，UI 自动刷新
 */
export class AgentScheduler {
  private store: GlobalState;
  private registry: ToolRegistry;
  private llm: LLMClient;

  constructor(store: GlobalState, registry: ToolRegistry, llm: LLMClient) {
    this.store = store;
    this.registry = registry;
    this.llm = llm;
  }

  // ========== 入口 ==========

  async run(userPrompt: string): Promise<void> {
    const { dag } = this.store;

    this.addLog("info", `开始执行 DAG，入口 Agent: ${dag.entryAgentId}`);

    // 1. 初始化所有 Agent 状态
    for (const agentId of dag.agents) {
      const agent = this.store.agents[agentId];
      if (agent) {
        agent.status = "idle";
        agent.messages = [
          {
            id: `sys_${agentId}`,
            role: "system",
            content: agent.systemPrompt,
            timestamp: Date.now(),
          },
        ];
        agent.toolHistory = [];
        agent.tokenUsage = { input: 0, output: 0 };
      }
    }

    // 2. 拓扑排序，找到可立即启动的 Agent（无 depends_on 入边）
    const ready = this.findReadyAgents();
    this.addLog("info", `首批启动 Agent: ${ready.join(", ")}`);

    // 3. 并行启动所有无依赖的 Agent
    await Promise.all(
      ready.map(id => this.executeAgent(id, userPrompt))
    );
  }

  // ========== 单 Agent 执行循环 ==========

  async executeAgent(agentId: string, task: string): Promise<SingleAgentState> {
    const agent = this.store.agents[agentId];
    if (!agent) {
      throw new Error(`Agent ${agentId} 不存在`);
    }

    this.addLog("info", `[${agent.name}] 开始任务: ${task.slice(0, 50)}...`, agentId);

    // 等 depends_on 的前驱 Agent 完成
    await this.waitForDependencies(agentId);

    // 加入任务（user message）
    agent.status = "thinking";
    agent.messages.push({
      id: `user_${agentId}_${Date.now()}`,
      role: "user",
      content: task,
      timestamp: Date.now(),
    });

    // 主循环：思考 → 工具调用 → 思考 → ... → done
    let safetyCounter = 0;
    const MAX_ITERATIONS = 30;

    while (agent.status !== "done" && agent.status !== "error") {
      safetyCounter++;
      if (safetyCounter > MAX_ITERATIONS) {
        agent.status = "error";
        agent.error = "超过最大迭代次数，可能陷入死循环";
        this.addLog("error", `[${agent.name}] 超过最大迭代次数`, agentId);
        break;
      }

      try {
        // Step 1: 调 LLM
        const llmResponse = await this.llm.callLLM(
          agent.messages,
          this.registry.getAll()
        );

        agent.messages.push({
          id: `asst_${agentId}_${Date.now()}`,
          role: "assistant",
          content: llmResponse.text,
          timestamp: Date.now(),
        });

        // Token 统计
        if (llmResponse.usage) {
          agent.tokenUsage.input += llmResponse.usage.input;
          agent.tokenUsage.output += llmResponse.usage.output;
        }

        // Step 2: 工具调用 or 完成
        if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
          // 执行所有工具调用
          for (const toolCall of llmResponse.toolCalls) {
            await this.executeToolCall(agentId, toolCall);
          }
          // 继续下一轮思考
          agent.status = "thinking";
        } else {
          // 没有 tool_call → Agent 完成
          agent.status = "done";
          this.addLog("info", `[${agent.name}] 任务完成`, agentId);
          break;
        }
      } catch (err) {
        agent.status = "error";
        agent.error = String(err);
        this.addLog("error", `[${agent.name}] 执行出错: ${String(err)}`, agentId);
        break;
      }
    }

    agent.currentToolCall = undefined;
    return agent;
  }

  // ========== 工具执行 ==========

  private async executeToolCall(agentId: string, toolCall: ToolCallRequest): Promise<void> {
    const agent = this.store.agents[agentId];
    if (!agent) return;

    agent.status = "tool_call";

    // 构建执行记录
    const execution = {
      id: toolCall.id,
      toolName: toolCall.name,
      agentId,
      params: toolCall.params,
      status: "running" as const,
      startTime: Date.now(),
    };
    agent.currentToolCall = execution;
    agent.toolHistory.push(execution);

    this.addLog("info", `[${agent.name}] 调用工具: ${toolCall.name}`, agentId);

    try {
      const tool = this.registry.get(toolCall.name);
      if (!tool) {
        throw new Error(`工具 ${toolCall.name} 未注册`);
      }

      const result = await tool.execute(toolCall.params, {
        agentId,
        store: this.store,
        scheduler: this, // agent_call 工具拿到这个就能启动子 Agent
      });

      execution.status = result.success ? "success" : "error";
      execution.result = result.raw ?? result.output;
      execution.error = result.success ? undefined : result.output;
      execution.endTime = Date.now();

      // 把工具结果追加到 agent 消息历史
      agent.messages.push({
        id: `tool_${agentId}_${toolCall.id}`,
        role: "tool",
        content: result.success
          ? (typeof result.raw === "string" ? result.raw : result.output)
          : `工具执行失败: ${result.output}`,
        toolCallId: toolCall.id,
        timestamp: Date.now(),
      });

      this.addLog(
        result.success ? "info" : "warn",
        `[${agent.name}] 工具 ${toolCall.name} ${result.success ? "完成" : "失败"}`,
        agentId
      );
    } catch (err) {
      execution.status = "error";
      execution.error = String(err);
      execution.endTime = Date.now();

      agent.messages.push({
        id: `tool_${agentId}_${toolCall.id}`,
        role: "tool",
        content: `工具执行异常: ${String(err)}`,
        toolCallId: toolCall.id,
        timestamp: Date.now(),
      });

      this.addLog("error", `[${agent.name}] 工具 ${toolCall.name} 异常: ${String(err)}`, agentId);
    }
  }

  // ========== 拓扑辅助 ==========

  private findReadyAgents(): string[] {
    const dag = this.store.dag;
    const hasDep = new Set(
      dag.edges.filter(e => e.type === "depends_on").map(e => e.to)
    );
    // 入口 Agent 始终可以启动
    const ready = dag.entryAgentId ? [dag.entryAgentId] : [];
    // 其他没有 depends_on 入边的也可以启动
    const others = dag.agents.filter(id => !hasDep.has(id) && !ready.includes(id));
    return [...ready, ...others];
  }

  private async waitForDependencies(agentId: string): Promise<void> {
    const deps = this.store.dag.edges.filter(
      e => e.to === agentId && e.type === "depends_on"
    );
    for (const dep of deps) {
      const depAgent = this.store.agents[dep.from];
      if (depAgent && depAgent.status !== "done") {
        this.addLog("info", `等待 ${depAgent.name} 完成...`, agentId);
        // 轮询等待（简单实现）
        while (this.store.agents[dep.from]?.status !== "done") {
          await new Promise(r => setTimeout(r, 200));
        }
      }
    }
  }

  // ========== 日志 ==========

  private addLog(level: LogEntry["level"], message: string, agentId?: string): void {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      agentId,
      message,
    };
    this.store.executionLog.push(entry);
  }
}
