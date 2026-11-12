import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";

/**
 * 通用 HTTP 请求
 */
export class HttpRequestTool implements AgentTool {
  name = "http_request";
  description = "发送 HTTP 请求到指定 URL。参数: { url: string, method?: string, headers?: object, body?: string }。返回响应内容、状态码和头部。";
  parameters = z.object({
    url: z.string().describe("目标 URL"),
    method: z.string().optional().default("GET").describe("GET / POST / PUT / DELETE 等"),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional().describe("请求体（POST/PUT 时）"),
  });

  async execute(
    params: { url: string; method?: string; headers?: Record<string, string>; body?: string },
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const response = await fetch(params.url, {
        method: (params.method ?? "GET").toUpperCase(),
        headers: {
          "Content-Type": "application/json",
          ...(params.headers ?? {}),
        },
        body: params.body,
      });
      const text = await response.text();
      const preview = text.length > 2000 ? text.slice(0, 2000) + "...(截断)" : text;
      return {
        success: true,
        output: `状态码: ${response.status} ${response.statusText}\n响应长度: ${text.length}\n\n${preview}`,
        raw: { status: response.status, statusText: response.statusText, body: text },
      };
    } catch (err) {
      return { success: false, output: `请求失败: ${String(err)}` };
    }
  }
}
