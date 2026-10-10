import fs from "fs/promises";
import path from "path";
import { parseSkillFile } from "./parser";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface BuiltinSkillEntry {
  name: string;
  description: string;
  body: string;
  license: string;
  source_url?: string;
  version: string;
  enabled_by_default: boolean;
  metadata?: any;
  files?: Array<{ path: string; content: string; size: number }>;
}

export async function readBuiltinSkillsFromDisk(): Promise<BuiltinSkillEntry[]> {
  const builtinRoot = path.resolve(process.cwd(), "skills/builtin");
  const entries: BuiltinSkillEntry[] = [];

  try {
    const skillDirs = await fs.readdir(builtinRoot);
    for (const dirName of skillDirs) {
      const skillPath = path.join(builtinRoot, dirName, "SKILL.md");
      try {
        const content = await fs.readFile(skillPath, "utf-8");
        const parsed = parseSkillFile(content);
        const meta = parsed.metadata;
        const isNotDefault = dirName === "mcp-builder" || dirName === "algorithmic-art";

        // Read subfiles (1 level deep directories or direct files)
        const files: Array<{ path: string; content: string; size: number }> = [];
        const baseDir = path.join(builtinRoot, dirName);
        const allItems = await fs.readdir(baseDir, { withFileTypes: true });

        for (const item of allItems) {
          if (item.isDirectory()) {
            const subDir = path.join(baseDir, item.name);
            const subItems = await fs.readdir(subDir, { withFileTypes: true });
            for (const sub of subItems) {
              if (sub.isFile() && !sub.name.endsWith(".ttf") && !sub.name.endsWith(".pdf")) {
                const relPath = `${item.name}/${sub.name}`;
                const fileText = await fs.readFile(path.join(subDir, sub.name), "utf-8");
                files.push({
                  path: relPath,
                  content: fileText,
                  size: Buffer.byteLength(fileText, "utf-8"),
                });
              }
            }
          }
        }

        entries.push({
          name: meta.name,
          description: meta.description,
          body: parsed.body,
          license: meta.license || "Apache-2.0",
          source_url: meta.source_url || `https://github.com/anthropics/skills/tree/dbd4588/skills/${dirName}`,
          version: meta.version || "1.0.0",
          enabled_by_default: !isNotDefault,
          metadata: meta,
          files,
        });
      } catch (err) {
        console.warn(`Failed reading builtin skill ${dirName}:`, err);
      }
    }
  } catch (err) {
    console.warn("Could not read skills/builtin directory:", err);
  }

  return entries;
}

export async function seedBuiltinSkills(supabaseClient?: SupabaseClient | null): Promise<{ seeded: number; updated: number }> {
  const skills = await readBuiltinSkillsFromDisk();
  let seeded = 0;
  let updated = 0;

  if (!supabaseClient) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes("YOUR_")) {
      supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    }
  }

  if (!supabaseClient) {
    return { seeded: skills.length, updated: 0 };
  }

  for (const s of skills) {
    try {
      const { data: existing } = await supabaseClient
        .from("skills")
        .select("id, version, body")
        .is("owner_id", null)
        .eq("name", s.name)
        .maybeSingle();

      let skillId = existing?.id;

      if (!existing) {
        const { data: inserted, error: insErr } = await supabaseClient
          .from("skills")
          .insert({
            owner_id: null,
            name: s.name,
            description: s.description,
            body: s.body,
            license: s.license,
            source_url: s.source_url,
            version: s.version,
            enabled_by_default: s.enabled_by_default,
            metadata: s.metadata,
          })
          .select("id")
          .single();

        if (insErr) throw insErr;
        skillId = inserted.id;
        seeded++;
      } else if (existing.version !== s.version || existing.body !== s.body) {
        const { error: upErr } = await supabaseClient
          .from("skills")
          .update({
            description: s.description,
            body: s.body,
            license: s.license,
            source_url: s.source_url,
            version: s.version,
            enabled_by_default: s.enabled_by_default,
            metadata: s.metadata,
          })
          .eq("id", existing.id);

        if (upErr) throw upErr;
        updated++;
      }

      if (skillId && s.files && s.files.length > 0) {
        for (const file of s.files) {
          await supabaseClient
            .from("skill_files")
            .upsert(
              {
                skill_id: skillId,
                path: file.path,
                content: file.content,
                size: file.size,
              },
              { onConflict: "skill_id,path" }
            );
        }
      }
    } catch (err: any) {
      console.warn(`Error seeding skill ${s.name}:`, err.message || err);
    }
  }

  return { seeded, updated };
}
