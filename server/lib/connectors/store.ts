import { getSupabaseClient } from "../skills/db";
import type { ConnectorCatalogRecord, ConnectorConnectionRecord } from "./types";

export const CONNECTOR_CATALOG_COLUMNS =
  "slug,name,description,category,icon,accent_color,website_url,auth_type,oauth_config,mcp_endpoint,enabled,featured,sort_order";
export const CONNECTOR_SAFE_CONNECTION_COLUMNS =
  "id,user_id,catalog_slug,connection_type,display_name,server_url,account_id,account_label,status,metadata,tools_count,connected_at,created_at,updated_at";
export const CONNECTOR_SECRET_CONNECTION_COLUMNS =
  `${CONNECTOR_SAFE_CONNECTION_COLUMNS},secret_ciphertext,secret_iv,secret_tag,key_version`;

export function getConnectorDb() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Connectors require Supabase server credentials.");
  return supabase;
}

export async function listConnectorCatalog(): Promise<ConnectorCatalogRecord[]> {
  const { data, error } = await getConnectorDb()
    .from("connector_catalog")
    .select(CONNECTOR_CATALOG_COLUMNS)
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`Unable to load connector catalog: ${error.message}`);
  return (data || []) as ConnectorCatalogRecord[];
}

export async function getConnectorBySlug(slug: string): Promise<ConnectorCatalogRecord | null> {
  const { data, error } = await getConnectorDb()
    .from("connector_catalog")
    .select(CONNECTOR_CATALOG_COLUMNS)
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle();
  if (error) throw new Error(`Unable to load connector: ${error.message}`);
  return data as ConnectorCatalogRecord | null;
}

export async function listUserConnections(userId: string): Promise<ConnectorConnectionRecord[]> {
  const { data, error } = await getConnectorDb()
    .from("connector_connections")
    .select(CONNECTOR_SAFE_CONNECTION_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load connector connections: ${error.message}`);
  return (data || []) as ConnectorConnectionRecord[];
}

export async function getUserConnectionSecrets(userId: string, limit = 8): Promise<ConnectorConnectionRecord[]> {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 20) : 8;
  const { data, error } = await getConnectorDb()
    .from("connector_connections")
    .select(CONNECTOR_SECRET_CONNECTION_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "connected")
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw new Error(`Unable to load connected tools: ${error.message}`);
  return (data || []) as ConnectorConnectionRecord[];
}
