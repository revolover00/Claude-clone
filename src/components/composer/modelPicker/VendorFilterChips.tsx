import { cn } from "../../../utils/cn";

interface Props {
  vendors: string[];
  active: string;
  onChange: (vendor: string) => void;
}

/**
 * Horizontal vendor (distributor) chips for the composer model picker:
 * All + every vendor present in the catalog — mirrors the Model Catalog
 * filter chips so the two lists stay familiar.
 */
export function VendorFilterChips({ vendors, active, onChange }: Props) {
  if (vendors.length <= 1) return null;
  return (
    <div
      role="group"
      aria-label="Filter by vendor"
      className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-line/60 px-2 pb-2 pt-1.5 scroll-slim"
    >
      {[["all", "All"], ...vendors.map((v): [string, string] => [v, v])].map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={active === id}
          onClick={() => onChange(id)}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer whitespace-nowrap",
            active === id
              ? "border-accent/50 bg-accent/15 text-accent"
              : "border-line bg-elev-1 text-ink-muted hover:text-ink hover:bg-elev-2"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
