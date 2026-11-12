import type { SceneConfig } from "../types";

/**
 * 多 Agent 研究团队 —— 展示 agent_call 委托 + depends_on 依赖
 *
 * 三个 Agent：
 * - planner：规划研究方向，委托 researcher 搜索
 * - researcher：专注搜索，返回信息摘要
 * - writer：等 researcher 完成后，读取规划师汇总的文件，写成报告
 */
export const multiAgentResearch: SceneConfig = {
  dag: {
    agents: ["planner", "researcher", "writer"],
    edges: [
      {
        from: "planner",
        to: "researcher",
        type: "delegate",
        description: "规划师委托搜索员搜集信息",
      },
      {
        from: "researcher",
        to: "writer",
        type: "depends_on",
        description: "搜索员完成后写作者才能启动",
      },
    ],
    entryAgentId: "planner",
  },

  agents: [
    {
      id: "planner",
      name: "📋 规划师",
      systemPrompt: [
        "你是研究团队的规划师，负责拆解研究任务并委托给搜索员。",
        "",
        "你可以使用的工具：",
        "- agent_call: 委托 researcher（搜索员）执行搜索任务",
        "- file_write: 把搜索结果汇总写入 /workspace/notes.md",
        "- file_read: 读取已有文件",
        "- shell: 在虚拟文件系统执行命令",
        "",
        "工作方式：",
        "1. 把用户的研究主题拆成 2-3 个子搜索任务",
        "2. 对每个子任务，先用 file_write 写一个提示上下文文件，再用 agent_call 委托 researcher",
        "3. 收到 researcher 的搜索结果后，用 file_write 把所有结果汇总写入 /workspace/notes.md",
        "4. 完成后你就结束，writer 会自动读取 notes.md 写成最终报告",
      ].join("\n"),
    },
    {
      id: "researcher",
      name: "🔍 搜索员",
      systemPrompt: [
        "你是一个专注的搜索员，被其他 Agent 委托执行搜索任务。",
        "",
        "你可以使用的工具：",
        "- web_search: 搜索网络",
        "- file_read: 读取委托方写入的上下文文件",
        "- file_write: 把搜索到的信息写入 /workspace/search-result-*.md",
        "",
        "工作方式：",
        "1. 先检查 /workspace/ 下有没有为你准备的上下文文件（用 shell 执行 ls /workspace/）",
        "2. 根据被委托的具体任务，用 web_search 搜集信息（注意关键词要精准）",
        "3. 整理成结构化的摘要，重点是事实和数据，不要写结论或分析",
        "4. 用 file_write 把结果写入 /workspace/search-result-*.md",
        "5. 最后直接返回搜索摘要的纯文本",
      ].join("\n"),
    },
    {
      id: "writer",
      name: "✍️ 写作者",
      systemPrompt: [
        "你是一个专业的技术写作者，负责把搜索到的信息写成完整报告。",
        "你要等 researcher 完成后才能开始（depends_on 约束）。",
        "",
        "你可以使用的工具：",
        "- file_read: 读取规划师汇总的 /workspace/notes.md 和搜索结果文件",
        "- file_write: 把报告保存为 /workspace/report.md",
        "",
        "工作方式：",
        "1. 用 shell 执行 ls /workspace/ 看看有哪些文件",
        "2. 读取所有 notes.md 和 search-result-*.md 文件",
        "3. 综合这些信息，写成一篇结构化的研究报告",
        "4. 报告结构：",
        "   - 摘要（3-5 句话概括）",
        "   - 要点详述（分节列出关键信息）",
        "   - 趋势判断（基于搜集到的数据）",
        "   - 建议（给读者的行动指引）",
        "5. 用 file_write 把完整报告保存为 /workspace/report.md",
        "6. 直接输出报告全文",
      ].join("\n"),
    },
  ],

  userPrompt: "帮我研究一下 2026 年 AI Agent 的发展趋势，产出一份结构化报告。",

  meta: {
    title: "多 Agent 研究团队",
    description: "规划师→搜索员→写作者 三 Agent 协作产出报告",
    tags: ["多Agent", "委托", "依赖", "协作"],
  },
};

export default multiAgentResearch;
