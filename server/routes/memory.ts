import { Router, Response } from "express";
import { ai, apiKey } from "../lib/gemini";
import { createClient } from "@supabase/supabase-js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { Type } from "@google/genai";
import { generateEmbedding, cosineSimilarity, hasSecrets } from "../lib/memoryHelpers";

const router = Router();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const isRealSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseServiceKey && 
  !supabaseUrl.includes("YOUR_") && 
  !supabaseServiceKey.includes("YOUR_")
);

const supabaseServer = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Helpers to read/write state
async function getPreferences(userId: string) {
  if (isRealSupabaseConfigured && supabaseServer) {
    const { data } = await supabaseServer.from("user_preferences").select("*").eq("user_id", userId).single();
    return data || { memory_enabled: true, sensitive_memory: false };
  }
  return { memory_enabled: true, sensitive_memory: false };
}

async function getMemories(userId: string, activeOnly = true): Promise<any[]> {
  if (isRealSupabaseConfigured && supabaseServer) {
    let q = supabaseServer.from("memories").select("*").eq("user_id", userId);
    if (activeOnly) q = q.eq("status", "active");
    const { data } = await q;
    return data || [];
  }
  try {
    const saved = localStorage.getItem("claude_clone_mock_memories");
    const parsed = saved ? JSON.parse(saved) : [];
    if (activeOnly) return parsed.filter((m: any) => m.status === "active");
    return parsed;
  } catch {
    return [];
  }
}

async function saveMemory(userId: string, memory: any) {
  if (isRealSupabaseConfigured && supabaseServer) {
    await supabaseServer.from("memories").insert({ user_id: userId, ...memory });
  } else {
    const saved = localStorage.getItem("claude_clone_mock_memories");
    const current = saved ? JSON.parse(saved) : [];
    const item = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pinned: false,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: userId,
      ...memory
    };
    current.push(item);
    localStorage.setItem("claude_clone_mock_memories", JSON.stringify(current));
  }
}

async function updateMemory(id: string, partial: any) {
  if (isRealSupabaseConfigured && supabaseServer) {
    await supabaseServer.from("memories").update(partial).eq("id", id);
  } else {
    const saved = localStorage.getItem("claude_clone_mock_memories");
    const current = saved ? JSON.parse(saved) : [];
    const updated = current.map((item: any) => item.id === id ? { ...item, ...partial, updated_at: new Date().toISOString() } : item);
    localStorage.setItem("claude_clone_mock_memories", JSON.stringify(updated));
  }
}

// GET /api/memory
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await getMemories(req.user?.id || "", false);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/memory/:id
router.patch("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await updateMemory(id, req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/memory/:id
router.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (isRealSupabaseConfigured && supabaseServer) {
      await supabaseServer.from("memories").delete().eq("id", id);
    } else {
      const saved = localStorage.getItem("claude_clone_mock_memories");
      const current = saved ? JSON.parse(saved) : [];
      localStorage.setItem("claude_clone_mock_memories", JSON.stringify(current.filter((item: any) => item.id !== id)));
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/memory/clear
router.post("/clear", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "";
    if (isRealSupabaseConfigured && supabaseServer) {
      await supabaseServer.from("memories").delete().eq("user_id", userId);
    } else {
      localStorage.removeItem("claude_clone_mock_memories");
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Schema for Gemini model output
const extractionSchema = {
  type: Type.OBJECT,
  properties: {
    add: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: "Fact stated by user" },
          category: { type: Type.STRING, description: "Must be: profile, preferences, work, projects, people, or other" }
        },
        required: ["content", "category"]
      }
    },
    update: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "ID of the memory to update" },
          content: { type: Type.STRING, description: "Updated fact content" }
        },
        required: ["id", "content"]
      }
    },
    archive: {
      type: Type.ARRAY,
      items: { type: Type.STRING, description: "ID of the memory to archive" }
    }
  }
};

// POST /api/memory/extract
router.post("/extract", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "";
    const { lastMessages } = req.body;

    // Paused memory check
    const prefs = await getPreferences(userId);
    if (!prefs.memory_enabled) {
      res.json({ success: true, reason: "Memory system is disabled" });
      return;
    }

    if (!lastMessages || !Array.isArray(lastMessages)) {
      res.status(400).json({ error: "Missing lastMessages payload" });
      return;
    }

    if (!apiKey) {
      res.json({ success: true, reason: "API key is not configured" });
      return;
    }

    const currentMemories = await getMemories(userId, true);
    const existingListText = currentMemories.map(m => `ID: ${m.id} [${m.category}] ${m.content}`).join("\n");

    const prompt = `Analyze the recent user-assistant conversation turns to extract durable, persistent facts that the user has explicitly stated about themselves, their work, their environment, their relationships, or their tooling/language preferences.

RULES:
1. Save only facts the user STATED directly (e.g. name, role, ongoing projects, relationship to people mentioned, tone/language choices).
2. Write one short sentence each, in the third person ("User lives in Amsterdam").
3. Do NOT save passwords, API keys, card/bank numbers, IDs. If present, ignore.
4. If a fact contradicts an existing memory or is a duplicate, add it to 'update' (matching the correct ID).
5. If the user explicitly asks to "forget [something]", add that memory ID to 'archive'.
6. Do NOT infer things not explicitly stated. Ignore temporary moods or one-off questions.

Existing memories:
${existingListText || "(None saved yet)"}

Recent conversation:
${lastMessages.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n")}

Respond strictly according to the specified JSON schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: extractionSchema
      }
    });

    const output = JSON.parse(response.text || "{}");
    const memoryChanges: string[] = [];

    // Process archive
    if (Array.isArray(output.archive)) {
      for (const id of output.archive) {
        await updateMemory(id, { status: "archived" });
        memoryChanges.push(`Archived memory ${id}`);
      }
    }

    // Process update
    if (Array.isArray(output.update)) {
      for (const upd of output.update) {
        await updateMemory(upd.id, { content: upd.content });
        memoryChanges.push(`Updated memory ${upd.id}`);
      }
    }

    // Process add
    if (Array.isArray(output.add)) {
      for (const item of output.add) {
        if (!item.content || hasSecrets(item.content)) continue;

        // Sensitive filter
        const isSensitiveCategory = ["health", "finance", "religion", "politics", "sexuality"].some(cat => item.category === cat || item.content.toLowerCase().includes(cat));
        if (isSensitiveCategory && !prefs.sensitive_memory) continue;

        // Deduplicate via cosine similarity
        const embedding = await generateEmbedding(item.content);
        let matchId = null;

        for (const existing of currentMemories) {
          if (existing.embedding && Array.isArray(existing.embedding)) {
            const sim = cosineSimilarity(embedding, existing.embedding);
            if (sim > 0.85) {
              matchId = existing.id;
              break;
            }
          }
        }

        if (matchId) {
          await updateMemory(matchId, { content: item.content });
          memoryChanges.push(`Merged duplicate memory into existing ID ${matchId}`);
        } else {
          await saveMemory(userId, {
            content: item.content,
            category: item.category,
            embedding,
            status: "active"
          });
          memoryChanges.push(`Added new memory: "${item.content}"`);
        }
      }
    }

    // Cap at 500 memories per user, archiving oldest active unpinned
    const finalMemories = await getMemories(userId, true);
    if (finalMemories.length > 500) {
      const excess = finalMemories.length - 500;
      const unpinnedActive = finalMemories
        .filter(m => !m.pinned)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      for (let i = 0; i < Math.min(excess, unpinnedActive.length); i++) {
        await updateMemory(unpinnedActive[i].id, { status: "archived" });
      }
    }

    res.json({ success: true, changes: memoryChanges });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
