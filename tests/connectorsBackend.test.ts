import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import { assertSafeRemoteUrl, isPrivateOrSpecialAddress, openMcpSession } from "../server/lib/connectors/mcp";
import { buildAuthorizationUrl, createOAuthState, getOAuthCredentials } from "../server/lib/connectors/oauth";
import { toGeminiSchema, toOpenAiSchema } from "../server/lib/connectors/toolRegistry";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("MCP endpoint validation", () => {
  it("rejects loopback, private, and plain HTTP endpoints", async () => {
    await expect(assertSafeRemoteUrl("https://127.0.0.1:8443/mcp")).rejects.toThrow(/private network/i);
    await expect(assertSafeRemoteUrl("https://192.168.1.12/mcp")).rejects.toThrow(/private network/i);
    await expect(assertSafeRemoteUrl("http://mcp.example.com/mcp")).rejects.toThrow(/HTTPS/i);
    expect(isPrivateOrSpecialAddress("10.1.2.3")).toBe(true);
    expect(isPrivateOrSpecialAddress("8.8.8.8")).toBe(false);
  });

  it("initializes a Streamable HTTP MCP session and lists/calls tools", async () => {
    const requests: Array<{ method: string; headers: Headers }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: any, init: RequestInit = {}) => {
      const body = JSON.parse(String(init.body || "{}"));
      requests.push({ method: body.method, headers: new Headers(init.headers) });
      if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
      let result: any = {};
      if (body.method === "initialize") {
        result = { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "Test MCP" } };
      } else if (body.method === "tools/list") {
        result = { tools: [{ name: "search_items", description: "Search test items", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }] };
      } else if (body.method === "tools/call") {
        result = { content: [{ type: "text", text: `Found ${body.params.arguments.query}` }] };
      }
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), {
        headers: { "content-type": "application/json", "mcp-session-id": "session-1" },
      });
    }) as any);

    const session = await openMcpSession("https://mcp.example.com/mcp", "private-token");
    const tools = await session.listTools();
    const result = await session.callTool("search_items", { query: "alpha" });

    expect(session.serverInfo.name).toBe("Test MCP");
    expect(tools.map((tool) => tool.name)).toEqual(["search_items"]);
    expect(result).toBe("Found alpha");
    expect(requests.map((request) => request.method)).toEqual([
      "initialize", "notifications/initialized", "tools/list", "tools/call",
    ]);
    expect(requests[0].headers.get("authorization")).toBe("Bearer private-token");
    expect(requests[2].headers.get("mcp-session-id")).toBe("session-1");
  });
});

describe("OAuth configuration", () => {
  it("generates a high-entropy state and PKCE verifier/challenge", () => {
    const result = createOAuthState();
    expect(result.state).toHaveLength(43);
    expect(result.codeVerifier.length).toBeGreaterThan(40);
    expect(result.stateHash).not.toBe(result.state);
    expect(result.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("requires server-side OAuth client credentials with the connector prefix", () => {
    const connector = {
      slug: "github",
      name: "GitHub",
      oauth_config: {
        client_id_env: "CONNECTOR_OAUTH_GITHUB_CLIENT_ID",
        client_secret_env: "CONNECTOR_OAUTH_GITHUB_CLIENT_SECRET",
      },
    };
    vi.stubEnv("CONNECTOR_OAUTH_GITHUB_CLIENT_ID", "client-id");
    vi.stubEnv("CONNECTOR_OAUTH_GITHUB_CLIENT_SECRET", "client-secret");
    expect(getOAuthCredentials(connector)).toEqual({ clientId: "client-id", clientSecret: "client-secret" });

    expect(getOAuthCredentials({
      ...connector,
      oauth_config: { client_id_env: "SUPABASE_SERVICE_ROLE_KEY", client_secret_env: "OTHER_SECRET" },
    })).toBeNull();
  });

  it("builds an authorization URL with state, callback and S256 PKCE", async () => {
    const connector = {
      slug: "notion",
      name: "Notion",
      oauth_config: {
        authorization_url: "https://auth.example.com/authorize",
        scopes: ["read", "write"],
        authorize_params: { owner: "user" },
      },
    };
    const url = new URL(await buildAuthorizationUrl(connector, "client-id", "random-state", "pkce-challenge", "https://app.example.com/api/connectors/oauth/callback"));
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("state")).toBe("random-state");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/connectors/oauth/callback");
    expect(url.searchParams.get("scope")).toBe("read write");
    expect(url.searchParams.get("code_challenge")).toBe("pkce-challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("owner")).toBe("user");
  });
});

describe("MCP tool schema normalization", () => {
  const schema = {
    type: "object",
    description: "Search parameters",
    properties: {
      query: { type: "string", description: "Search query" },
      limit: { type: "integer" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["query"],
  };

  it("converts JSON Schema into Gemini function parameters", () => {
    const converted = toGeminiSchema(schema);
    expect(converted).toMatchObject({
      type: "OBJECT",
      required: ["query"],
      properties: {
        query: { type: "STRING", description: "Search query" },
        limit: { type: "INTEGER" },
        tags: { type: "ARRAY", items: { type: "STRING" } },
      },
    });
  });

  it("normalizes JSON Schema for OpenAI-compatible tools", () => {
    const converted = toOpenAiSchema(schema);
    expect(converted).toMatchObject({
      type: "object",
      required: ["query"],
      additionalProperties: false,
      properties: {
        query: { type: "string" },
        limit: { type: "integer" },
        tags: { type: "array", items: { type: "string" } },
      },
    });
  });
});
