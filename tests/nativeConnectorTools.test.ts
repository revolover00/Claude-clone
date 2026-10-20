import { afterEach, describe, expect, it, vi } from "vitest";
import { createNativeConnectorTools, getNativeConnectorToolCount, hasNativeConnectorTools } from "../server/lib/connectors/nativeTools";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("native connector tools", () => {
  it("advertises only connectors with implemented native tools", () => {
    expect(hasNativeConnectorTools("google-drive")).toBe(true);
    expect(hasNativeConnectorTools("slack")).toBe(true);
    expect(getNativeConnectorToolCount("google-drive")).toBe(createNativeConnectorTools("google-drive", "test-token").length);
    expect(getNativeConnectorToolCount("slack")).toBe(createNativeConnectorTools("slack", "test-token").length);
    expect(hasNativeConnectorTools("linear")).toBe(false);
    expect(createNativeConnectorTools("unknown", "token")).toEqual([]);
  });

  it("searches Drive safely and includes file metadata and links", async () => {
    let requestUrl: URL | null = null;
    let authorization = "";
    vi.stubGlobal("fetch", vi.fn(async (input: any, init: RequestInit = {}) => {
      requestUrl = new URL(String(input));
      authorization = new Headers(init.headers).get("authorization") || "";
      return new Response(JSON.stringify({ files: [{
        id: "file_12345",
        name: "Quarterly Plan",
        mimeType: "application/vnd.google-apps.document",
        modifiedTime: "2026-10-01T12:00:00Z",
        webViewLink: "https://drive.google.com/file/d/file_12345/view",
      }] }), { headers: { "content-type": "application/json" } });
    }) as any);

    const tool = createNativeConnectorTools("google-drive", "drive-token").find((item) => item.name === "search_files");
    expect(tool).toBeDefined();
    const result = await tool!.execute({ query: "Q'a", limit: 2 });

    expect(requestUrl!.origin).toBe("https://www.googleapis.com");
    expect(requestUrl!.pathname).toBe("/drive/v3/files");
    expect(requestUrl!.searchParams.get("q")).toBe("trashed = false and (name contains 'Q\\'a' or fullText contains 'Q\\'a')");
    expect(requestUrl!.searchParams.get("pageSize")).toBe("2");
    expect(authorization).toBe("Bearer drive-token");
    expect(JSON.parse(result)).toMatchObject([{ id: "file_12345", name: "Quarterly Plan", url: "https://drive.google.com/file/d/file_12345/view" }]);
  });

  it("exports Google Docs text with a response-size cap and truncation metadata", async () => {
    const urls: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = new URL(String(input));
      urls.push(url);
      if (url.pathname.endsWith("/export")) return new Response("Document contents");
      return new Response(JSON.stringify({
        id: "abcde_12345",
        name: "Notes",
        mimeType: "application/vnd.google-apps.document",
        webViewLink: "https://docs.google.com/document/d/abcde_12345/edit",
      }), { headers: { "content-type": "application/json" } });
    }) as any);

    const tool = createNativeConnectorTools("google-drive", "drive-token").find((item) => item.name === "read_file");
    expect(tool).toBeDefined();
    const result = JSON.parse(await tool!.execute({ fileId: "abcde_12345", maxCharacters: 1000 }));

    expect(urls).toHaveLength(2);
    expect(urls[1].pathname).toBe("/drive/v3/files/abcde_12345/export");
    expect(urls[1].searchParams.get("mimeType")).toBe("text/plain");
    expect(result).toMatchObject({ name: "Notes", text: "Document contents", truncated: false });
    expect(result.url).toContain("docs.google.com/document");
  });

  it("does not request Drive content for invalid file IDs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const tool = createNativeConnectorTools("google-drive", "drive-token").find((item) => item.name === "read_file");

    await expect(tool!.execute({ fileId: "../../private" })).rejects.toThrow(/valid Google Drive ID/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Slack user tokens for search, public channel listing, and history", async () => {
    const requests: Array<{ url: URL; authorization: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: any, init: RequestInit = {}) => {
      const url = new URL(String(input));
      requests.push({ url, authorization: new Headers(init.headers).get("authorization") || "" });
      const data = url.pathname.endsWith("search.messages")
        ? { ok: true, messages: { matches: [{ channel: { id: "C12345678", name: "general" }, user_name: "Maya", ts: "123", text: "release notes", permalink: "https://workspace.slack.com/archives/C12345678/p123" }] } }
        : url.pathname.endsWith("conversations.list")
          ? { ok: true, channels: [{ id: "C12345678", name: "general", topic: { value: "Updates" }, purpose: { value: "Team news" } }] }
          : { ok: true, messages: [{ user: "U12345678", ts: "122", text: "Earlier update" }] };
      return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
    }) as any);

    const tools = createNativeConnectorTools("slack", "xoxp-user-token");
    const search = tools.find((item) => item.name === "search_messages")!;
    const list = tools.find((item) => item.name === "list_channels")!;
    const history = tools.find((item) => item.name === "read_channel_history")!;
    expect(JSON.parse(await search.execute({ query: "release notes", limit: 3 }))[0]).toMatchObject({ channel: "general", user: "Maya", text: "release notes" });
    expect(JSON.parse(await list.execute({ limit: 7 }))[0]).toMatchObject({ id: "C12345678", name: "general", topic: "Updates" });
    expect(JSON.parse(await history.execute({ channelId: "C12345678", limit: 4 }))[0]).toMatchObject({ user: "U12345678", text: "Earlier update" });

    expect(requests.map(({ url }) => url.pathname)).toEqual([
      "/api/search.messages", "/api/conversations.list", "/api/conversations.history",
    ]);
    expect(requests.every(({ authorization }) => authorization === "Bearer xoxp-user-token")).toBe(true);
    expect(requests[0].url.searchParams.get("query")).toBe("release notes");
    expect(requests[1].url.searchParams.get("types")).toBe("public_channel");
    expect(requests[2].url.searchParams.get("channel")).toBe("C12345678");
  });

  it("reports Slack API errors and blocks redirects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "missing_scope" }), {
      headers: { "content-type": "application/json" },
    })) as any);
    const search = createNativeConnectorTools("slack", "xoxp-user-token").find((item) => item.name === "search_messages")!;
    await expect(search.execute({ query: "test" })).rejects.toThrow(/missing_scope/);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://evil.example" } })) as any);
    await expect(search.execute({ query: "test" })).rejects.toThrow(/redirects are not allowed/i);
  });
});
