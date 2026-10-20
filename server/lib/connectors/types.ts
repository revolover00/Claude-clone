export type ConnectorAuthType = "oauth" | "mcp";
export type ConnectorConnectionStatus = "connected" | "error" | "needs_reauth";

export interface ConnectorCatalogRecord {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  accent_color: string;
  website_url: string | null;
  auth_type: ConnectorAuthType;
  oauth_config: Record<string, any>;
  mcp_endpoint: string | null;
  enabled: boolean;
  featured: boolean;
  sort_order: number;
}

export interface ConnectorConnectionRecord {
  id: string;
  user_id: string;
  catalog_slug: string | null;
  connection_type: ConnectorAuthType;
  display_name: string;
  server_url: string | null;
  account_id: string | null;
  account_label: string | null;
  status: ConnectorConnectionStatus;
  metadata: Record<string, any>;
  tools_count: number;
  secret_ciphertext: string | null;
  secret_iv: string | null;
  secret_tag: string | null;
  key_version: number | null;
  connected_at: string;
  created_at: string;
  updated_at: string;
}

export interface PublicConnector {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  accentColor: string;
  websiteUrl: string | null;
  authType: ConnectorAuthType;
  oauthConfigured: boolean;
  connected: boolean;
  connectionId?: string;
  accountLabel?: string | null;
  status?: ConnectorConnectionStatus;
  toolsAvailable: boolean;
  toolsCount: number;
  featured: boolean;
  sortOrder: number;
}
