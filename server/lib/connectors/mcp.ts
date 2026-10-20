import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const MCP_PROTOCOL_VERSION = "2025-03-26";
const MCP_TIMEOUT_MS = 15_000;
const MCP_MAX_RESPONSE_BYTES = 1024 * 1024;
const MCP_MAX_TOOLS = 500;

type JsonRecord = Record<string, any>;

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: JsonRecord;
}

export interface McpSession {
  serverInfo: JsonRecord;
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: JsonRecord): Promise<string>;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168) && (b !== 0 || c === 0)) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function isPrivateIpv6(address: string): boolean {
  const ip = address.toLowerCase().split("%")[0];
  if (!ip || ip === "::" || ip === "::1") return true;
  if (ip.startsWith("::ffff:")) {
    const mapped = ip.slice("::ffff:".length);
    if (isIP(mapped) === 4) return isPrivateIpv4(mapped);
    return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb") || ip.startsWith("ff")) return true;
  if (ip.startsWith("2001:db8:") || ip === "2001:db8") return true;
  const first = Number.parseInt(ip.split(":")[0] || "0", 16);
  // Only global unicast in 2000::/3 is routable on the public Internet.
  return first < 0x2000 || first > 0x3fff;
}

export function isPrivateOrSpecialAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".test");
}

/**
 * Rejects non-HTTPS and private-network endpoints before the server makes an outbound request.
 * DNS is checked on every request to reduce DNS-rebinding/SSRF exposure for user-defined MCP URLs.
 */
export async function assertSafeRemoteUrl(input: string | URL): Promise<URL> {
  let url: URL;
  try {
    url = input instanceof URL ? new URL(input.toString()) : new URL(input);
  } catch {
    throw new Error("Enter a valid MCP server URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("MCP servers must use HTTPS.");
  }
  if (url.username || url.password || url.hash) {
    throw new Error("MCP server URLs cannot include credentials or fragments.");
  }
  if (isLocalHostname(url.hostname)) {
    throw new Error("Local and private network MCP servers are not allowed.");
  }
  if (isIP(url.hostname)) {
    if (isPrivateOrSpecialAddress(url.hostname)) {
      throw new Error("Local and private network MCP servers are not allowed.");
    }
    return url;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("The MCP server hostname could not be resolved.");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateOrSpecialAddress(address))) {
    throw new Error("MCP server hostnames must resolve only to public IP addresses.");
  }
  return url;
}

async function readLimitedText(response: Response, maxBytes = MCP_MAX_RESPONSE_BYTES): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("MCP server response exceeded the 1 MB limit.");
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total).toString("utf8");
  } finally {
    reader.releaseLock();
  }
}

function parseSseMessage(text: string): JsonRecord {
  const dataMessages = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  for (let index = dataMessages.length - 1; index >= 0; index--) {
    try {
      const value = JSON.parse(dataMessages[index]);
      if (value && typeof value === "object") return value;
    } catch {
      // Try the previous SSE data event; servers may send a trailing keepalive.
    }
  }
  throw new Error("MCP server returned an invalid event-stream response.");
}

function resultError(message: any): Error {
  const safe = typeof message === "string" ? message.slice(0, 500) : "MCP request failed.";
  return new Error(safe);
}

function toMcpText(result: JsonRecord): string {
  if (result?.isError) throw resultError("The MCP tool reported an error.");
  if (result?.structuredContent !== undefined) {
    const structured = JSON.stringify(result.structuredContent);
    if (structured.length <= 80_000) return structured;
  }
  const content = Array.isArray(result?.content) ? result.content : [];
  const output = content.map((item: any) => {
    if (item?.type === "text" && typeof item.text === "string") return item.text;
    if (item?.type === "image") return "[MCP returned an image; image content is not included in this response.]";
    if (item?.type === "resource" && item.resource) {
      return typeof item.resource.text === "string" ? item.resource.text : "[MCP returned a resource.]";
    }
    return "";
  }).filter(Boolean).join("\n");
  return output.slice(0, 80_000) || "The MCP tool completed without a text result.";
}

export async function openMcpSession(
  serverUrl: string,
  bearerToken?: string | null,
  signal?: AbortSignal
): Promise<McpSession> {
  const url = await assertSafeRemoteUrl(serverUrl);
  let requestId = 0;
  let sessionId: string | null = null;
  let protocolVersion = MCP_PROTOCOL_VERSION;
  const token = bearerToken?.trim() || "";

  const rpc = async (method: string, params?: JsonRecord, notification = false): Promise<JsonRecord> => {
    const id = notification ? undefined : ++requestId;
    const body = { jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, ...(params ? { params } : {}) };
    const headers: Record<string, string> = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": protocolVersion,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (sessionId) headers["Mcp-Session-Id"] = sessionId;

    const timeoutSignal = AbortSignal.timeout(MCP_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const requestUrl = await assertSafeRemoteUrl(url);
    const response = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "manual",
      signal: requestSignal,
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      throw new Error("MCP server redirects are not allowed.");
    }
    if (!response.ok && response.status !== 202) {
      if (response.status === 401 || response.status === 403) throw new Error("MCP server authorization failed. Check its token.");
      throw new Error(`MCP server returned HTTP ${response.status}.`);
    }

    const responseSessionId = response.headers.get("mcp-session-id");
    if (responseSessionId) sessionId = responseSessionId;
    if (notification || response.status === 202 || !response.body) return {};

    const text = await readLimitedText(response);
    if (!text.trim()) return {};
    const contentType = response.headers.get("content-type") || "";
    let payload: JsonRecord;
    try {
      payload = contentType.includes("text/event-stream") ? parseSseMessage(text) : JSON.parse(text);
    } catch {
      throw new Error("MCP server returned malformed JSON.");
    }
    if (payload.error) throw resultError(payload.error.message || payload.error);
    if (id !== undefined && payload.id !== undefined && payload.id !== id) {
      throw new Error("MCP server returned a mismatched JSON-RPC response.");
    }
    return payload.result || {};
  };

  const initialize = await rpc("initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "claude-clone", version: "1.0.0" },
  });
  if (typeof initialize.protocolVersion === "string") protocolVersion = initialize.protocolVersion;
  await rpc("notifications/initialized", undefined, true).catch(() => undefined);

  return {
    serverInfo: initialize.serverInfo && typeof initialize.serverInfo === "object" ? initialize.serverInfo : {},
    async listTools(): Promise<McpTool[]> {
      const tools: McpTool[] = [];
      let cursor: string | undefined;
      do {
        const result = await rpc("tools/list", cursor ? { cursor } : {});
        const page = Array.isArray(result.tools) ? result.tools : [];
        for (const tool of page) {
          if (typeof tool?.name === "string" && tool.name.trim()) {
            tools.push({
              name: tool.name.slice(0, 100),
              description: typeof tool.description === "string" ? tool.description.slice(0, 1500) : "",
              inputSchema: tool.inputSchema && typeof tool.inputSchema === "object" ? tool.inputSchema : { type: "object", properties: {} },
            });
          }
          if (tools.length >= MCP_MAX_TOOLS) return tools.slice(0, MCP_MAX_TOOLS);
        }
        cursor = typeof result.nextCursor === "string" && result.nextCursor ? result.nextCursor : undefined;
      } while (cursor);
      return tools;
    },
    async callTool(name: string, args: JsonRecord): Promise<string> {
      const result = await rpc("tools/call", { name, arguments: args || {} });
      return toMcpText(result);
    },
  };
}
