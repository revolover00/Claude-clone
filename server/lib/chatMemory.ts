import { generateEmbedding, cosineSimilarity } from "./memoryHelpers";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function retrieveUserMemoryPrompt(
  userId: string | undefined,
  messages: any[],
  projectId: string | null | undefined,
  supabaseServer: SupabaseClient | null,
  isRealSupabaseConfigured: boolean
): Promise<string> {
  if (!userId) return "";

  try {
    let memoryEnabled = true;
    if (isRealSupabaseConfigured && supabaseServer) {
      const { data } = await supabaseServer
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (data && data.memory_enabled === false) memoryEnabled = false;
    }

    if (!memoryEnabled) return "";

    let activeMemories: any[] = [];
    if (isRealSupabaseConfigured && supabaseServer) {
      const { data } = await supabaseServer
        .from("memories")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active");
      if (data) activeMemories = data;
    } else {
      try {
        const saved = localStorage.getItem("claude_clone_mock_memories");
        const parsed = saved ? JSON.parse(saved) : [];
        activeMemories = parsed.filter(
          (m: any) => m.status === "active" && m.user_id === userId
        );
      } catch {
        /* ignored */
      }
    }

    if (activeMemories.length === 0) return "";

    const latestUserMsg = messages[messages.length - 1]?.content || "";
    const promptEmbedding = await generateEmbedding(latestUserMsg);

    const pinnedMemories = activeMemories.filter((m) => m.pinned);
    const unpinnedMemories = activeMemories.filter((m) => !m.pinned);

    const scored = unpinnedMemories.map((m) => {
      let sim = 0;
      if (m.embedding && Array.isArray(m.embedding)) {
        sim = cosineSimilarity(promptEmbedding, m.embedding);
      }
      return { ...m, sim };
    });
    scored.sort((a, b) => b.sim - a.sim);
    const top8Unpinned = scored.slice(0, 8);

    let projectMemories: any[] = [];
    if (projectId) {
      projectMemories = activeMemories.filter((m) => m.project_id === projectId);
    }

    const combinedList = [...pinnedMemories, ...top8Unpinned, ...projectMemories];
    const uniqueRetrieved = Array.from(
      new Map(combinedList.map((m) => [m.id, m])).values()
    );

    if (uniqueRetrieved.length === 0) return "";

    return (
      `\n--- USER MEMORIES BASE ---\n` +
      `You recall the following facts about the user across chats:\n` +
      uniqueRetrieved
        .map((m) => `- [Category: ${m.category}] ${m.content}`)
        .join("\n") +
      `\nCRITICAL USE INSTRUCTIONS:\n` +
      `- Adapt and reference these facts only when they make your answer more helpful and personalized.\n` +
      `- NEVER state "I remember" or list these facts explicitly in conversation.\n` +
      `- If the user tells you to ignore or contradict this context, prioritize their direct prompt instructions.\n` +
      `---------------------------\n`
    );
  } catch (memErr) {
    console.warn("Memory retrieval failed, skipping:", memErr);
    return "";
  }
}
