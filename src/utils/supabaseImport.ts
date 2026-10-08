import { supabase } from "./supabaseClient";
import type { Conversation } from "../types/chat";

// Helper to check if a string is a valid UUID
function isUuid(str: string) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(str);
}

// Generates a valid pseudo-random UUID
function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function importLocalChatsToSupabase(userId: string) {
  try {
    const STORAGE_KEY_CONVS = "claude_clone_conversations_v3";
    const rawLocal = localStorage.getItem(STORAGE_KEY_CONVS);
    if (!rawLocal) return;

    let localConversations: Conversation[] = [];
    try {
      localConversations = JSON.parse(rawLocal);
    } catch {
      return;
    }

    if (!localConversations || localConversations.length === 0) return;

    for (const conv of localConversations) {
      // Map old conversation ID to a valid UUID if it is not already
      const convUuid = isUuid(conv.id) ? conv.id : generateUuid();

      // Insert conversation
      const { error: convErr } = await supabase.from("conversations").insert({
        id: convUuid,
        user_id: userId,
        project_id: null, // Local storage chats don't have Supabase projects
        title: conv.title || "Imported Chat",
        starred: conv.starred || false,
        model_id: "gemini-3.8-flash",
        created_at: new Date(conv.createdAt || Date.now()).toISOString(),
        updated_at: new Date(conv.updatedAt || Date.now()).toISOString(),
      });

      if (convErr) {
        console.error("Conversation import error:", convErr);
        continue; // Skip this conversation if we cannot insert it
      }

      // Map message IDs to UUIDs to maintain parent_id relationships
      const idMap: Record<string, string> = {};
      conv.messages.forEach((msg) => {
        idMap[msg.id] = isUuid(msg.id) ? msg.id : generateUuid();
      });

      // Insert messages sequentially to respect parent references
      for (const msg of conv.messages) {
        const mappedId = idMap[msg.id];
        const mappedParentId = msg.parentId ? idMap[msg.parentId] : null;

        const { error: msgErr } = await supabase.from("messages").insert({
          id: mappedId,
          conversation_id: convUuid,
          user_id: userId,
          parent_id: mappedParentId,
          role: msg.role,
          content: msg.content || "",
          thinking: msg.thinking || "",
          thinking_ms: msg.thinkingMs || null,
          finish_reason: msg.finishReason || null,
          model_id: "gemini-3.8-flash",
          attachments: msg.attachments || [],
          feedback: null,
          created_at: new Date(msg.createdAt || Date.now()).toISOString(),
        });

        if (msgErr) {
          console.error("Message import error:", msgErr);
        }
      }
    }

    // Migration complete, clear local storage
    localStorage.removeItem(STORAGE_KEY_CONVS);
    localStorage.removeItem("claude_clone_conversations_v2");
    console.log("Local conversations migrated successfully to Supabase.");
  } catch (err) {
    console.error("Failed to run local chats migration:", err);
  }
}
