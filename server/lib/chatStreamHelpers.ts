import { randomUUID } from "node:crypto";
import { readWithIdleTimeout, STREAM_IDLE_TIMEOUT_MS } from "./providers/streamIdle";

export function validateChatMessages(messages: any[]): { error?: string; status?: number } {
  if (!messages || !Array.isArray(messages) || messages.length > 100) {
    return { error: "Invalid request: messages error.", status: 400 };
  }
  if (messages.some(m => typeof m?.content === "string" && m.content.length > 100000)) {
    return { error: "Message too long.", status: 400 };
  }
  let totalAttachmentBytes = 0;
  messages.forEach(m => {
    if (Array.isArray(m?.attachments)) {
      m.attachments.forEach(a => {
        totalAttachmentBytes += typeof a?.size === "number" ? a.size : (typeof a?.url === "string" ? Math.round(a.url.length * 0.75) : 0);
      });
    }
  });
  if (totalAttachmentBytes > 20 * 1024 * 1024) {
    return { error: "Attachments exceed 20MB limit.", status: 400 };
  }
  return {};
}

export function extractGroundingSources(
  candidate: any,
  seenUrls: Set<string>,
  collectedSources: Array<{ title: string; url: string }>
): boolean {
  const groundingMeta = (candidate as any)?.groundingMetadata;
  if (!groundingMeta?.groundingChunks || !Array.isArray(groundingMeta.groundingChunks)) {
    return false;
  }
  let newSourceAdded = false;
  for (const gc of groundingMeta.groundingChunks) {
    const web = gc?.web;
    if (web?.uri && !seenUrls.has(web.uri)) {
      seenUrls.add(web.uri);
      let title = web.title?.trim() || "";
      if (!title) {
        try {
          title = new URL(web.uri).hostname.replace(/^www\./, "");
        } catch {
          title = "Source";
        }
      }
      collectedSources.push({ title, url: web.uri });
      newSourceAdded = true;
    }
  }
  return newSourceAdded;
}

export const DEFAULT_CHAT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "load_skill",
        description: "Load a skill's instructions.",
        parameters: { type: "OBJECT", properties: { name: { type: "STRING" } }, required: ["name"] },
      },
      {
        name: "read_skill_file",
        description: "Read a file from a skill.",
        parameters: { type: "OBJECT", properties: { skill: { type: "STRING" }, path: { type: "STRING" } }, required: ["skill", "path"] },
      },
      {
        name: "create_document",
        description: "Create and export a document (Word .docx, PDF .pdf, PowerPoint .pptx, or Excel .xlsx) from a structured JSON specification.",
        parameters: {
          type: "OBJECT",
          properties: {
            format: { type: "STRING", enum: ["docx", "pdf", "pptx", "xlsx"], description: "The target document format" },
            title: { type: "STRING", description: "Document title" },
            spec: { type: "OBJECT", description: "Document specification matching format schema" },
          },
          required: ["format", "title", "spec"],
        },
      },
    ],
  },
];

export interface PumpGeminiStreamParams {
  res: any;
  stream: any;
  abortCtrl: AbortController;
  userId?: string;
  modelId: string;
  formattedMessages: any[];
  config: any;
  executeSkillFunctionCall: any;
  executeToolCall?: any;
  runSkillToolStream: any;
  /** Idle-watchdog override in ms (tests use a tiny value). */
  idleTimeoutMs?: number;
}

export async function pumpGeminiStream({
  res,
  stream,
  abortCtrl,
  userId,
  modelId,
  formattedMessages,
  config,
  executeSkillFunctionCall,
  executeToolCall,
  runSkillToolStream,
  idleTimeoutMs,
}: PumpGeminiStreamParams): Promise<void> {
  // finish_reason marks a real completion; ending without it (and without a
  // user abort) means Gemini cut the stream — report it instead of emitting a
  // silent-success [DONE] that leaves the client with an empty reply.
  let sawFinish = false;
  const skillExecutionState = { skillLoadsCount: 0, totalBytesLoaded: 0 };
  const collectedSources: Array<{ title: string; url: string }> = [];
  const seenUrls = new Set<string>();
  let toolCallCount = 0;
  const maxToolCalls = 5;

  const consumeContinuation = async (continuationStream: any, history: any[], depth: number): Promise<void> => {
    for await (const continuationChunk of continuationStream) {
      if (abortCtrl.signal.aborted) return;
      const continuationCandidate = continuationChunk.candidates?.[0];
      const continuationParts = continuationCandidate?.content?.parts || [];
      for (const part of continuationParts) {
        if ((part as any).functionCall) {
          await executeAndContinue((part as any).functionCall, history, depth);
        } else if ((part as any).thought) {
          res.write(`data: ${JSON.stringify({ thinking: part.text || "" })}\n\n`);
        } else if (part.text) {
          res.write(`data: ${JSON.stringify({ token: part.text })}\n\n`);
        }
      }
    }
  };

  const executeAndContinue = async (call: any, history: any[], depth: number): Promise<void> => {
    const toolEventId = randomUUID();
    const skillTarget = call.args?.name || call.args?.skill || call.name;
    res.write(`data: ${JSON.stringify({ tool: { id: toolEventId, name: call.name, skill: skillTarget, status: "executing" } })}\n\n`);
    if (toolCallCount >= maxToolCalls || depth > maxToolCalls) {
      res.write(`data: ${JSON.stringify({ tool: { id: toolEventId, name: call.name, skill: skillTarget, status: "error" } })}\n\n`);
      return;
    }
    toolCallCount++;

    const execRes = executeToolCall
      ? await executeToolCall(call, skillExecutionState)
      : await executeSkillFunctionCall(userId, call, skillExecutionState);
    if (execRes.document) res.write(`data: ${JSON.stringify({ document: execRes.document })}\n\n`);
    if (execRes.documentError) res.write(`data: ${JSON.stringify({ documentError: execRes.documentError })}\n\n`);
    const toolStatus = execRes.documentError || execRes.toolError ? "error" : "completed";
    res.write(`data: ${JSON.stringify({ tool: { id: toolEventId, name: call.name, skill: execRes.skillName || skillTarget, status: toolStatus } })}\n\n`);

    try {
      const continuationStream = await runSkillToolStream(modelId, history, config, call, execRes.result);
      const nextHistory = [
        ...history,
        { role: "model", parts: [{ functionCall: call }] },
        { role: "user", parts: [{ functionResponse: { name: call.name, response: { output: execRes.result } } }] },
      ];
      await consumeContinuation(continuationStream, nextHistory, depth + 1);
    } catch (continuationError) {
      if (!abortCtrl.signal.aborted) console.error("Continuation stream error:", continuationError);
    }
  };

  const iterator = (stream as AsyncIterable<any>)[Symbol.asyncIterator]();
  try {
    while (true) {
      const next = await readWithIdleTimeout(
        {
          read: async () => {
            const r = await iterator.next();
            return r.done ? { done: true } : { done: false, value: r.value };
          },
        },
        idleTimeoutMs ?? STREAM_IDLE_TIMEOUT_MS
      );
      if (next.done) break;
      const chunk = next.value;
    if (abortCtrl.signal.aborted) break;
    const candidate = chunk.candidates?.[0];

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if ((part as any).functionCall) {
          await executeAndContinue((part as any).functionCall, formattedMessages, 1);
          continue;
        }
      }
    }

    if (extractGroundingSources(candidate, seenUrls, collectedSources)) {
      res.write(`data: ${JSON.stringify({ sources: collectedSources })}\n\n`);
    }

    const thoughtsTokenCount = (chunk as any)?.usageMetadata?.thoughtsTokenCount ?? (candidate as any)?.usageMetadata?.thoughtsTokenCount;
    if (typeof thoughtsTokenCount === "number") {
      res.write(`data: ${JSON.stringify({ thoughtsTokenCount })}\n\n`);
    }

    const finishReason = candidate?.finishReason;
    if (finishReason) {
      sawFinish = true;
      res.write(`data: ${JSON.stringify({ finish: finishReason })}\n\n`);
    }

    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      if ((part as any).thought) {
        res.write(`data: ${JSON.stringify({ thinking: part.text || "" })}\n\n`);
      } else if (part.text) {
        res.write(`data: ${JSON.stringify({ token: part.text })}\n\n`);
      }
    }
    }
  } catch (idleErr: any) {
    if (abortCtrl.signal.aborted) return;
    if (idleErr?.code !== "STREAM_INTERRUPTED") throw idleErr;
    res.write(`data: ${JSON.stringify({ error: idleErr.message, code: "STREAM_INTERRUPTED" })}\n\n`);
    res.write("data: [DONE]\n\n");
    return;
  }

  if (!sawFinish && !abortCtrl.signal.aborted) {
    res.write(
      `data: ${JSON.stringify({
        error: "The provider closed the stream before the response finished. Very long responses can be cut off — try again or split the task into smaller parts.",
        code: "STREAM_INTERRUPTED",
      })}\n\n`
    );
  }
  res.write("data: [DONE]\n\n");
}
