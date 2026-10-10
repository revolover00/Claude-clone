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
