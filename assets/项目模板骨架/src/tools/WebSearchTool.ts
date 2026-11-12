import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";

/**
 * 网络搜索（Mock 实现）
 * - 演示模式：返回模拟结果
 * - 真实模式：调用外部搜索 API（Bing/SerpAPI/Google 自定义搜索，用户自行替换）
 */
export class WebSearchTool implements AgentTool {
  name = "web_search";
  description = "网络搜索。参数: { query: string, maxResults?: number }。返回结构化搜索结果列表（标题、链接、摘要）。";
  parameters = z.object({
    query: z.string().describe("搜索关键词"),
    maxResults: z.number().optional().default(5),
  });

  async execute(
    params: { query: string; maxResults?: number },
    context: ToolContext
  ): Promise<ToolResult> {
    // Mock 实现 —— 生成模拟搜索结果
    const count = params.maxResults ?? 5;
    const results = Array.from({ length: count }, (_, i) => ({
      title: `${params.query} — 搜索结果 ${i + 1}`,
      url: `https://example.com/search?q=${encodeURIComponent(params.query)}&r=${i + 1}`,
      snippet: `这是关于"${params.query}"的第 ${i + 1} 条模拟搜索结果摘要。` +
        `包含最新的研究、报道和讨论。来源: example.com/articles/${i + 1}`,
      source: "example.com",
    }));

    const output = [
      `搜索「${params.query}」返回 ${count} 条结果：\n`,
      ...results.map(
        (r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.snippet}`
      ),
    ].join("\n");

    return { success: true, output, raw: results };
  }
}
