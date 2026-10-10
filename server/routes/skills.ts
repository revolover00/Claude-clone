import { Router, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { parseSkillFile } from "../lib/skills/parser";
import { readBuiltinSkillsFromDisk, seedBuiltinSkills } from "../lib/skills/seedSkills";
import { createClient } from "@supabase/supabase-js";

const router = Router();

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes("YOUR_")) {
    return createClient(supabaseUrl, supabaseServiceKey);
  }
  return null;
}

// GET /api/skills - List built-in and user skills
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const diskBuiltins = await readBuiltinSkillsFromDisk();
    const supabase = getSupabase();

    let userSkillsMap: Record<string, boolean> = {};

    if (supabase && userId) {
      const { data: userPrefs } = await supabase
        .from("user_skills")
        .select("skill_id, enabled")
        .eq("user_id", userId);

      if (userPrefs) {
        userSkillsMap = Object.fromEntries(userPrefs.map((u) => [u.skill_id, u.enabled]));
      }

      const { data: dbSkills } = await supabase
        .from("skills")
        .select("*")
        .or(`owner_id.is.null,owner_id.eq.${userId}`)
        .order("name");

      if (dbSkills && dbSkills.length > 0) {
        const enriched = dbSkills.map((s) => ({
          ...s,
          enabled: s.id in userSkillsMap ? userSkillsMap[s.id] : s.enabled_by_default,
          is_builtin: s.owner_id === null,
        }));
        res.json(enriched);
        return;
      }
    }

    // Disk fallback
    const result = diskBuiltins.map((b) => ({
      id: b.name,
      owner_id: null,
      name: b.name,
      description: b.description,
      body: b.body,
      license: b.license,
      source_url: b.source_url,
      version: b.version,
      enabled_by_default: b.enabled_by_default,
      enabled: b.enabled_by_default,
      is_builtin: true,
      files: b.files?.map((f) => ({ path: f.path, size: f.size })),
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load skills" });
  }
});

// GET /api/skills/licenses - Licenses for About > Licenses page
router.get("/licenses", async (_req, res: Response) => {
  try {
    const diskBuiltins = await readBuiltinSkillsFromDisk();
    const builtinRoot = path.resolve(process.cwd(), "skills/builtin");

    const licenses = await Promise.all(
      diskBuiltins.map(async (b) => {
        let licenseText: string;
        try {
          licenseText = await fs.readFile(path.join(builtinRoot, b.name, "LICENSE.txt"), "utf-8");
        } catch {
          licenseText = "Apache License 2.0";
        }

        return {
          name: b.name,
          license: b.license || "Apache-2.0",
          source_url: b.source_url || `https://github.com/anthropics/skills/tree/dbd4588/skills/${b.name}`,
          version: b.version,
          license_text: licenseText,
        };
      })
    );

    res.json(licenses);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load skill licenses" });
  }
});

// POST /api/skills/:id/toggle - Toggle skill on/off for user
router.post("/:id/toggle", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { enabled } = req.body;
    const supabase = getSupabase();

    if (supabase && userId) {
      await supabase.from("user_skills").upsert({
        user_id: userId,
        skill_id: id,
        enabled: Boolean(enabled),
      });
    }

    res.json({ ok: true, skill_id: id, enabled: Boolean(enabled) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to toggle skill" });
  }
});

// GET /api/skills/:id/source - View skill source and files
router.get("/:id/source", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const diskBuiltins = await readBuiltinSkillsFromDisk();
    const match = diskBuiltins.find((s) => s.name === id);

    if (match) {
      res.json({
        name: match.name,
        body: match.body,
        description: match.description,
        license: match.license,
        version: match.version,
        files: match.files || [],
      });
      return;
    }

    const supabase = getSupabase();
    if (supabase) {
      const { data: dbSkill } = await supabase.from("skills").select("*").eq("id", id).maybeSingle();
      if (dbSkill) {
        const { data: dbFiles } = await supabase.from("skill_files").select("*").eq("skill_id", id);
        res.json({
          ...dbSkill,
          files: dbFiles || [],
        });
        return;
      }
    }

    res.status(404).json({ error: "Skill not found" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to read skill source" });
  }
});

// POST /api/skills - Create custom skill
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { content, files } = req.body;

    if (!content) {
      res.status(400).json({ error: "SKILL.md content is required" });
      return;
    }

    const parsed = parseSkillFile(content);
    const supabase = getSupabase();

    if (!supabase || !userId) {
      res.status(200).json({
        id: `mock-${Date.now()}`,
        name: parsed.metadata.name,
        description: parsed.metadata.description,
        body: parsed.body,
        is_builtin: false,
        enabled: true,
      });
      return;
    }

    const { data: inserted, error } = await supabase
      .from("skills")
      .insert({
        owner_id: userId,
        name: parsed.metadata.name,
        description: parsed.metadata.description,
        body: parsed.body,
        license: parsed.metadata.license || "Custom",
        source_url: parsed.metadata.source_url || null,
        version: parsed.metadata.version || "1.0.0",
        enabled_by_default: true,
        metadata: parsed.metadata,
      })
      .select()
      .single();

    if (error) throw error;

    if (files && Array.isArray(files) && inserted?.id) {
      for (const f of files) {
        if (f.path && f.content) {
          await supabase.from("skill_files").insert({
            skill_id: inserted.id,
            path: f.path,
            content: f.content,
            size: Buffer.byteLength(f.content, "utf-8"),
          });
        }
      }
    }

    res.json(inserted);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create skill" });
  }
});

// POST /api/skills/seed - Run idempotent seeding
router.post("/seed", requireAuth, async (_req, res: Response) => {
  try {
    const result = await seedBuiltinSkills(getSupabase());
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Seeding failed" });
  }
});

export default router;
