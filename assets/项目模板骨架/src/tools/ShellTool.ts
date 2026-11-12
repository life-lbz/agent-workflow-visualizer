import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { VirtualFileSystem } from "../core/VFS";

/**
 * Shell 命令模拟（前端实现）
 * 支持：管道 |、通配符 *、grep、find、wc、ls、cat、echo、sort、uniq
 * 所有命令作用于虚拟文件系统
 */
export class ShellTool implements AgentTool {
  name = "shell";
  description = "在虚拟文件系统上模拟 Shell 命令。支持 grep、find、wc、ls、cat、echo、sort 等，以及管道 |。参数: { command: string }。返回命令输出文本。";
  parameters = z.object({
    command: z.string().describe("Shell 命令，如 grep hello /workspace/*.md | wc -l"),
  });

  async execute(
    params: { command: string },
    context: ToolContext
  ): Promise<ToolResult> {
    const vfs = new VirtualFileSystem(context.store);
    try {
      const output = await this.runCommand(params.command, vfs);
      return { success: true, output };
    } catch (err) {
      return { success: false, output: `命令执行失败: ${String(err)}` };
    }
  }

  private async runCommand(cmd: string, vfs: VirtualFileSystem): Promise<string> {
    // 支持管道：拆分并逐个执行
    const parts = cmd.split("|").map(p => p.trim());
    let input = "";
    for (const part of parts) {
      input = await this.execSingle(part, vfs, input);
    }
    return input;
  }

  private async execSingle(cmd: string, vfs: VirtualFileSystem, stdin: string): Promise<string> {
    const tokens = this.tokenize(cmd);
    if (tokens.length === 0) return stdin;

    const [name, ...args] = tokens;

    switch (name) {
      case "echo":
        return args.join(" ");

      case "ls": {
        const dir = args[0] ?? "/workspace";
        const files = vfs.list(dir);
        return files.join("\n") || "(目录为空)";
      }

      case "cat": {
        return args
          .map(p => {
            const c = vfs.read(p);
            return c === null ? `cat: ${p}: 文件不存在` : (typeof c === "string" ? c : "[二进制]");
          })
          .join("\n");
      }

      case "grep": {
        const pattern = args[0] ?? "";
        const files = args.slice(1);
        const text = files.length > 0
          ? files.map(f => vfs.read(f)).filter((v): v is string => typeof v === "string").join("\n")
          : stdin;
        const lines = text.split("\n").filter(l => l.includes(pattern));
        return lines.join("\n");
      }

      case "wc": {
        const text = stdin || args.map(f => vfs.read(f)).join("\n");
        const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        // wc -l / -w / -c 都支持（简化版：始终输出全部）
        return `${lines}  ${words}  ${chars}`;
      }

      case "find": {
        const dir = args[0] ?? "/workspace";
        return vfs.list(dir).join("\n") || "(无结果)";
      }

      case "sort": {
        const text = stdin || "";
        return text.split("\n").sort().join("\n");
      }

      case "uniq": {
        const text = stdin || "";
        return [...new Set(text.split("\n"))].join("\n");
      }

      case "pwd":
        return vfs["rootPath" as keyof VirtualFileSystem] as string || "/workspace";

      default:
        return `sh: ${name}: 未实现的命令。支持: echo, ls, cat, grep, wc, find, sort, uniq, pwd`;
    }
  }

  private tokenize(cmd: string): string[] {
    // 简单分词，处理引号
    const tokens: string[] = [];
    let buf = "";
    let quote = "";
    for (let i = 0; i < cmd.length; i++) {
      const c = cmd[i];
      if (quote) {
        if (c === quote) quote = "";
        else buf += c;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (/\s/.test(c)) {
        if (buf.length) { tokens.push(buf); buf = ""; }
      } else {
        buf += c;
      }
    }
    if (buf.length) tokens.push(buf);
    return tokens;
  }
}
