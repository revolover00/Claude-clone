import crypto from "crypto";
import { CreateDocumentInput, GeneratedDocument } from "./types";
import { validateDocumentInput, MAX_FILE_SIZE_BYTES } from "./validators";
import { generateDocxBuffer } from "./generators/docx";
import { generatePdfBuffer } from "./generators/pdf";
import { generatePptxBuffer } from "./generators/pptx";
import { generateXlsxBuffer } from "./generators/xlsx";
import { storeDocumentAndGetSignedUrl } from "./storage";

// User rate-limiting: max 15 document creations per minute
const rateLimitMap = new Map<string, number[]>();

export function checkUserRateLimit(userKey: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = (rateLimitMap.get(userKey) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= 15) {
    return false;
  }

  timestamps.push(now);
  rateLimitMap.set(userKey, timestamps);
  return true;
}

export async function createDocumentService(
  input: CreateDocumentInput
): Promise<GeneratedDocument> {
  const userKey = input.userId || "anonymous";

  if (!checkUserRateLimit(userKey)) {
    throw new Error("Rate limit exceeded: Maximum 15 document creations per minute.");
  }

  const validation = validateDocumentInput(input);
  if (!validation.valid || !validation.normalizedSpec) {
    throw new Error(validation.error || "Document specification validation failed.");
  }

  const { format, title } = input;
  const spec = validation.normalizedSpec;
  const docId = crypto.randomUUID();
  const sanitizedTitle = title
    .replace(/[^\w\s\u0600-\u06FF-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 50);
  const fileName = `${sanitizedTitle || "document"}_${docId.slice(0, 6)}.${format}`;

  // Execute generation with 30s timeout
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Document generation timed out (30s limit).")), 30000)
  );

  const generatePromise = (async () => {
    switch (format) {
      case "docx":
        return await generateDocxBuffer(title, spec);
      case "pdf":
        return await generatePdfBuffer(title, spec);
      case "pptx":
        return await generatePptxBuffer(title, spec);
      case "xlsx":
        return await generateXlsxBuffer(title, spec);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  })();

  const buffer = await Promise.race([generatePromise, timeoutPromise]);

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Generated document size (${Math.round(buffer.length / 1024 / 1024)}MB) exceeds 20MB limit.`
    );
  }

  const signedUrl = await storeDocumentAndGetSignedUrl(
    input.userId,
    docId,
    fileName,
    format,
    buffer
  );

  return {
    id: docId,
    format,
    title,
    fileName,
    size: buffer.length,
    url: signedUrl,
    createdAt: Date.now(),
    spec,
  };
}
