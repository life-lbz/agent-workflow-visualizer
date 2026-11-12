import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { VirtualFileSystem } from "../core/VFS";

/** 读取文件 */
export class FileReadTool implements AgentTool {
  name = "file_read";
  description = "读取虚拟文件系统中文件的文本内容。参数: { path: string }。返回文件内容字符串，如果文件不存在返回错误。";
  parameters = z.object({
    path: z.string().describe("文件路径，如 /workspace/budget.csv"),
  });

  async execute(
    params: { path: string },
    context: ToolContext
  ): Promise<ToolResult> {
    const vfs = new VirtualFileSystem(context.store);
    const content = vfs.read(params.path);
    if (content === null) {
      return {
        success: false,
        output: `文件不存在: ${params.path}。可用文件: ${vfs.list().join(", ") || "(空)"}`,
      };
    }
    const text = typeof content === "string" ? content : "[二进制文件]";
    return { success: true, output: text };
  }
}
