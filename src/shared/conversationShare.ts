import DOMPurify from "dompurify";
import { marked } from "marked";

export interface ShareMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SharedConversationSnapshot {
  version: 1;
  title: string;
  messages: ShareMessage[];
}

const MAX_MESSAGES = 500;
const MAX_MESSAGE_CHARACTERS = 100_000;
const MAX_SNAPSHOT_BYTES = 1_000_000;
export const MAX_SHARE_TOKEN_LENGTH = 60_000;

class ShareLinkError extends Error {}

function shareError(message: string): ShareLinkError {
  return new ShareLinkError(message);
}

export function buildShareSnapshot(
  title: string,
  sourceMessages: ReadonlyArray<{ role: string; content?: unknown }>
): SharedConversationSnapshot {
  const messages: ShareMessage[] = [];
  for (const source of sourceMessages) {
    if (source.role !== "user" && source.role !== "assistant") continue;
    if (typeof source.content !== "string" || !source.content.trim()) continue;
    if (source.content.length > MAX_MESSAGE_CHARACTERS) {
      throw shareError("A message is too large to include in a share link.");
    }
    messages.push({ role: source.role, content: source.content });
  }
  if (messages.length === 0) {
    throw shareError("This conversation does not contain any text messages to share.");
  }
  if (messages.length > MAX_MESSAGES) {
    throw shareError("This conversation has too many messages for a share link.");
  }
  return {
    version: 1,
    title: (title.trim() || "Shared conversation").slice(0, 160),
    messages,
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(encoded: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw shareError("This share link is invalid or incomplete.");
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function transformBytes(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
  maxBytes: number
): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(bytes); controller.close(); },
  });
  const typedTransform = transform as unknown as ReadableWritablePair<Uint8Array, Uint8Array>;
  const reader = source.pipeThrough(typedTransform).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw shareError("This share link is too large to open.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function validateSnapshot(value: unknown): SharedConversationSnapshot {
  if (!value || typeof value !== "object") throw shareError("This share link is invalid or incomplete.");
  const candidate = value as Partial<SharedConversationSnapshot>;
  if (candidate.version !== 1 || !Array.isArray(candidate.messages)) {
    throw shareError("This share link uses an unsupported format.");
  }
  if (candidate.messages.some((message) =>
    !message || typeof message !== "object" ||
    (message.role !== "user" && message.role !== "assistant") ||
    typeof message.content !== "string"
  )) {
    throw shareError("This share link contains invalid message data.");
  }
  return buildShareSnapshot(candidate.title || "Shared conversation", candidate.messages);
}

export async function encodeShareToken(snapshot: SharedConversationSnapshot): Promise<string> {
  const safeSnapshot = validateSnapshot(snapshot);
  const raw = new TextEncoder().encode(JSON.stringify(safeSnapshot));
  if (raw.length > MAX_SNAPSHOT_BYTES) {
    throw shareError("This conversation is too large to fit in a share link. Try sharing a shorter chat.");
  }
  let mode = "j";
  let data: Uint8Array = raw;
  if (typeof CompressionStream !== "undefined") {
    const compressed = await transformBytes(raw, new CompressionStream("gzip"), MAX_SNAPSHOT_BYTES);
    if (compressed.length < raw.length) {
      mode = "g";
      data = compressed;
    }
  }
  const token = `v1.${mode}.${toBase64Url(data)}`;
  if (token.length > MAX_SHARE_TOKEN_LENGTH) {
    throw shareError("This conversation is too large to fit in a share link. Try sharing a shorter chat.");
  }
  return token;
}

export async function decodeShareToken(token: string): Promise<SharedConversationSnapshot> {
  if (!token || token.length > MAX_SHARE_TOKEN_LENGTH) {
    throw shareError("This share link is invalid or too large to open.");
  }
  const [version, mode, encoded, ...extra] = token.split(".");
  if (version !== "v1" || !encoded || extra.length > 0 || !["g", "j"].includes(mode)) {
    throw shareError("This share link uses an unsupported format.");
  }
  try {
    let bytes = fromBase64Url(encoded);
    if (mode === "g") {
      if (typeof DecompressionStream === "undefined") {
        throw shareError("This browser cannot open compressed share links. Update your browser and try again.");
      }
      bytes = await transformBytes(bytes, new DecompressionStream("gzip"), MAX_SNAPSHOT_BYTES);
    }
    if (bytes.length > MAX_SNAPSHOT_BYTES) throw shareError("This share link is too large to open.");
    return validateSnapshot(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch (error) {
    if (error instanceof ShareLinkError) throw error;
    throw shareError("This share link is invalid or incomplete.");
  }
}

export function readShareTokenFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, "")).get("share");
}

export function renderSafeSharedMarkdown(content: string): string {
  const html = marked.parse(content, { async: false, breaks: true, gfm: true });
  return DOMPurify.sanitize(html);
}
