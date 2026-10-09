import { supabase } from "./supabaseClient";
import type { Conversation } from "../types/chat";


let inFlightPromise: Promise<void> | null = null;

// Deterministic UUID v5-like generator for idempotency
async function getDeterministicUuid(userId: string, oldId: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${userId}:${oldId}`);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-4${hex.substring(13, 16)}-a${hex.substring(17, 20)}-${hex.substring(20, 32)}`;
}

export async function importLocalChatsToSupabase(userId: string) {
  if (inFlightPromise) return inFlightPromise;

  const IMPORT_KEY = `claude-clone:imported:${userId}`;
  if (localStorage.getItem(IMPORT_KEY)) return;

  inFlightPromise = (async () => {
    try {
      const STORAGE_KEY_CONVS = "claude_clone_conversations_v3";
      const rawLocal = localStorage.getItem(STORAGE_KEY_CONVS);
      if (!rawLocal) {
        localStorage.setItem(IMPORT_KEY, "true");
        return;
      }

      let localConversations: Conversation[] = [];
      try {
        localConversations = JSON.parse(rawLocal);
      } catch {
        return;
      }

      if (!localConversations || localConversations.length === 0) {
        localStorage.setItem(IMPORT_KEY, "true");
        return;
      }

      for (const conv of localConversations) {
        const convUuid = await getDeterministicUuid(userId, conv.id);

        const { error: convErr } = await supabase.from("conversations").upsert(
          {
            id: convUuid,
            user_id: userId,
            project_id: null,
            title: conv.title || "Imported Chat",
            starred: conv.starred || false,
            model_id: "gemini-3.8-flash",
            created_at: new Date(conv.createdAt || Date.now()).toISOString(),
            updated_at: new Date(conv.updatedAt || Date.now()).toISOString(),
            active_leaf_id: null, // We'll set this after messages
          },
          { onConflict: "id" }
        );

        if (convErr) {
          console.error("Conversation upsert error:", convErr);
          continue;
        }

        const idMap: Record<string, string> = {};
        for (const msg of conv.messages) {
          idMap[msg.id] = await getDeterministicUuid(userId, msg.id);
        }

        let lastMessageId = null;
        for (const msg of conv.messages) {
          const mappedId = idMap[msg.id];
          const mappedParentId = msg.parentId ? idMap[msg.parentId] : null;
          lastMessageId = mappedId;

          await supabase.from("messages").upsert(
            {
              id: mappedId,
              conversation_id: convUuid,
              user_id: userId,
              parent_id: mappedParentId,
              role: msg.role,
              content: msg.content || "",
              thinking: msg.thinking || null,
              thinking_ms: msg.thinkingMs || null,
              finish_reason: msg.finishReason || null,
              model_id: "gemini-3.8-flash",
              attachments: msg.attachments || [],
              feedback: null,
              created_at: new Date(msg.createdAt || Date.now()).toISOString(),
            },
            { onConflict: "id" }
          );
        }

        if (lastMessageId) {
          await supabase.from("conversations").update({ active_leaf_id: lastMessageId }).eq("id", convUuid);
        }
      }

      localStorage.removeItem(STORAGE_KEY_CONVS);
      localStorage.removeItem("claude_clone_conversations_v2");
      localStorage.setItem(IMPORT_KEY, "true");
      console.log("Local conversations migrated successfully.");
    } catch (err) {
      console.error("Failed to run local chats migration:", err);
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}
