import type { AgentTool } from "../types";

import { FileReadTool } from "./FileReadTool";
import { FileWriteTool } from "./FileWriteTool";
import { FileEditTool } from "./FileEditTool";
import { FileSearchTool } from "./FileSearchTool";
import { ShellTool } from "./ShellTool";
import { PythonExecTool } from "./PythonExecTool";
import { WebSearchTool } from "./WebSearchTool";
import { WebFetchTool } from "./WebFetchTool";
import { HttpRequestTool } from "./HttpRequestTool";
import { UserInputTool } from "./UserInputTool";
import { AgentCallTool } from "./AgentCallTool";

/**
 * 默认工具集合 —— 全 12 种 + agent_call
 * 去掉某种工具只需注释对应行即可
 */
export const defaultTools: AgentTool[] = [
  // 文件系统（4）
  new FileReadTool(),
  new FileWriteTool(),
  new FileEditTool(),
  new FileSearchTool(),
  // Shell（1）
  new ShellTool(),
  // Python 执行（1）
  new PythonExecTool(),
  // 网络（3）
  new WebSearchTool(),
  new WebFetchTool(),
  new HttpRequestTool(),
  // 用户交互（1）
  new UserInputTool(),
  // 多 Agent 委托（1）
  new AgentCallTool(),
];

export {
  FileReadTool,
  FileWriteTool,
  FileEditTool,
  FileSearchTool,
  ShellTool,
  PythonExecTool,
  WebSearchTool,
  WebFetchTool,
  HttpRequestTool,
  UserInputTool,
  AgentCallTool,
};
