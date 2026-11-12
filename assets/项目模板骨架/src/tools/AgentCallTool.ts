import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";

/**
 * 多 Agent 协作核心 —— 委托给另一个 Agent
 *
 * 当 Agent A 的 LLM 返回 tool_call: agent_call { agentId: "B", task: "..." } 时
 * 调度器执行这个工具 → 拿到 scheduler 引用 → 启动 Agent B 的状态机
 * Agent B 完成后，结果回传给 Agent A，Agent A 继续下一轮思考
 */
export class AgentCallTool implements AgentTool {
  name = "agent_call";
  description = "把任务委托给另一个 Agent 执行。参数: { agentId: string, task: string }。返回子 Agent 的完整执行结果。在委托前请先用 file_write 把必要的上下文写入 /workspace/ 文件，子 Agent 可以用 file_read 读取。";
  parameters = z.object({
    agentId: z.string().describe("目标 Agent 的 ID（必须是 DAG 中已定义的 agentId）"),
    task: z.string().describe("给子 Agent 的具体任务描述"),
  });

  async execute(
    params: { agentId: string; task: string },
    context: ToolContext
  ): Promise<ToolResult> {
    const { agentId, task } = params;

    // 1. 找到调度器
    const scheduler = context.scheduler;
    if (!scheduler) {
      return {
        success: false,
        output: "agent_call 工具需要调度器引用，但未找到 scheduler。",
      };
    }

    // 2. 检查目标 Agent 是否存在
    const targetAgent = context.store.agents[agentId];
    if (!targetAgent) {
      const available = Object.values(context.store.agents).map(a => a.name).join(", ");
      return {
        success: false,
        output: `Agent "${agentId}" 不存在。可用 Agent: ${available}`,
      };
    }

    // 3. 检查状态（子 Agent 必须是 idle 才能启动）
    if (targetAgent.status !== "idle" && targetAgent.status !== "done") {
      return {
        success: false,
        output: `Agent "${targetAgent.name}" 当前状态是 ${targetAgent.status}，无法被委托。只有 idle 的 Agent 才能启动。`,
      };
    }

    // 4. 启动子 Agent（同步等待完成）
    const result = await scheduler.executeAgent(agentId, task);

    // 5. 从子 Agent 消息中提取最终输出
    const lastAssistantMsg = [...result.messages]
      .reverse()
      .find(m => m.role === "assistant");

    const outputSummary = [
      `子 Agent "${result.name}" 执行完成。`,
      `最终状态: ${result.status}`,
      `Token 用量: input=${result.tokenUsage.input}, output=${result.tokenUsage.output}`,
      result.error ? `错误: ${result.error}` : "",
      lastAssistantMsg ? `\n--- 最终输出 ---\n${lastAssistantMsg.content}` : "",
    ].filter(Boolean).join("\n");

    return {
      success: result.status === "done",
      output: outputSummary,
      raw: {
        agentId,
        agentName: result.name,
        status: result.status,
        messages: result.messages.map(m => ({ role: m.role, content: m.content.slice(0, 200) })),
        toolCalls: result.toolHistory.length,
      },
    };
  }
}
