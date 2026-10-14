export type ThinkingLevel = "low" | "medium" | "high";

export interface ThinkingPlan {
  level: ThinkingLevel;
  reason: string;
}

export interface ThinkingConfigResult {
  includeThoughts: boolean;
  thinkingLevel?: string;
  thinkingBudget?: number;
}

export type RegisteredProviderId = "gemini" | "groq" | "openrouter";
export const REGISTERED_PROVIDERS: readonly RegisteredProviderId[] = ["gemini", "groq", "openrouter"] as const;

export interface ThinkingAttachment {
  name?: string;
  type?: string;
  url?: string;
  isImage?: boolean;
}

export interface ThinkingRouterInput {
  content?: string;
  attachmentsCount?: number;
  attachments?: ThinkingAttachment[];
}

export interface ThinkingRouterOptions {
  extendedThinking?: boolean;
  effort?: string;
  modelId?: string;
  supportsReasoning?: boolean;
}

// Patterns indicating complex reasoning, coding, math, or planning
const COMPLEX_PATTERNS_EN = [
  /\bdesign\b/i,
  /\barchitect\b/i,
  /\boptimize\b/i,
  /\bprove\b/i,
  /\bdebug\b/i,
  /\bcode\b/i,
  /\berror\b/i,
  /\bbug\b/i,
  /\bfunction\b/i,
  /\bclass\b/i,
  /\bimplement\b/i,
  /\brefactor\b/i,
  /\btypescript\b/i,
  /\bpython\b/i,
  /\bjavascript\b/i,
  /\bsql\b/i,
  /\bhtml\b/i,
  /\bcss\b/i,
  /\bapi\b/i,
  /\bendpoint\b/i,
  /\bregex\b/i,
  /\balgorithm\b/i,
  /\bpuzzle\b/i,
  /\bmath\b/i,
  /\blogic\b/i,
  /\bcalculate\b/i,
  /\bintegral\b/i,
  /\bequation\b/i,
  /\bprobability\b/i,
  /\bproof\b/i,
  /\bcompare\b/i,
  /\btradeoffs?\b/i,
  /\btrade-offs?\b/i,
  /\bplans?\b/i,
  /\bplanning\b/i,
  /\bstep\s+by\s+step\b/i,
  /\bpros\s+and\s+cons\b/i,
  /\bversus\b/i,
  /\bvs\b/i,
];

const COMPLEX_WORDS_AR = [
  "ضع خطة",
  "صمم",
  "قارن",
  "اشرح خطوة بخطوة",
  "حل المسألة",
  "برمج",
  "كود",
  "خطأ",
  "تصحيح",
  "دالة",
  "تابع",
  "احسب",
  "معادلة",
  "لغز",
  "منطق",
  "احتمال",
  "برهن",
  "اثبت",
  "خطة",
  "هندسة",
  "تحسين",
  "مقارنة",
];

const TRIVIAL_GREETINGS_EN = [
  /\bhi\b/i,
  /\bhello\b/i,
  /\bhey\b/i,
  /\bthanks\b/i,
  /\bthank\s+you\b/i,
  /\bthx\b/i,
  /\bgood\s+morning\b/i,
  /\bgood\s+afternoon\b/i,
  /\bgood\s+evening\b/i,
  /\bbye\b/i,
  /\bgoodbye\b/i,
  /\bok\b/i,
  /\bokay\b/i,
  /\bcool\b/i,
  /\bgreat\b/i,
  /\bnice\b/i,
  /\bhowdy\b/i,
  /\bwelcome\b/i,
  /\byo\b/i,
];

const TRIVIAL_GREETINGS_AR = [
  "مرحبا",
  "أهلا",
  "اهلا",
  "السلام عليكم",
  "شكرا",
  "شكراً",
  "يعطيك العافية",
  "تمام",
  "حسنا",
  "حسناً",
  "مع السلامة",
  "صباح الخير",
  "مساء الخير",
  "تسلم",
];

export function hasComplexIndicators(text: string): boolean {
  for (const pattern of COMPLEX_PATTERNS_EN) {
    if (pattern.test(text)) return true;
  }
  for (const word of COMPLEX_WORDS_AR) {
    if (text.includes(word)) return true;
  }
  return false;
}

export function isTrivialMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 12) return false;

  // Cannot contain complex indicators
  if (hasComplexIndicators(trimmed)) return false;

  const matchedEn = TRIVIAL_GREETINGS_EN.some((p) => p.test(trimmed));
  const matchedAr = TRIVIAL_GREETINGS_AR.some((g) => trimmed.includes(g));

  return matchedEn || matchedAr;
}

export function routeThinking(
  latestMessage: ThinkingRouterInput = {},
  options: ThinkingRouterOptions = {}
): ThinkingPlan {
  const { extendedThinking, effort } = options;

  // When toggle is ON: always use user's effort (default High), never "minimal"
  if (extendedThinking) {
    let level: ThinkingLevel = "high";
    if (effort === "Low") level = "low";
    else if (effort === "Medium") level = "medium";
    else if (effort === "High") level = "high";

    return {
      level,
      reason: `Extended thinking requested (${effort || "High"})`,
    };
  }

  // When toggle is OFF: Adaptive thinking
  const content = latestMessage.content || "";
  const attachmentsCount = latestMessage.attachmentsCount ?? (latestMessage.attachments?.length || 0);

  if (attachmentsCount > 0) {
    return {
      level: "high",
      reason: "Message contains file or image attachments",
    };
  }

  if (content.length > 1500) {
    return {
      level: "high",
      reason: "Long input over 1500 characters",
    };
  }

  if (hasComplexIndicators(content)) {
    return {
      level: "high",
      reason: "Complex reasoning, coding, math, or multi-step planning detected",
    };
  }

  if (isTrivialMessage(content)) {
    return {
      level: "low",
      reason: "Trivial greeting or acknowledgement under 12 words",
    };
  }

  return {
    level: "medium",
    reason: "Standard writing task or conversational query",
  };
}

export function buildThinkingConfigFromLevel(
  provider: RegisteredProviderId,
  modelId: string,
  level: ThinkingLevel
): ThinkingConfigResult {
  if (provider === "gemini") {
    const isGemini3 = /gemini-3/i.test(modelId);
    return isGemini3
      ? { includeThoughts: true, thinkingLevel: level }
      : { includeThoughts: true, thinkingBudget: level === "high" ? 16384 : level === "medium" ? 4096 : 1024 };
  }

  if (provider === "groq") {
    return { includeThoughts: true, thinkingLevel: level };
  }

  if (provider === "openrouter") {
    return { includeThoughts: true, thinkingLevel: level };
  }

  throw new Error(`Unknown provider: "${provider}". Expected one of: ${REGISTERED_PROVIDERS.join(", ")}`);
}

export function modelSupportsReasoning(
  provider: RegisteredProviderId,
  modelId: string,
  catalogEntry?: { supportsReasoning?: boolean; supports_thinking?: boolean }
): boolean {
  if (catalogEntry?.supportsReasoning !== undefined) return Boolean(catalogEntry.supportsReasoning);
  if (catalogEntry?.supports_thinking !== undefined) return Boolean(catalogEntry.supports_thinking);
  if (provider === "gemini") return /gemini-3/i.test(modelId);
  if (provider === "groq") return /deepseek-r1|qwen-2\.5-32b|gpt-oss/i.test(modelId);
  return false;
}

export function getThinkingPlanAndConfig(
  provider: RegisteredProviderId,
  modelId: string,
  latestMessage: ThinkingRouterInput = {},
  options: ThinkingRouterOptions = {},
  catalogEntry?: { supportsReasoning?: boolean; supports_thinking?: boolean }
): { plan: ThinkingPlan | null; config: ThinkingConfigResult | null } {
  if (!REGISTERED_PROVIDERS.includes(provider)) {
    throw new Error(`Unknown provider: "${provider}". Expected one of: ${REGISTERED_PROVIDERS.join(", ")}`);
  }

  const effectiveCatalog = options.supportsReasoning !== undefined
    ? { supportsReasoning: options.supportsReasoning }
    : catalogEntry;

  if (!modelSupportsReasoning(provider, modelId, effectiveCatalog)) {
    return { plan: null, config: null };
  }

  const plan = routeThinking(latestMessage, { ...options, modelId });
  const config = buildThinkingConfigFromLevel(provider, modelId, plan.level);

  if (process.env.NODE_ENV !== "production") {
    console.log(`[ThinkingRouter] Provider: ${provider}, Model: ${modelId}, Level: ${plan.level}, Reason: ${plan.reason}`);
  }

  return { plan, config };
}
