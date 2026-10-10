import crypto from "crypto";
import { getSupabaseClient } from "../skills/db";
import { DocumentFormat } from "./types";

const BUCKET_NAME = "documents";
const SIGNED_URL_EXPIRES_IN = 3600; // 1 hour in seconds

interface LocalDocumentEntry {
  buffer: Buffer;
  fileName: string;
  format: DocumentFormat;
  contentType: string;
  expiresAt: number;
}

// Local cache for non-Supabase environments or unit test mocking
const localDocumentStore = new Map<string, LocalDocumentEntry>();

const CONTENT_TYPES: Record<DocumentFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function storeDocumentAndGetSignedUrl(
  userId: string | undefined,
  documentId: string,
  fileName: string,
  format: DocumentFormat,
  buffer: Buffer
): Promise<string> {
  const supabase = getSupabaseClient();
  const folder = userId && userId.trim() ? userId.trim() : "anonymous";
  const storagePath = `${folder}/${documentId}.${format}`;
  const contentType = CONTENT_TYPES[format] || "application/octet-stream";

  if (supabase) {
    try {
      // Ensure private bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some((b) => b.name === BUCKET_NAME)) {
        await supabase.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: 20 * 1024 * 1024,
        });
      }

      // Upload buffer
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Create signed URL valid for 1 hour
      const { data: signedData, error: signError } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN);

      if (signError || !signedData?.signedUrl) {
        throw signError || new Error("Failed to generate signed URL");
      }

      return signedData.signedUrl;
    } catch (err) {
      console.warn("Supabase storage upload error, falling back to local signed token:", err);
    }
  }

  // Fallback: Generate local signed token valid for 1 hour
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + SIGNED_URL_EXPIRES_IN * 1000;

  localDocumentStore.set(token, {
    buffer,
    fileName,
    format,
    contentType,
    expiresAt,
  });

  // Clean expired tokens
  for (const [key, item] of localDocumentStore.entries()) {
    if (Date.now() > item.expiresAt) {
      localDocumentStore.delete(key);
    }
  }

  return `/api/documents/download/${token}`;
}

export function getStoredDocumentByToken(token: string): LocalDocumentEntry | null {
  const entry = localDocumentStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    localDocumentStore.delete(token);
    return null;
  }
  return entry;
}
