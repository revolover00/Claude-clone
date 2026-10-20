export interface Connector {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  accentColor: string;
  websiteUrl?: string | null;
  authType: "oauth" | "mcp";
  oauthConfigured: boolean;
  connected: boolean;
  connectionId?: string;
  accountLabel?: string | null;
  status?: "connected" | "error" | "needs_reauth";
  toolsAvailable: boolean;
  toolsCount: number;
  featured: boolean;
  sortOrder: number;
}

export interface CustomConnection {
  id: string;
  displayName: string;
  serverUrl?: string | null;
  accountLabel?: string | null;
  status: "connected" | "error" | "needs_reauth";
  toolsCount: number;
  connectedAt: string;
}

interface ApiPayload {
  connectors?: Connector[];
  customConnections?: CustomConnection[];
  authorizationUrl?: string;
  error?: string;
}

export type Filter = "all" | "connected" | "available";

export const CATEGORY_LABELS: Record<string, string> = {
  productivity: "Productivity",
  development: "Development",
  communication: "Communication",
  "project-management": "Project management",
};

export const CATEGORY_ORDER = ["productivity", "development", "communication", "project-management"];

export async function responsePayload(response: Response): Promise<ApiPayload> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload;
}
