import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("../src/utils/safeFetch", () => ({ authFetch: mocks.authFetch }));

import { ConnectorsSettingsView } from "../src/components/connectors/ConnectorsSettingsView";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  } as Response;
}

const catalogResponse = {
  connectors: [
    {
      slug: "github",
      name: "GitHub",
      description: "Search repositories and inspect code.",
      category: "development",
      icon: "github",
      accentColor: "#24292F",
      websiteUrl: "https://github.com",
      authType: "oauth",
      oauthConfigured: true,
      connected: true,
      connectionId: "11111111-1111-4111-8111-111111111111",
      accountLabel: "octocat",
      status: "connected",
      mcpAvailable: true,
      toolsCount: 4,
      featured: true,
      sortOrder: 10,
    },
    {
      slug: "notion",
      name: "Notion",
      description: "Connect a workspace.",
      category: "productivity",
      icon: "notion",
      accentColor: "#111111",
      websiteUrl: "https://www.notion.so",
      authType: "oauth",
      oauthConfigured: false,
      connected: false,
      mcpAvailable: true,
      toolsCount: 0,
      featured: true,
      sortOrder: 20,
    },
    {
      slug: "linear",
      name: "Linear",
      description: "Search and manage issues.",
      category: "project-management",
      icon: "linear",
      accentColor: "#5E6AD2",
      websiteUrl: "https://linear.app",
      authType: "oauth",
      oauthConfigured: true,
      connected: false,
      mcpAvailable: true,
      toolsCount: 0,
      featured: false,
      sortOrder: 30,
    },
  ],
  customConnections: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      displayName: "Internal MCP",
      serverUrl: "https://tools.example.com/mcp",
      accountLabel: "Tools",
      status: "connected",
      toolsCount: 2,
      connectedAt: "2026-10-20T00:00:00Z",
    },
  ],
};

beforeEach(() => {
  mocks.authFetch.mockReset();
  mocks.authFetch.mockResolvedValue(jsonResponse(catalogResponse));
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Connectors settings view", () => {
  it("renders the database catalog, connected accounts, and custom MCP tools", async () => {
    render(<ConnectorsSettingsView />);

    expect(await screen.findByRole("heading", { name: "Connectors" })).toBeDefined();
    expect(screen.getByText("GitHub")).toBeDefined();
    expect(screen.getByText("Connected as octocat")).toBeDefined();
    expect(screen.getByText("Notion")).toBeDefined();
    expect(screen.getByText("Setup required")).toBeDefined();
    expect(screen.getByText("Internal MCP")).toBeDefined();
    expect(screen.getByText("2 tools available in chat")).toBeDefined();
  });

  it("filters connector cards by search and opens the custom MCP dialog", async () => {
    render(<ConnectorsSettingsView />);
    await screen.findByText("GitHub");

    fireEvent.change(screen.getByRole("textbox", { name: "Search connectors" }), { target: { value: "linear" } });
    await waitFor(() => expect(screen.getByText("Linear")).toBeDefined());
    expect(screen.queryByText("GitHub")).toBeNull();
    expect(screen.queryByText("Internal MCP")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Add MCP server/i }));
    expect(screen.getByRole("dialog", { name: "Add an MCP server" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Test and connect" })).toBeDefined();
  });
});
