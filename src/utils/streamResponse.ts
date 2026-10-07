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
