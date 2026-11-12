import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";

/**
 * 用户输入 —— 弹窗让用户回复
 * 实现方式：返回一个特殊状态，UI 捕获后显示输入框，等用户提交后再返回结果
 * 简化版：这里返回一个固定文本，实际项目用事件回调
 */
export class UserInputTool implements AgentTool {
  name = "user_input";
  description = "请求用户输入信息。参数: { question: string }。返回用户的回答内容。";
  parameters = z.object({
    question: z.string().describe("要向用户询问的问题"),
  });

  async execute(
    params: { question: string },
    _context: ToolContext
  ): Promise<ToolResult> {
    // 简化实现：返回一个提示，实际可以用事件/回调让 UI 弹窗收集输入
    // 真实实现可：context.scheduler.emit("awaiting_user_input", { question: params.question })
    return {
      success: true,
      output: `[等待用户输入] Agent 询问: "${params.question}"\n（当前为模拟回复）用户回答: 请按你认为合适的方式处理。`,
    };
  }
}
