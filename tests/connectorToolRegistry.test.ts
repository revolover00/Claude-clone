import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserConnectionSecrets: vi.fn(),
  getSupabaseClient: vi.fn(),
  decrypt: vi.fn(),
  connection: {
    id: "12345678-1234-4234-8234-123456789012",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    catalog_slug: "google-drive",
    connection_type: "oauth",
    display_name: "Google Drive",
    server_url: null,
    secret_ciphertext: "ciphertext",
    secret_iv: "iv",
    secret_tag: "tag",
    key_version: 1,
  },
  connector: {
    slug: "google-drive",
    name: "Google Drive",
    description: "Search Drive files and read supported documents.",
    category: "productivity",
    icon: "google-drive",
    accent_color: "#0F9D58",
    website_url: "https://drive.google.com",
    auth_type: "oauth",
    oauth_config: { scopes: ["https://www.googleapis.com/auth/drive.readonly"] },
    mcp_endpoint: null,
    enabled: true,
    featured: false,
    sort_order: 40,
  },
}));

vi.mock("../server/lib/connectors/store", () => ({
  CONNECTOR_CATALOG_COLUMNS: "slug,name,oauth_config,mcp_endpoint,enabled",
  getUserConnectionSecrets: mocks.getUserConnectionSecrets,
}));
vi.mock("../server/lib/skills/db", () => ({ getSupabaseClient: mocks.getSupabaseClient }));
vi.mock("../server/lib/crypto/keyVault", () => ({
  buildAAD: vi.fn(),
  decrypt: mocks.decrypt,
  encrypt: vi.fn(),
}));
vi.mock("../server/lib/connectors/oauth", () => ({ refreshOAuthTokens: vi.fn() }));
vi.mock("../server/lib/connectors/mcp", () => ({ openMcpSession: vi.fn() }));

import { createConnectorToolRegistry } from "../server/lib/connectors/toolRegistry";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  mocks.getUserConnectionSecrets.mockReset().mockResolvedValue([mocks.connection]);
  mocks.decrypt.mockReset().mockReturnValue({ plaintext: JSON.stringify({ access_token: "drive-access-token" }) });
  const query: any = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    eq: vi.fn(async () => ({ data: [mocks.connector], error: null })),
  };
  mocks.getSupabaseClient.mockReset().mockReturnValue({ from: vi.fn(() => query) });
});

describe("connector tool registry", () => {
  it("registers native tools for an authorized Drive connection and routes calls", async () => {
    let authorization = "";
    vi.stubGlobal("fetch", vi.fn(async (_input: any, init: RequestInit = {}) => {
      authorization = new Headers(init.headers).get("authorization") || "";
      return new Response(JSON.stringify({ files: [{ id: "file_12345", name: "Roadmap" }] }), {
        headers: { "content-type": "application/json" },
      });
    }) as any);

    const registry = await createConnectorToolRegistry(mocks.connection.user_id);
    const declaration = registry.declarations.find((tool) => tool.description.startsWith("Google Drive: Search Google Drive"));
    expect(registry.declarations).toHaveLength(2);
    expect(declaration?.name).toMatch(/^connector_12345678_search_files_/);
    expect(declaration?.parameters.required).toEqual(["query"]);

    const result = await registry.execute(declaration!.name, { query: "roadmap" });
    expect(authorization).toBe("Bearer drive-access-token");
    expect(result?.result).toContain("Untrusted data from the connector \"Google Drive\"");
    expect(result?.result).toContain("Roadmap");
    expect(result?.skillName).toBe("Google Drive / search_files");
    expect(mocks.getUserConnectionSecrets).toHaveBeenCalledWith(mocks.connection.user_id, 8);
  });
});
