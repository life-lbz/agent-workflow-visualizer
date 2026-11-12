import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { VirtualFileSystem } from "../core/VFS";

/** 编辑文件（old → new 替换） */
export class FileEditTool implements AgentTool {
  name = "file_edit";
  description = "编辑已有文件，将指定的 old 文本替换为 new 文本。参数: { path: string, old: string, new: string }。返回编辑结果。";
  parameters = z.object({
    path: z.string().describe("文件路径"),
    old: z.string().describe("要被替换的原文"),
    new: z.string().describe("替换后的新文"),
  });

  async execute(
    params: { path: string; old: string; new: string },
    context: ToolContext
  ): Promise<ToolResult> {
    const vfs = new VirtualFileSystem(context.store);
    const content = vfs.read(params.path);
    if (content === null) {
      return { success: false, output: `文件不存在: ${params.path}` };
    }
    if (typeof content !== "string") {
      return { success: false, output: `文件是二进制，无法编辑: ${params.path}` };
    }
    if (!content.includes(params.old)) {
      return {
        success: false,
        output: `文件中未找到要替换的内容。原文件前 200 字符: ${content.slice(0, 200)}`,
      };
    }
    const newContent = content.replace(params.old, params.new);
    vfs.write(params.path, newContent);
    const changed = content.length - newContent.length;
    return {
      success: true,
      output: `已编辑 ${params.path}。长度变化: ${changed} 字符`,
    };
  }
}
