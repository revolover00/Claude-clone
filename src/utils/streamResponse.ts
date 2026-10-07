import { isArabicText } from "./text";

interface StreamCallbacks {
  onThinkingStart?: () => void;
  onThinkingUpdate?: (thought: string) => void;
  onToken?: (token: string, fullText: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (err: unknown) => void;
}

export function generateContextualResponse(prompt: string): {
  thoughts: string;
  response: string;
} {
  const isArabic = isArabicText(prompt);
  const lower = prompt.toLowerCase();

  if (isArabic) {
    if (lower.includes("كود") || lower.includes("برمج") || lower.includes("react") || lower.includes("js")) {
      return {
        thoughts: "تحليل طلب المستخدم المتعلق بالبرمجة.\nتحديد أفضل مثال تطبيقي نظيف وواضح.\nصياغة الشرح بلغة عربية سلسلة مع تضمين الكود المناسب.",
        response: `أهلاً بك! إليك نموذج تطبيقي متكامل ومبسّط يلبي طلبك:

### مثال عملي (React + TypeScript)

\`\`\`typescript
import React, { useState } from 'react';

interface CounterProps {
  initialCount?: number;
  label?: string;
}

export const ModernCounter: React.FC<CounterProps> = ({ 
  initialCount = 0, 
  label = "العداد" 
}) => {
  const [count, setCount] = useState<number>(initialCount);

  return (
    <div className="p-4 rounded-xl border border-line bg-elev-1">
      <h3 className="text-lg font-medium text-ink">{label}: {count}</h3>
      <div className="mt-3 flex gap-2">
        <button 
          onClick={() => setCount(c => c + 1)}
          className="px-3 py-1.5 rounded-lg bg-accent text-white font-medium hover:opacity-90"
        >
          زيادة
        </button>
        <button 
          onClick={() => setCount(0)}
          className="px-3 py-1.5 rounded-lg bg-elev-2 text-ink-muted hover:text-ink"
        >
          إعادة ضبط
        </button>
      </div>
    </div>
  );
};
\`\`\`

#### مميزات هذا النموذج:
1. **الوضوح والبساطة**: استخدام خطاطيف React الحديثة (\`useState\`).
2. **الأنماط الصارمة**: دعم كامل للـ TypeScript لتفادي الأخطاء البرمجية.
3. **التصميم المتناسق**: متوافق مع نظام التصميم الحالي.

إذا كنت ترغب في تخصيص أي تفاصيل إضافية، أخبرني بذلك!`,
      };
    }

    return {
      thoughts: "معالجة استفسار المستخدم باللغة العربية.\nصياغة إجابة شاملة ومهنية تعكس أسلوب كلود التحليلي والمفيد.",
      response: `مرحباً بك! يسعدني جداً تقديم المساعدة والإجابة على أي استفسارات لديك.

بصفتي كلود، يمكنني مساعدتك في مجموعة واسعة من المهام، بما في ذلك:
- **البرمجة وهندسة البرمجيات**: كتابة الأكواد، تصحيح الأخطاء، وهندسة النظم.
- **الكتابة والتحرير**: صياغة المقالات، الرسائل، وتلخيص المستندات المعقدة.
- **التحليل وحل المشكلات**: التفكير النقدي، مراجعة البيانات، وتقديم استشارات منهجية.

كيف ترغب أن نبدأ اليوم؟`,
    };
  }

  // SVG or visual creation
  if (lower.includes("svg") || lower.includes("draw") || lower.includes("icon") || lower.includes("illustration")) {
    return {
      thoughts: "1. Understanding visual design request.\n2. Constructing scalable SVG vector paths with gradient aesthetics.\n3. Packaging as an interactive artifact.",
      response: `I've created a vector graphic illustration for you:

\`\`\`svg
<!-- Title: Claude Stellar Emblem -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2a2724"/>
      <stop offset="100%" stop-color="#191816"/>
    </linearGradient>
    <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e88c6f"/>
      <stop offset="100%" stop-color="#d97757"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="400" height="400" rx="32" fill="url(#bgGrad)"/>
  <circle cx="200" cy="200" r="130" stroke="#3b3733" stroke-width="2" fill="none"/>
  <circle cx="200" cy="200" r="90" stroke="#48433d" stroke-dasharray="6 6" stroke-width="1.5" fill="none"/>

  <!-- Centered Claude Star -->
  <g transform="translate(200, 200)" filter="url(#glow)">
    <path d="M 0,-65 C 6,-24 24,-6 65,0 C 24,6 6,24 0,65 C -6,24 -24,6 -65,0 C -24,-6 -6,-24 0,-65 Z" fill="url(#sparkGrad)"/>
    <circle cx="0" cy="0" r="10" fill="#fff" opacity="0.9"/>
  </g>

  <text x="200" y="350" font-family="system-ui, sans-serif" font-size="13" font-weight="500" fill="#8d897f" text-anchor="middle" letter-spacing="2">
    CLAUDE ARTIFACT
  </text>
</svg>
\`\`\`

You can preview the rendered vector graphic directly in the Artifact panel by clicking on the card above.`,
    };
  }

  // HTML / Web Prototype creation
  if (lower.includes("html") || lower.includes("game") || lower.includes("landing") || lower.includes("dashboard") || lower.includes("build") || lower.includes("create")) {
    return {
      thoughts: "1. Analyzing full-stack / web prototype requirements.\n2. Scaffolding complete responsive HTML5 artifact with Tailwind CSS.\n3. Embedding self-contained interactive JavaScript logic.",
      response: `I've built a prototype according to your requirements:

\`\`\`html
<!-- Title: Interactive Analytics Dashboard -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Analytics Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#1b1917] text-[#e7e5e4] p-6 font-sans">
  <div class="max-w-2xl mx-auto space-y-6">
    <header class="flex items-center justify-between pb-4 border-b border-[#2e2a27]">
      <div>
        <h1 class="text-xl font-bold text-white">Application Metrics</h1>
        <p class="text-xs text-[#a8a29e]">Real-time performance telemetry</p>
      </div>
      <span class="px-2.5 py-1 text-xs rounded-full bg-[#d97757]/20 text-[#d97757] font-medium">Live</span>
    </header>

    <div class="grid grid-cols-3 gap-3">
      <div class="p-4 rounded-xl bg-[#262320] border border-[#38332f]">
        <div class="text-xs text-[#a8a29e]">Active Users</div>
        <div class="text-2xl font-bold text-white mt-1">12,845</div>
        <div class="text-xs text-emerald-400 mt-1">↑ 14.2%</div>
      </div>
      <div class="p-4 rounded-xl bg-[#262320] border border-[#38332f]">
        <div class="text-xs text-[#a8a29e]">Avg Latency</div>
        <div class="text-2xl font-bold text-white mt-1">42ms</div>
        <div class="text-xs text-emerald-400 mt-1">↓ 6.1%</div>
      </div>
      <div class="p-4 rounded-xl bg-[#262320] border border-[#38332f]">
        <div class="text-xs text-[#a8a29e]">Throughput</div>
        <div class="text-2xl font-bold text-white mt-1">98.9%</div>
        <div class="text-xs text-[#a8a29e] mt-1">Optimal</div>
      </div>
    </div>

    <div class="p-4 rounded-xl bg-[#262320] border border-[#38332f]">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold">Interactive Counter</h3>
        <button id="btn" class="px-3 py-1 bg-[#d97757] text-white rounded-lg text-xs font-medium hover:opacity-90">Simulate Request</button>
      </div>
      <div class="h-2 bg-[#38332f] rounded-full overflow-hidden">
        <div id="bar" class="h-full bg-[#d97757] w-1/3 transition-all duration-300"></div>
      </div>
    </div>
  </div>

  <script>
    let p = 33;
    document.getElementById('btn').onclick = () => {
      p = (p + 18) % 100;
      document.getElementById('bar').style.width = p + '%';
    };
  </script>
</body>
</html>
\`\`\`

You can preview the live interactive prototype by opening the artifact panel.`,
    };
  }

  // English queries
  if (lower.includes("code") || lower.includes("debug") || lower.includes("react") || lower.includes("python") || lower.includes("function") || lower.includes("component")) {
    return {
      thoughts: "1. Parsing programming request.\n2. Selecting modern architectural pattern.\n3. Formulating clean implementation with type safety.\n4. Synthesizing best practices and usage instructions.",
      response: `Here is a clean, modern implementation designed for maintainability and readability:

### Implementation

\`\`\`typescript
import React, { useState, useEffect, useCallback } from 'react';

interface DataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsyncResource<T>(fetcher: () => Promise<T>): DataState<T> {
  const [state, setState] = useState<DataState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await fetcher();
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: err as Error });
    }
  }, [fetcher]);

  useEffect(() => {
    execute();
  }, [execute]);

  return state;
}
\`\`\`

#### Key Highlights:
- **Type Safety**: Strictly typed with TypeScript generics (\`<T>\`).
- **Resilient Lifecycle**: Wrapped in \`useCallback\` and cleanly managed \`useEffect\`.
- **Zero External Overhead**: Native hooks without third-party dependencies.

Feel free to let me know if you need any adjustments or unit test cases!`,
    };
  }

  if (lower.includes("explain") || lower.includes("learn") || lower.includes("why") || lower.includes("how")) {
    return {
      thoughts: "1. Deconstructing the core concept into fundamental principles.\n2. Organizing into clear hierarchical steps.\n3. Providing concrete real-world analogies.\n4. Verifying clarity and conciseness.",
      response: `To understand this deeply, it helps to break it down into core principles:

### Core Concepts

1. **Foundational Architecture**
   At its root, the system decouples state from presentation. This guarantees predictable data flows and avoids race conditions.

2. **Performance Considerations**
   - **Lazy Evaluation**: Resources are allocated strictly when demanded.
   - **Memoization**: Expensive computations are cached across render passes.
   - **Reduced Overhead**: Minimizes memory pressure during high-throughput tasks.

### Comparison Table

| Attribute | Traditional Approach | Modern Solution |
| :--- | :--- | :--- |
| **Complexity** | High coupling, imperative | Declarative, modular |
| **Latency** | Linear scale overhead | Constant-time dispatch |
| **Maintainability** | Fragile state drift | Single source of truth |

> *"Simplicity is prerequisite for reliability."* — Edsger W. Dijkstra

Let me know which area you'd like to explore deeper!`,
    };
  }

  // General Claude-like response
  return {
    thoughts: "1. Assessing user prompt context and tone.\n2. Framing direct, insightful response.\n3. Structuring clear action points and follow-ups.",
    response: `I'm here to help. Here is a clear perspective on your query:

### Overview & Key Observations

- **Clarity & Focus**: Keeping abstractions lightweight allows rapid iteration without technical debt.
- **Structured Execution**: Separating concerns makes testing and verification straightforward.
- **Adaptive Refinement**: Incremental progress lets you validate assumptions early.

Would you like to dive deeper into specific details, explore practical examples, or brainstorm next steps?`,
  };
}

export function streamSimulatedResponse(
  prompt: string,
  signal: AbortSignal,
  callbacks: StreamCallbacks
): () => void {
  const { thoughts, response } = generateContextualResponse(prompt);
  let isCancelled = false;

  const onAbort = () => {
    isCancelled = true;
  };
  signal.addEventListener("abort", onAbort);

  (async () => {
    callbacks.onThinkingStart?.();

    // Thinking phase: 1.4s
    await new Promise((resolve) => setTimeout(resolve, 1400));
    if (isCancelled) return;

    callbacks.onThinkingUpdate?.(thoughts);

    // Short pause before stream starts
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (isCancelled) return;

    // Split into realistic words/tokens
    const tokens = response.split(/(\s+)/);
    let accumulated = "";

    for (let i = 0; i < tokens.length; i++) {
      if (isCancelled) break;
      const token = tokens[i];
      accumulated += token;
      callbacks.onToken?.(token, accumulated);

      // Natural streaming cadence (faster on whitespace, slight pause on punctuation)
      const isPunctuation = /[.!?\n]/.test(token);
      const delay = isPunctuation ? 45 : token.trim() ? 22 : 12;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (!isCancelled) {
      callbacks.onDone?.(accumulated);
    }
  })();

  return () => {
    isCancelled = true;
    signal.removeEventListener("abort", onAbort);
  };
}
