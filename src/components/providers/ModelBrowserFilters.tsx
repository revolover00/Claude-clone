import { Search } from "lucide-react";
import { cn } from "../../utils/cn";

export interface Option {
  id: string;
  label: string;
  count?: number;
}

export interface ChipDef {
  id: string;
  label: string;
  active: boolean;
}

interface Props {
  providers: Option[];
  selectedProvider: string;
  onSelectProvider: (id: string) => void;
  kinds: Option[];
  selectedKind: string;
  onSelectKind: (id: string) => void;
  chips: ChipDef[];
  onToggleChip: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
}

const SORTS = [
  { id: "recommended", label: "Recommended" },
  { id: "newest", label: "Newest" },
  { id: "context", label: "Context" },
  { id: "price", label: "Price" },
];

/** Filter chips (Recommended, Reasoning, Vision, Tools, Free, Long context 200k+, Preview), search, sort and selectors. */
export function ModelBrowserFilters({
  providers,
  selectedProvider,
  onSelectProvider,
  kinds,
  selectedKind,
  onSelectKind,
  chips,
  onToggleChip,
  search,
  onSearchChange,
  sort,
  onSortChange,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, id, or family"
            aria-label="Search models"
            className="w-full rounded-lg border border-line bg-elev-2 pl-7 pr-3 py-1.5 text-[12.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent"
          />
        </div>
        <select
          role="combobox"
          aria-label="Filter by provider"
          value={selectedProvider}
          onChange={(e) => onSelectProvider(e.target.value)}
          className="rounded-lg border border-line bg-elev-2 px-2 py-1.5 text-[12.5px] text-ink focus:outline-none focus:border-accent cursor-pointer"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.count !== undefined ? ` (${p.count})` : ""}
            </option>
          ))}
        </select>
        <select
          role="combobox"
          aria-label="Filter by kind"
          value={selectedKind}
          onChange={(e) => onSelectKind(e.target.value)}
          className="rounded-lg border border-line bg-elev-2 px-2 py-1.5 text-[12.5px] text-ink focus:outline-none focus:border-accent cursor-pointer"
        >
          {kinds.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
              {k.count !== undefined ? ` (${k.count})` : ""}
            </option>
          ))}
        </select>
        <select
          role="combobox"
          aria-label="Sort models"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="rounded-lg border border-line bg-elev-2 px-2 py-1.5 text-[12.5px] text-ink focus:outline-none focus:border-accent cursor-pointer"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter chips">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onToggleChip(chip.id)}
            aria-pressed={chip.active}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer",
              chip.active
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-line bg-elev-1 text-ink-muted hover:text-ink hover:bg-elev-2"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
