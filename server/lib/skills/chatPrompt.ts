import { getAvailableSkillsSummary } from "./db";

export async function buildSkillsPromptSection(userId?: string, forcedSkill?: unknown): Promise<string> {
  const availableSkills = await getAvailableSkillsSummary(userId);
  let section = "";
  if (availableSkills.length > 0) {
    section = `\n\n## Available skills\n` +
      availableSkills.map((skill) => `- ${skill.name}: ${skill.description}`).join("\n") +
      `\n\nWhen a user request matches an available skill, call load_skill({ name }) to retrieve its complete instructions before responding. To read referenced files within the skill, call read_skill_file({ skill, path }).`;
  }
  if (typeof forcedSkill === "string" && forcedSkill.trim()) {
    const name = forcedSkill.trim().slice(0, 100);
    section += `\n\nCRITICAL: The user has explicitly selected the skill "${name}". You MUST call load_skill({ name: "${name}" }) immediately.`;
  }
  return section;
}
