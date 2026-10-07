import ClaudeSpark from "./icons/ClaudeSpark";
import Composer from "./Composer";

export default function MainChat() {
  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-shell">
      {/* top spacing to align with sidebar header */}
      <div className="h-12 shrink-0" />

      {/* scrollable stage */}
      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col px-6 pb-16">

          {/* centered stack */}
          <div className="flex flex-1 flex-col items-center justify-center pt-10">
            <h1
              className="anim-rise flex items-center gap-3 text-center font-serif text-[clamp(32px,5.2vw,52px)] font-normal leading-[1.1] tracking-[-0.01em] text-[#edeae4]"
            >
              <ClaudeSpark size={46} className="shrink-0 text-accent" />
              <span>Evening, how are things?</span>
            </h1>

            <div className="mt-9 w-full max-w-[690px]">
              <Composer />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
