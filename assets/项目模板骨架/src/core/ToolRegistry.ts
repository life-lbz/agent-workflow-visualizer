import type { AgentTool } from "../types";

/**
 * 工具注册中心 —— 统一注册、查找、枚举
 */
export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  getAll(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 给 LLM 的 system prompt 用 —— 列出所有可用工具
   * 格式符合 OpenAI Function Calling 规范
   */
  getFunctionCallingSchema(): Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: unknown;
    };
  }> {
    return this.getAll().map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }
}
