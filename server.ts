import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper for dual CommonJS/ESM compatibility of directories
const getDirname = () => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch (err) {
    // In CommonJS, global __dirname is available
    return __dirname;
  }
};
const dirName = getDirname();

// Initialize Gemini Client safely (lazy initialization)
let aiClient: GoogleGenAI | null = null;
const getGeminiClient = (): GoogleGenAI | null => {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY not configured or is placeholder. Will operate in simulated mode.");
    return null;
  }
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    return aiClient;
  } catch (e) {
    console.error("Failed to initialize GoogleGenAI client:", e);
    return null;
  }
};

// --- API ROUTES ---

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY",
  });
});

// 2. Production Planner Optimization Engine using Gemini
app.post("/api/scheduler/optimize", async (req, res) => {
  const { projects, inventory, scheduling, customInstruction } = req.body;

  const client = getGeminiClient();

  if (!client) {
    // Elegant fallback simulation advice
    return res.json({
      success: true,
      simulated: true,
      analysis: {
        criticalConflicts: [
          {
            id: "conf-1",
            severity: "HIGH",
            title: "船坞1号与材料延迟冲突",
            description: "LNG船动力核心发动机供应链预计延迟5天，直接导致总装与船坞1的下水计划重叠，需延长工期或调剂库存。",
            affectedProjects: ["LNG Carrier 082"],
            suggestedAction: "调整船坞1总装进坞时间延迟5天，或优先将焊接班组调往 Bulk Carrier 105 进行分段合拢，以最大化团队工效。"
          },
          {
            id: "conf-2",
            severity: "MEDIUM",
            title: "特种钢材储备跌破安全线",
            description: "船体建造用特种高强钢板库存剩余 120 吨，按 Bulk Carrier 105 当前每日消耗 15 吨计算，仅能维持 8 天，而下一批订货周期为10天。",
            affectedProjects: ["Bulk Carrier 105"],
            suggestedAction: "紧急从分包商调配 50 吨高强钢板，或者启动特种钢部分预处理工序合并，减缓非硬性消耗。"
          },
          {
            id: "conf-3",
            severity: "INFO",
            title: "合拢班组与防腐班组工效错峰",
            description: "合拢班组夜班负荷过重，而防腐班组目前日班工效仅为 72%，存在等待交房状态。",
            affectedProjects: ["Container Vessel 203"],
            suggestedAction: "将防腐班组部分人员进行技能通融培训，协助前段分段合拢磨砂除锈，平滑劳动负荷。"
          }
        ],
        optimizedMilestones: [
          { project: "Bulk Carrier 105", stage: "分段建造 (Segment)", originalEnd: "2026-06-15", optimizedEnd: "2026-06-12", note: "利用班组并线以及合并工序将合拢提前3天。" },
          { project: "LNG Carrier 082", stage: "上建吊装与总装 (Hull Assembly)", originalEnd: "2026-07-20", optimizedEnd: "2026-07-25", note: "动力主机延迟，排程主动延后5天错峰，避开船坞1占线。" },
          { project: "Container Vessel 203", stage: "系统调试 (Testing)", originalEnd: "2026-08-30", optimizedEnd: "2026-08-28", note: "防腐和内装阶段前置部分测试，节省2天。" }
        ],
        materialAllocations: [
          { material: "船用钢板 (A36)", source: "中央总仓", qty: "320 吨", targetProject: "Bulk Carrier 105", status: "已下达调拨" },
          { material: "船用合金管", source: "精密配件库", qty: "45 吨", targetProject: "LNG Carrier 082", status: "调配锁定" },
          { material: "船用防水防腐油漆", source: "涂装库", qty: "12 桶", targetProject: "Container Vessel 203", status: "随时出库" }
        ],
        personnelFinetunes: [
          { team: "焊接1班", shift: "A班 -> 混合班", adjustment: "借调3至5名焊工到钢结构分厂加速分段拼板。" },
          { team: "涂装2班", shift: "B班", adjustment: "白班增加局部错峰，与合拢班组对接进行即时打砂除锈喷漆。" }
        ],
        executiveSummary: "智能排程引擎已完成数据比对。检测到1项重大材料配合风险及1项船坞重叠隐患。通过调整 'LNG Carrier 082' 进坞节点并对特种钢进行动态移仓调用，可以消除整体计划延迟。总工期波动在 ±1% 范围内，同时避免了 48 小时的工效空转。"
      }
    });
  }

  try {
    const prompt = `你是一个造船厂高级计划与排程（APS）专家与造船厂总调度指挥官。请根据以下造船厂实时数据，生成优化的排程、解决物资迟滞冲突、并提升工人班组工效。

造船厂当前状态数据如下：
1. 船舶建造项目（生产进度）：
${JSON.stringify(projects, null, 2)}

2. 物资库存：
${JSON.stringify(inventory, null, 2)}

3. 员工班组排班与工效：
${JSON.stringify(scheduling, null, 2)}

4. 额外调度偏好指令：
"${customInstruction || "优先确保关键节点（下水、海试）按期完成，平滑负荷，节约物流周期。"}"

如果当前计划有冲突（如动力主机卡点、钢材缺口、船坞抢占、班组过度劳累等），请通过智能算法给出优化方案，并以下面的JSON架构输出：

{
  "criticalConflicts": [
    {
      "id": "conf-X",
      "severity": "HIGH" | "MEDIUM" | "INFO",
      "title": "冲突标题",
      "description": "冲突具体起因及影响",
      "affectedProjects": ["相关船舶项目名称"],
      "suggestedAction": "如何消除冲突的指令"
    }
  ],
  "optimizedMilestones": [
    {
      "project": "项目名称",
      "stage": "优化的阶段",
      "originalEnd": "旧结束日期",
      "optimizedEnd": "新推荐结束日期",
      "note": "优化缘由或调拨手段"
    }
  ],
  "materialAllocations": [
    {
      "material": "材料名称",
      "source": "调配来源",
      "qty": "分配数量",
      "targetProject": "分配目的地项目",
      "status": "状态"
    }
  ],
  "personnelFinetunes": [
    {
      "team": "班组/工种名称",
      "shift": "班次调整",
      "adjustment": "工效微调或错峰协作建议"
    }
  ],
  "executiveSummary": "造船总指挥全局诊断与APS总指挥官决策汇报，包含工期、耗竭安全线分析和班组协作工效的凝练性总结(200字左右)。"
}

注意：你必须返回完美的、符合上述格式的单JSON对象，不要带有任何额外的Markdown包装标签之外的话。请不要在JSON外部编写解释文字，只返回该JSON，以便代码解析。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["criticalConflicts", "optimizedMilestones", "materialAllocations", "personnelFinetunes", "executiveSummary"],
          properties: {
            criticalConflicts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["id", "severity", "title", "description", "affectedProjects", "suggestedAction"],
                properties: {
                  id: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  affectedProjects: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  suggestedAction: { type: Type.STRING }
                }
              }
            },
            optimizedMilestones: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["project", "stage", "originalEnd", "optimizedEnd", "note"],
                properties: {
                  project: { type: Type.STRING },
                  stage: { type: Type.STRING },
                  originalEnd: { type: Type.STRING },
                  optimizedEnd: { type: Type.STRING },
                  note: { type: Type.STRING }
                }
              }
            },
            materialAllocations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["material", "source", "qty", "targetProject", "status"],
                properties: {
                  material: { type: Type.STRING },
                  source: { type: Type.STRING },
                  qty: { type: Type.STRING },
                  targetProject: { type: Type.STRING },
                  status: { type: Type.STRING }
                }
              }
            },
            personnelFinetunes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["team", "shift", "adjustment"],
                properties: {
                  team: { type: Type.STRING },
                  shift: { type: Type.STRING },
                  adjustment: { type: Type.STRING }
                }
              }
            },
            executiveSummary: { type: Type.STRING }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json({
      success: true,
      simulated: false,
      analysis: parsedData
    });
  } catch (error: any) {
    console.error("Gemini optimization API error:", error);
    res.status(500).json({ error: "服务器分析失败，请稍后重试", details: error.message });
  }
});

// 3. Command center assistant chat
app.post("/api/scheduler/ask", async (req, res) => {
  const { query, history, shipyardState } = req.body;

  const client = getGeminiClient();

  if (!client) {
    const textOptions = [
      `作为造船厂智能调度助手，针对您关于“${query}”的提问，提供以下模拟建议：\n\n1. **船期影响**：建议暂缓 Container Vessel 203 的特种管组预制，将焊接班组全力调拨至 LNG 船舱合拢工序，能够弥补由于物资延迟而产生的时间空头。\n2. **库存分配**：建议立即对 36mm 船用高强钢板启动备用供货源；另可从涂装分厂紧急借调 150 升特种阻燃底漆进行垫付。\n3. **工效调配**：涂装二班今明两日可先进行大舾装前置涂层作业，从而与合拢阶段进行错峰，平滑劳动力利用率。`,
      `船长，目前物资库内的高精推进轴承正处于通关阶段。针对“${query}”，我们可以将 LNG 船在船尾结构分段合拢的排程后移3天。这样能完美避开船台的装配卡点。同时，合拢班组可于星期二调整为白晚班轮作制，保障效率最大化。`,
      `收到，总调度长！对于您提到的“${query}”，目前防腐涂装车间由于持续阴雨温度较低，湿度达 82%，会使得涂层干燥时间延长 30%。我们应该启动 1 号涂装烤房进行温湿度辅助控制，并微调之后的下水阶段排程至下周四。这样既能保证质量，又不会对总体交付节点造成违约损失。`
    ];
    const recommendedText = textOptions[Math.floor(Math.random() * textOptions.length)];
    return res.json({
      success: true,
      text: recommendedText,
      simulated: true,
    });
  }

  try {
    const systemInstruction = `你是一个造船厂高级人工智能生产指挥官，在造船、APS排程、海事重工与库存、劳务派遣工效领域有十几年实战经验。
回答字数建议精炼（200-400字），使用专业术语（如舾装、合拢、进坞、起龙骨、下水、涂装干燥、干坞周转率、工效、船级社检验等）。

以下是当前的造船厂实时数据上下文，便于你更精准、事实地回答总调度长（用户）的问询：
- 船舶在建项目：${JSON.stringify(shipyardState?.projects || [])}
- 物资库存水平：${JSON.stringify(shipyardState?.inventory || [])}
- 班组排班与工效现状：${JSON.stringify(shipyardState?.scheduling || [])}

请在解答中展现出极强的决策深度，提出具体可执行的数字指标和调整细节，给总指挥极大的分析价值！`;

    // format messages manually for ai.models.generateContent containing systemInstruction
    const modelInputMessages = [
      ...history.map((msg: any) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      })),
      {
        role: "user",
        parts: [{ text: query }]
      }
    ];

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: modelInputMessages,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({
      success: true,
      text: response.text,
      simulated: false,
    });
  } catch (error: any) {
    console.error("Gemini Ask API error:", error);
    res.status(500).json({ error: "服务器分析失败，请稍后重试", details: error.message });
  }
});

// --- VITE MIDDLEWARE SETUP ---
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Shipyard Management System backend listening on http://localhost:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
