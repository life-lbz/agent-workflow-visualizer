import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { VirtualFileSystem } from "../core/VFS";

/** 搜索文件 */
export class FileSearchTool implements AgentTool {
  name = "file_search";
  description = "在虚拟文件系统中按 glob 模式搜索文件。参数: { pattern: string }。支持 * 通配符。返回匹配的文件路径列表。";
  parameters = z.object({
    pattern: z.string().describe("glob 模式，如 /workspace/*.md 或 /workspace/**/*budget*"),
  });

  async execute(
    params: { pattern: string },
    context: ToolContext
  ): Promise<ToolResult> {
    const vfs = new VirtualFileSystem(context.store);
    const results = vfs.search(params.pattern);
    if (results.length === 0) {
      return {
        success: true,
        output: `没有匹配 ${params.pattern} 的文件。所有文件: ${vfs.list().join(", ") || "(空)"}`,
      };
    }
    return {
      success: true,
      output: `找到 ${results.length} 个文件:\n${results.join("\n")}`,
      raw: results,
    };
  }
}
