export interface NativeConnectorTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute(args: Record<string, any>): Promise<string>;
}

const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const SLACK_API = "https://slack.com/api";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_TOOL_TEXT_CHARS = 30_000;

export function getNativeConnectorToolCount(slug: string): number {
  if (slug === "google-drive") return 2;
  if (slug === "slack") return 3;
  return 0;
}

export function hasNativeConnectorTools(slug: string): boolean {
  return getNativeConnectorToolCount(slug) > 0;
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function readBoundedBody(response: Response): Promise<string> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) throw new Error("Provider response was too large.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Provider response was too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

async function requestJson(url: URL, token: string, signal?: AbortSignal): Promise<Record<string, any>> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    redirect: "manual",
    signal: requestSignal(signal),
  });
  if (response.status >= 300 && response.status < 400) throw new Error("Provider redirects are not allowed.");
  const body = await readBoundedBody(response);
  let data: Record<string, any>;
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    throw new Error("Provider returned invalid JSON.");
  }
  if (!response.ok) throw new Error(providerMessage(data, response.status));
  return data;
}

async function requestText(url: URL, token: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "text/plain, text/csv, text/*;q=0.9, */*;q=0.1" },
    redirect: "manual",
    signal: requestSignal(signal),
  });
  if (response.status >= 300 && response.status < 400) throw new Error("Provider redirects are not allowed.");
  const body = await readBoundedBody(response);
  if (!response.ok) {
    let data: Record<string, any> = {};
    try { data = JSON.parse(body); } catch { /* Use a generic HTTP error. */ }
    throw new Error(providerMessage(data, response.status));
  }
  return body;
}

function providerMessage(data: Record<string, any>, status: number): string {
  const message = data.error?.message || data.error || data.message;
  return String(message || `Provider request failed (HTTP ${status}).`)
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .slice(0, 300);
}

function requiredText(args: Record<string, any>, key: string, maxLength: number): string {
  const value = typeof args[key] === "string" ? args[key].trim() : "";
  if (!value || value.length > maxLength) throw new Error(`${key} must be between 1 and ${maxLength} characters.`);
  return value;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function driveQueryLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function googleDriveTools(token: string, signal?: AbortSignal): NativeConnectorTool[] {
  return [
    {
      name: "search_files",
      description: "Search Google Drive file names and indexed text, returning matching file metadata and links.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Words to find in a file name or indexed file text." },
          limit: { type: "integer", description: "Maximum results to return (1–20)." },
        },
        required: ["query"],
      },
      async execute(args) {
        const query = driveQueryLiteral(requiredText(args, "query", 300));
        const url = new URL(`${GOOGLE_DRIVE_API}/files`);
        url.searchParams.set("q", `trashed = false and (name contains '${query}' or fullText contains '${query}')`);
        url.searchParams.set("pageSize", String(boundedInteger(args.limit, 10, 1, 20)));
        url.searchParams.set("orderBy", "modifiedTime desc");
        url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink)");
        const data = await requestJson(url, token, signal);
        const files = Array.isArray(data.files) ? data.files : [];
        if (!files.length) return "No matching Google Drive files were found.";
        return JSON.stringify(files.map((file: any) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          url: file.webViewLink,
        })));
      },
    },
    {
      name: "read_file",
      description: "Read text from a Google Drive file. Google Docs and Sheets are exported as plain text or CSV; unsupported formats return metadata and a link.",
      inputSchema: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "The Google Drive file ID from search_files." },
          maxCharacters: { type: "integer", description: "Maximum text characters to return (1,000–30,000)." },
        },
        required: ["fileId"],
      },
      async execute(args) {
        const fileId = requiredText(args, "fileId", 512);
        if (!/^[A-Za-z0-9_-]{5,512}$/.test(fileId)) throw new Error("fileId is not a valid Google Drive ID.");
        const metadataUrl = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}`);
        metadataUrl.searchParams.set("fields", "id,name,mimeType,modifiedTime,webViewLink");
        const file = await requestJson(metadataUrl, token, signal);
        const mimeType = String(file.mimeType || "");
        let exportMime: string | null = null;
        if (mimeType === "application/vnd.google-apps.document") exportMime = "text/plain";
        if (mimeType === "application/vnd.google-apps.spreadsheet") exportMime = "text/csv";
        const isTextFile = /^text\/(plain|csv|markdown|html|xml)$/.test(mimeType) || mimeType === "application/json";
        if (!exportMime && !isTextFile) {
          return JSON.stringify({
            name: file.name,
            mimeType,
            modifiedTime: file.modifiedTime,
            url: file.webViewLink,
            note: "This file format is not supported for text extraction.",
          });
        }
        const contentUrl = new URL(`${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}/${exportMime ? "export" : ""}`.replace(/\/$/, ""));
        if (exportMime) contentUrl.searchParams.set("mimeType", exportMime);
        else contentUrl.searchParams.set("alt", "media");
        const text = await requestText(contentUrl, token, signal);
        const maxCharacters = boundedInteger(args.maxCharacters, 12_000, 1_000, MAX_TOOL_TEXT_CHARS);
        const clipped = text.slice(0, maxCharacters);
        return JSON.stringify({
          name: file.name,
          mimeType,
          modifiedTime: file.modifiedTime,
          url: file.webViewLink,
          text: clipped,
          truncated: text.length > clipped.length,
        });
      },
    },
  ];
}

function slackTools(token: string, signal?: AbortSignal): NativeConnectorTool[] {
  return [
    {
      name: "search_messages",
      description: "Search Slack messages visible to the connected user and return matching excerpts with channel links.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Slack search terms, optionally using Slack search operators." },
          limit: { type: "integer", description: "Maximum matches to return (1–10)." },
        },
        required: ["query"],
      },
      async execute(args) {
        const url = new URL(`${SLACK_API}/search.messages`);
        url.searchParams.set("query", requiredText(args, "query", 500));
        url.searchParams.set("count", String(boundedInteger(args.limit, 5, 1, 10)));
        url.searchParams.set("sort", "timestamp");
        url.searchParams.set("sort_dir", "desc");
        const data = await requestJson(url, token, signal);
        if (data.ok !== true) throw new Error(providerMessage(data, 200));
        const matches = Array.isArray(data.messages?.matches) ? data.messages.matches : [];
        if (!matches.length) return "No matching Slack messages were found.";
        return JSON.stringify(matches.map((message: any) => ({
          channel: message.channel?.name || message.channel?.id,
          user: message.user_name || message.username || message.user,
          timestamp: message.ts,
          url: message.permalink,
          text: message.text,
        })));
      },
    },
    {
      name: "list_channels",
      description: "List public Slack channels visible to the connected user.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", description: "Maximum channels to return (1–100)." } },
      },
      async execute(args) {
        const url = new URL(`${SLACK_API}/conversations.list`);
        url.searchParams.set("types", "public_channel");
        url.searchParams.set("exclude_archived", "true");
        url.searchParams.set("limit", String(boundedInteger(args.limit, 50, 1, 100)));
        const data = await requestJson(url, token, signal);
        if (data.ok !== true) throw new Error(providerMessage(data, 200));
        const channels = Array.isArray(data.channels) ? data.channels : [];
        return channels.length ? JSON.stringify(channels.map((channel: any) => ({
          id: channel.id,
          name: channel.name,
          topic: channel.topic?.value || "",
          purpose: channel.purpose?.value || "",
        }))) : "No public Slack channels were found.";
      },
    },
    {
      name: "read_channel_history",
      description: "Read recent messages from a Slack conversation the connected user can access.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "A Slack conversation ID from list_channels." },
          limit: { type: "integer", description: "Maximum recent messages to return (1–50)." },
        },
        required: ["channelId"],
      },
      async execute(args) {
        const channelId = requiredText(args, "channelId", 32);
        if (!/^[A-Z0-9]{8,32}$/.test(channelId)) throw new Error("channelId is not a valid Slack conversation ID.");
        const url = new URL(`${SLACK_API}/conversations.history`);
        url.searchParams.set("channel", channelId);
        url.searchParams.set("limit", String(boundedInteger(args.limit, 20, 1, 50)));
        const data = await requestJson(url, token, signal);
        if (data.ok !== true) throw new Error(providerMessage(data, 200));
        const messages = Array.isArray(data.messages) ? data.messages : [];
        return messages.length ? JSON.stringify(messages.map((message: any) => ({
          user: message.user,
          timestamp: message.ts,
          text: message.text,
          replyCount: message.reply_count || 0,
        }))) : "No Slack messages were found in this conversation.";
      },
    },
  ];
}

export function createNativeConnectorTools(slug: string, accessToken: string, signal?: AbortSignal): NativeConnectorTool[] {
  if (!accessToken) return [];
  if (slug === "google-drive") return googleDriveTools(accessToken, signal);
  if (slug === "slack") return slackTools(accessToken, signal);
  return [];
}
