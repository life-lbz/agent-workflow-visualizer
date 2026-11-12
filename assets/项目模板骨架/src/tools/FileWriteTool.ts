import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { VirtualFileSystem } from "../core/VFS";

/** 写文件 */
export class FileWriteTool implements AgentTool {
  name = "file_write";
  description = "写入或创建虚拟文件系统中的文件。参数: { path: string, content: string }。返回写入结果。";
  parameters = z.object({
    path: z.string().describe("文件路径，如 /workspace/output.md"),
    content: z.string().describe("文件内容"),
  });

  async execute(
    params: { path: string; content: string },
    context: ToolContext
  ): Promise<ToolResult> {
    const vfs = new VirtualFileSystem(context.store);
    const existed = vfs.exists(params.path);
    vfs.write(params.path, params.content);
    return {
      success: true,
      output: existed
        ? `已更新文件 ${params.path} (${params.content.length} 字符)`
        : `已创建文件 ${params.path} (${params.content.length} 字符)`,
    };
  }
}
