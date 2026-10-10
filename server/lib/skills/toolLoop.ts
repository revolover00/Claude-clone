import { getEnabledSkill, getSkillFile, wrapSkillInstructions } from "./db";
import { ai } from "../gemini";

export interface SkillToolEvent {
  name: string;
  skill?: string;
  status: "executing" | "completed" | "error";
  error?: string;
}

export interface SkillExecutionState {
  skillLoadsCount: number;
  totalBytesLoaded: number;
}

export async function executeSkillFunctionCall(
  userId: string | undefined,
  call: { name: string; args: any },
  state: SkillExecutionState
): Promise<{ result: string; skillName?: string }> {
  const MAX_SKILL_LOADS = 3;
  const MAX_TOTAL_BYTES = 200 * 1024; // 200KB

  if (call.name === "load_skill") {
    const skillName = String(call.args?.name || "").trim().toLowerCase();

    if (state.skillLoadsCount >= MAX_SKILL_LOADS) {
      return { result: "Error: Maximum skill load limit reached (3 skills per response).", skillName };
    }

    const skill = await getEnabledSkill(userId, skillName);
    if (!skill) {
      return { result: `Skill "${skillName}" is not available or disabled.`, skillName };
    }

    const wrapped = wrapSkillInstructions(skill.body);
    const byteLength = Buffer.byteLength(wrapped, "utf-8");

    if (state.totalBytesLoaded + byteLength > MAX_TOTAL_BYTES) {
      return { result: "Error: Maximum skill payload size limit reached (200KB total).", skillName };
    }

    state.skillLoadsCount++;
    state.totalBytesLoaded += byteLength;

    // Log load event without content per security spec
    console.log(`[Skill Load Event] skill="${skillName}" sizeBytes=${byteLength} count=${state.skillLoadsCount}`);

    return { result: wrapped, skillName };
  }

  if (call.name === "read_skill_file") {
    const skillName = String(call.args?.skill || "").trim().toLowerCase();
    const filePath = String(call.args?.path || "").trim();

    const fileContent = await getSkillFile(userId, skillName, filePath);
    if (fileContent === null) {
      return { result: `File "${filePath}" could not be read or was rejected for security.`, skillName };
    }

    const byteLength = Buffer.byteLength(fileContent, "utf-8");
    if (state.totalBytesLoaded + byteLength > MAX_TOTAL_BYTES) {
      return { result: "Error: Maximum skill payload size limit reached (200KB total).", skillName };
    }

    state.totalBytesLoaded += byteLength;
    console.log(`[Skill File Read Event] skill="${skillName}" file="${filePath}" sizeBytes=${byteLength}`);

    return { result: fileContent, skillName };
  }

  return { result: "Unknown tool call", skillName: undefined };
}

export async function runSkillToolStream(
  modelId: string,
  formattedMessages: any[],
  config: any,
  call: any,
  toolResult: string
) {
  if (!ai) throw new Error("Gemini AI client not initialized");

  const continuationMessages = [
    ...formattedMessages,
    {
      role: "model",
      parts: [{ functionCall: call }],
    },
    {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: call.name,
            response: { output: toolResult },
          },
        },
      ],
    },
  ];

  return await ai.models.generateContentStream({
    model: modelId,
    contents: continuationMessages,
    config,
  });
}
