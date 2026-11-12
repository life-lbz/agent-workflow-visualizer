import type {
  AgentMessage,
  AgentTool,
  LLMConfig,
  LLMResponse,
  ToolCallRequest,
} from "../types";

/**
 * LLM 客户端
 * - 默认 mock 模式：模拟思考 → 工具调用 → 结果循环，用于演示
 * - 真实 API 模式：OpenAI 兼容协议，编辑 callLLM 即可接入真实模型
 */
export class LLMClient {
  private config?: LLMConfig;

  constructor(config?: LLMConfig) {
    this.config = config;
  }

  setConfig(config: LLMConfig) {
    this.config = config;
  }

  isLive(): boolean {
    return !!this.config && !!this.config.apiKey && !!this.config.baseUrl;
  }

  /**
   * 核心方法：给 messages 和 tools，返回 LLM 响应
   */
  async callLLM(
    messages: AgentMessage[],
    tools: AgentTool[]
  ): Promise<LLMResponse> {
    // 真实 API 模式
    if (this.isLive()) {
      return this.callRealAPI(messages, tools);
    }
    // 默认 mock 模式
    return this.callMock(messages, tools);
  }

  // ==================== Mock 模式 ====================

  private async callMock(
    messages: AgentMessage[],
    tools: AgentTool[]
  ): Promise<LLMResponse> {
    // 模拟延迟
    await delay(800 + Math.random() * 600);

    // 根据消息历史判断下一步该做什么
    const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
    const toolMessages = messages.filter(m => m.role === "tool");

    // 如果是首轮对话（没有 tool message），返回一个工具调用模拟
    if (toolMessages.length === 0) {
      // 优先选一个合适的工具
      const toolNames = tools.map(t => t.name);

      // 根据用户意图猜一个工具
      const mockTool = pickMockTool(toolNames, lastUserMessage?.content ?? "");
      if (mockTool) {
        return {
          text: `好的，让我先用 ${mockTool.name} 来帮你处理这个请求...`,
          toolCalls: [mockTool],
          usage: { input: 150, output: 80 },
        };
      }
    }

    // 如果已经有工具结果了，返回总结性文本（模拟完成）
    if (toolMessages.length > 0) {
      return {
        text: `好的，根据执行结果，我已经完成了任务。${lastAssistantMessage ? "" : "这是一个 mock 演示结果。"}`,
        usage: { input: 200, output: 120 },
      };
    }

    return {
      text: "好的，让我来帮你处理这个问题。",
      usage: { input: 100, output: 30 },
    };
  }

  // ==================== 真实 API 模式 ====================

  private async callRealAPI(
    messages: AgentMessage[],
    tools: AgentTool[]
  ): Promise<LLMResponse> {
    if (!this.config) {
      throw new Error("LLM 配置缺失");
    }

    const functionTools = tools.map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          ...(m.role === "tool" ? { tool_call_id: m.toolCallId } : {}),
        })),
        tools: functionTools,
        stream: false, // 简化实现；流式可后续扩展
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API 错误 ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    // 解析 tool_calls
    const toolCalls: ToolCallRequest[] = (message?.tool_calls ?? []).map((tc: any) => ({
      id: tc.id ?? `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: tc.function?.name,
      params: JSON.parse(tc.function?.arguments ?? "{}"),
    }));

    return {
      text: message?.content ?? "",
      toolCalls,
      usage: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function pickMockTool(
  toolNames: string[],
  userPrompt: string
): ToolCallRequest | null {
  // 简单规则匹配，mock 用
  const lower = userPrompt.toLowerCase();

  if (toolNames.includes("agent_call") && (lower.includes("委托") || lower.includes("子agent"))) {
    return { id: `tc_${Date.now()}`, name: "agent_call", params: { agentId: "researcher", task: userPrompt } };
  }
  if (toolNames.includes("file_write")) {
    return { id: `tc_${Date.now()}`, name: "file_write", params: { path: "/workspace/output.txt", content: "mock 输出内容" } };
  }
  if (toolNames.includes("web_search") && lower.includes("搜索")) {
    return { id: `tc_${Date.now()}`, name: "web_search", params: { query: userPrompt, maxResults: 5 } };
  }
  if (toolNames.includes("python_exec") && (lower.includes("python") || lower.includes("分析") || lower.includes("数据"))) {
    return { id: `tc_${Date.now()}`, name: "python_exec", params: { code: "print('Hello from mock Python!')" } };
  }
  if (toolNames.includes("shell")) {
    return { id: `tc_${Date.now()}`, name: "shell", params: { command: "ls /workspace/" } };
  }

  // 默认：选第一个非 agent_call 非 user_input 的工具
  const firstTool = toolNames.find(n => !["agent_call", "user_input"].includes(n));
  if (firstTool) {
    return { id: `tc_${Date.now()}`, name: firstTool, params: {} };
  }
  return null;
}
