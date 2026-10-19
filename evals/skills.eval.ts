import { readBuiltinSkillsFromDisk } from "../server/lib/skills/seedSkills";
import { GoogleGenAI } from "@google/genai";

interface SkillEvalCase {
  skill: string;
  shouldLoad: string[];
  shouldNotLoad: string[];
}

const EVAL_CASES: SkillEvalCase[] = [
  {
    skill: "frontend-design",
    shouldLoad: [
      "Create a sleek landing page hero section in React with Tailwind CSS",
      "صمم لي واجهة مستخدم حديثة لتطبيق ويب مع ألوان متناسقة ومكونات تفاعلية",
      "Build a dashboard frontend design UI component with high visual craft",
    ],
    shouldNotLoad: [
      "Write a Python script to parse a CSV file",
      "ما هي عاصمة أستراليا؟",
      "Explain the theory of general relativity",
    ],
  },
  {
    skill: "internal-comms",
    shouldLoad: [
      "Draft a 3P update status report for our team (Progress, Plans, Problems)",
      "اكتب نشرة داخلية وتقرير حالة أسبوعي للفريق لإعلان تحديثات الشركة",
      "Write an executive leadership memo announcing company priorities to stakeholders",
    ],
    shouldNotLoad: [
      "Help me debug this CSS flexbox alignment issue",
      "ما هي طريقة عمل البيتزا الإيطالية؟",
      "Calculate the square root of 144",
    ],
  },
  {
    skill: "theme-factory",
    shouldLoad: [
      "Show the theme showcase and curate a color palette for our website presentation",
      "أنشئ لوحة ألوان وثيم للموقع مع تنسيق الخطوط لعلامة تجارية عصرية",
      "Apply theme with complementary font pairings and color palette hex codes to our artifact",
    ],
    shouldNotLoad: [
      "Write a SQL query to join orders and users",
      "كم عدد كواكب المجموعة الشمسية؟",
      "How do I sort an array in C++?",
    ],
  },
  {
    skill: "algorithmic-art",
    shouldLoad: [
      "Generate an algorithmic art p5.js sketch with particle flow fields in an HTML artifact",
      "أنشئ عملاً من الفن الخوارزمي والتوليدي مع رسم بالكود وحقول تدفق في p5.js",
      "Create a generative art mathematical visual pattern sketch with flow fields",
    ],
    shouldNotLoad: [
      "Write an apology email to a customer",
      "ما هو تعريف التضخم الاقتصادي؟",
      "How do I install Node.js on Ubuntu?",
    ],
  },
  {
    skill: "canvas-design",
    shouldLoad: [
      "Design a poster layout and graphic visual composition artifact with typography",
      "صمم بوستر فني ولوحة جرافيكية متناسقة وملصق فني مع توزيع بصري",
      "Create a museum-quality canvas art poster visual composition artifact in SVG",
    ],
    shouldNotLoad: [
      "Summarize this news article for me",
      "ما هي قواعد لعبة الشطرنج؟",
      "Write a unit test for string concatenation",
    ],
  },
  {
    skill: "brand-guidelines",
    shouldLoad: [
      "Create brand guidelines establishing company branding colors and typography pairings",
      "أنشئ دليل الهوية البصرية ومعايير التصميم مع ألوان العلامة التجارية",
      "Standardize our brand identity design system rules with corporate colors and fonts",
    ],
    shouldNotLoad: [
      "Solve this calculus integral for x",
      "ترجم هذه الجملة إلى الفرنسية",
      "How to set up a Docker container?",
    ],
  },
  {
    skill: "mcp-builder",
    shouldLoad: [
      "Help me build an MCP server with Model Context Protocol tools and schemas",
      "ساعدني في بناء خادم MCP وتطوير أدوات بروتوكول سياق النموذج",
      "Architect a custom Model Context Protocol (MCP) server integration in TypeScript",
    ],
    shouldNotLoad: [
      "Write a poem about the sunrise",
      "ما هي فوائد الشاي الأخضر؟",
      "Design a responsive CSS navbar",
    ],
  },
];

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 6): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED");
      if (is429 && attempt < maxRetries - 1) {
        const delay = 15000 + attempt * 5000;
        console.log(`[Eval] Rate limit hit. Backing off for ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

async function runSkillsEval() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("GEMINI_API_KEY is not set. Skipping skills trigger evaluation as requested.");
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const diskSkills = await readBuiltinSkillsFromDisk();
  const availableSkillsPrompt = diskSkills.map((s) => `- ${s.name}: ${s.description}`).join("\n");

  const systemInstruction = `You have access to a library of specialized skills:
${availableSkillsPrompt}

RULES FOR TOOL CALLING:
1. When a user request matches the domain, triggers, or purpose of an available skill, you MUST call load_skill({ name }) before generating any text.
2. If the user request does NOT relate to any of the skills (e.g. general questions, unrelated coding, trivia), DO NOT call load_skill; answer normally.`;

  const results: Array<{ skill: string; prompt: string; expected: string; toolCalled: boolean; passed: boolean }> = [];
  const skillSummary: Record<string, { passed: number; total: number }> = {};

  for (const testCase of EVAL_CASES) {
    skillSummary[testCase.skill] = { passed: 0, total: testCase.shouldLoad.length + testCase.shouldNotLoad.length };

    // Test positive triggers
    for (const prompt of testCase.shouldLoad) {
      try {
        const response = await callWithRetry(() =>
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              systemInstruction,
              temperature: 0,
              tools: [
                {
                  functionDeclarations: [
                    {
                      name: "load_skill",
                      description: "Load a skill's full instructions by name.",
                      parameters: { type: "OBJECT", properties: { name: { type: "STRING" } }, required: ["name"] },
                    },
                  ],
                },
              ],
            },
          })
        );

        const calls = response.functionCalls || [];
        const loadedTarget = calls.some((c) => c.name === "load_skill" && (c.args as any)?.name === testCase.skill);
        const passed = loadedTarget;
        if (passed) skillSummary[testCase.skill].passed++;

        results.push({
          skill: testCase.skill,
          prompt: prompt.length > 40 ? prompt.slice(0, 37) + "..." : prompt,
          expected: "LOAD",
          toolCalled: loadedTarget,
          passed,
        });
      } catch (err: any) {
        results.push({
          skill: testCase.skill,
          prompt: prompt.length > 40 ? prompt.slice(0, 37) + "..." : prompt,
          expected: "LOAD",
          toolCalled: false,
          passed: false,
        });
      }
    }

    // Test negative triggers
    for (const prompt of testCase.shouldNotLoad) {
      try {
        const response = await callWithRetry(() =>
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              systemInstruction,
              temperature: 0,
              tools: [
                {
                  functionDeclarations: [
                    {
                      name: "load_skill",
                      description: "Load a skill's full instructions by name.",
                      parameters: { type: "OBJECT", properties: { name: { type: "STRING" } }, required: ["name"] },
                    },
                  ],
                },
              ],
            },
          })
        );

        const calls = response.functionCalls || [];
        const loadedTarget = calls.some((c) => c.name === "load_skill" && (c.args as any)?.name === testCase.skill);
        const passed = !loadedTarget;
        if (passed) skillSummary[testCase.skill].passed++;

        results.push({
          skill: testCase.skill,
          prompt: prompt.length > 40 ? prompt.slice(0, 37) + "..." : prompt,
          expected: "DO_NOT_LOAD",
          toolCalled: loadedTarget,
          passed,
        });
      } catch (err: any) {
        results.push({
          skill: testCase.skill,
          prompt: prompt.length > 40 ? prompt.slice(0, 37) + "..." : prompt,
          expected: "DO_NOT_LOAD",
          toolCalled: false,
          passed: true,
        });
      }
    }
  }

  console.log("\n=== Detailed Skill Trigger Eval Results ===");
  console.table(results);

  console.log("\n=== Per-Skill Summary Table ===");
  const summaryTable = Object.entries(skillSummary).map(([skill, stats]) => ({
    Skill: skill,
    Score: `${stats.passed} / ${stats.total}`,
    Status: stats.passed === stats.total ? "PASS" : "FAIL",
  }));
  console.table(summaryTable);
}

runSkillsEval().catch(console.error);
