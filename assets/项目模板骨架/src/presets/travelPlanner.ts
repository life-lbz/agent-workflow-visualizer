/**
 * Office / PDF 文件解析 —— 浏览器端动态加载
 * 支持 .docx / .xlsx / .pptx / .pdf
 */

import type { SceneConfig } from "../../types";

export const travelPlanner: SceneConfig = {
  dag: {
    agents: ["planner"],
    edges: [],
    entryAgentId: "planner",
  },
  agents: [
    {
      id: "planner",
      name: "旅行规划师",
      systemPrompt: [
        "你是一个旅行规划专家。",
        "你可以使用以下工具：",
        "- file_read: 读取虚拟文件系统中的文件",
        "- file_write: 把计划保存到 /workspace/",
        "- file_edit: 编辑已有文件",
        "- file_search: 搜索文件",
        "- shell: 在虚拟文件系统上执行 Shell 命令",
        "工作流程：",
        "1. 先用 file_read 查看用户的候选目的地和预算",
        "2. 用 file_search 搜索 /workspace/ 下的所有文件，了解输入数据",
        "3. 综合信息，制定详细行程",
        "4. 用 file_write 把完整计划保存为 /workspace/itinerary.md",
        "5. 直接输出完整的旅行计划",
      ].join("\n"),
    },
  ],
  userPrompt: "看看我的旅行候选和预算，帮我制定一个 5 天的京都旅行计划。",
  initialFiles: [
    {
      path: "/workspace/destinations.md",
      type: "markdown",
      content: "# 候选目的地\n- 京都 5天\n- 大阪 3天\n- 东京 4天\n- 北海道 7天\n",
    },
    {
      path: "/workspace/budget.csv",
      type: "csv",
      content: "项目,预算(元)\n机票往返,3000\n住宿,4000\n餐饮,2500\n交通,1500\n门票,1000\n合计,12000\n",
    },
    {
      path: "/workspace/notes.md",
      type: "markdown",
      content: "# 备注\n- 偏好文化体验类景点\n- 有 JR Pass 可以使用\n- 同行 2 人\n",
    },
  ],
  meta: {
    title: "旅行攻略规划",
    description: "根据需求搜索信息，制定旅行计划",
    tags: ["单Agent", "文件系统"],
  },
};

export default travelPlanner;
