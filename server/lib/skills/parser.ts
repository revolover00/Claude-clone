import { load } from "js-yaml";

export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  source_url?: string;
  compatibility?: string;
  version?: string;
  [key: string]: any;
}

export interface ParsedSkill {
  metadata: SkillMetadata;
  body: string;
}

export function parseSkillFile(content: string): ParsedSkill {
  const match = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid format: Missing YAML frontmatter.");
  }

  const rawMetadata = load(match[1]) as any;
  const body = match[2];

  // Validation per spec
  if (!rawMetadata.name) throw new Error("Validation error: 'name' is required.");
  if (rawMetadata.name.length > 64) throw new Error("Validation error: 'name' too long.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawMetadata.name)) throw new Error("Validation error: Invalid 'name' format.");
  
  if (!rawMetadata.description) throw new Error("Validation error: 'description' is required.");
  if (rawMetadata.description.length > 1024) throw new Error("Validation error: 'description' too long.");
  
  if (rawMetadata.compatibility && rawMetadata.compatibility.length > 500) {
    throw new Error("Validation error: 'compatibility' too long.");
  }

  return {
    metadata: rawMetadata as SkillMetadata,
    body,
  };
}
