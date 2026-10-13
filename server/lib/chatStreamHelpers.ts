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
  runSkillToolStream: any;
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
  runSkillToolStream,
}: PumpGeminiStreamParams): Promise<void> {
  const skillExecutionState = { skillLoadsCount: 0, totalBytesLoaded: 0 };
  const collectedSources: Array<{ title: string; url: string }> = [];
  const seenUrls = new Set<string>();

  for await (const chunk of stream) {
    if (abortCtrl.signal.aborted) break;
    const candidate = chunk.candidates?.[0];

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if ((part as any).functionCall) {
          const call = (part as any).functionCall;
          const skillTarget = call.args?.name || call.args?.skill;
          res.write(`data: ${JSON.stringify({ tool: { name: call.name, skill: skillTarget, status: "executing" } })}\n\n`);

          const execRes = await executeSkillFunctionCall(userId, call, skillExecutionState);
          if (execRes.document) {
            res.write(`data: ${JSON.stringify({ document: execRes.document })}\n\n`);
          }
          if (execRes.documentError) {
            res.write(`data: ${JSON.stringify({ documentError: execRes.documentError })}\n\n`);
          }

          const toolStatus = execRes.documentError ? "error" : "completed";
          res.write(`data: ${JSON.stringify({ tool: { name: call.name, skill: execRes.skillName || skillTarget, status: toolStatus } })}\n\n`);

          try {
            const contStream = await runSkillToolStream(modelId, formattedMessages, config, call, execRes.result);
            for await (const contChunk of contStream) {
              if (abortCtrl.signal.aborted) break;
              const contCandidate = contChunk.candidates?.[0];
              const contParts = contCandidate?.content?.parts || [];
              for (const cp of contParts) {
                if ((cp as any).thought) {
                  res.write(`data: ${JSON.stringify({ thinking: cp.text || "" })}\n\n`);
                } else if (cp.text) {
                  res.write(`data: ${JSON.stringify({ token: cp.text })}\n\n`);
                }
              }
            }
          } catch (contErr) {
            console.error("Continuation stream error:", contErr);
          }
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

  res.write("data: [DONE]\n\n");
}
