import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";

/**
 * Python 代码执行 —— 浏览器内 Pyodide WASM 沙箱
 * 动态加载：首次执行时才 import Pyodide，避免阻塞首屏
 * 预装 numpy / pandas / matplotlib
 */
export class PythonExecTool implements AgentTool {
  name = "python_exec";
  description = "在浏览器内的 Python 沙箱中执行代码。参数: { code: string }。自动预装 numpy/pandas/matplotlib。返回 stdout 输出和执行状态。";
  parameters = z.object({
    code: z.string().describe("要执行的 Python 代码"),
  });

  private pyodideInstance: any = null;
  private loadPromise: Promise<any> | null = null;

  async execute(
    params: { code: string },
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const pyodide = await this.loadPyodide();

      // 预装常用库
      await this.ensurePackages(pyodide);

      // 执行代码，捕获 stdout/stderr
      const stdout: string[] = [];
      pyodide.setStdout({ batched: (s: string) => stdout.push(s) });
      pyodide.setStderr({ batched: (s: string) => stdout.push(`[stderr] ${s}`) });

      try {
        const result = await pyodide.runPythonAsync(params.code);
        const output = stdout.join("") || (result !== undefined ? String(result) : "(无输出)");
        return {
          success: true,
          output: output.slice(0, 5000), // 限制输出长度
        };
      } catch (runErr: any) {
        return {
          success: false,
          output: `代码执行错误:\n${runErr?.message ?? String(runErr)}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        output: `Pyodide 加载或初始化失败: ${err?.message ?? String(err)}\n提示: Pyodide WASM 首次加载需要下载约 15MB 文件。`,
      };
    }
  }

  private async loadPyodide(): Promise<any> {
    if (this.pyodideInstance) return this.pyodideInstance;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      // 动态 import，避免阻塞首屏
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — pyodide 类型声明可能缺失
      const pyodideModule = await import("pyodide").catch(() => {
        // 如果 npm pyodide 包不可用，回退到 CDN 加载
        return new Promise<any>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.3/full/pyodide.js";
          script.onload = () => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            resolve(globalThis.loadPyodide());
          };
          script.onerror = () => reject(new Error("Pyodide CDN 加载失败"));
          document.head.appendChild(script);
        });
      });

      const pyodide = (pyodideModule as any).loadPyodide
        ? await (pyodideModule as any).loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.3/full/",
          })
        : await pyodideModule;

      this.pyodideInstance = pyodide;
      return pyodide;
    })();

    return this.loadPromise;
  }

  private async ensurePackages(pyodide: any): Promise<void> {
    try {
      await pyodide.loadPackage(["numpy", "pandas", "matplotlib"]);
    } catch {
      // 包加载失败不阻断，继续执行
    }
  }
}
