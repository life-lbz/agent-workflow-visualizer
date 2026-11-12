import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";

/**
 * 网页抓取 —— fetch + 简单 HTML 提纯
 */
export class WebFetchTool implements AgentTool {
  name = "web_fetch";
  description = "抓取指定 URL 的网页内容。参数: { url: string }。返回网页的纯文本内容（去除 HTML 标签）。";
  parameters = z.object({
    url: z.string().url().describe("目标网页 URL"),
  });

  async execute(
    params: { url: string },
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const response = await fetch(params.url, {
        headers: { "User-Agent": "AgentFlow/1.0 (Agent Visualizer Demo)" },
      });
      if (!response.ok) {
        return {
          success: false,
          output: `HTTP ${response.status} ${response.statusText}`,
        };
      }
      const html = await response.text();
      const text = this.htmlToText(html);
      // 截断过长内容（LLM 有 token 限制）
      const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n...（内容已截断）" : text;
      return { success: true, output: `来源: ${params.url}\n\n${truncated}` };
    } catch (err) {
      return { success: false, output: `抓取失败: ${String(err)}` };
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }
}
