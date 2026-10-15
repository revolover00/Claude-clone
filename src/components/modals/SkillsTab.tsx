import { useState, useEffect, useCallback } from "react";
import { Plus, Brain, Trash2, Loader2 } from "lucide-react";
import { SettingsErrorCard } from "../shared/SettingsErrorCard";
import { safeFetchJson } from "../../utils/safeFetch";

interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export default function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await safeFetchJson<Skill[]>("/api/skills");
      if (Array.isArray(data)) {
        setSkills(data);
      } else {
        setSkills([]);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const toggleSkill = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/skills/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-ink-muted" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Skills</h3>
          <p className="text-xs text-ink-muted">Enable and manage AI agent skills</p>
        </div>
        <SettingsErrorCard onRetry={loadSkills} error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">Skills</h3>
          <p className="text-xs text-ink-muted">Enable and manage AI agent skills</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 cursor-pointer"
        >
          <Plus size={14} /> Upload Skill
        </button>
      </div>

      <div className="space-y-3">
        {skills.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-xl border border-line bg-elev-1 p-4"
          >
            <div className="flex items-center gap-3">
              <Brain className={s.enabled ? "text-accent" : "text-ink-faint"} />
              <div>
                <p className="text-[13.5px] font-medium text-ink">{s.name}</p>
                <p className="text-[11.5px] text-ink-muted">{s.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) => toggleSkill(s.id, e.target.checked)}
                className="cursor-pointer"
              />
              <button
                type="button"
                className="text-danger hover:opacity-80 cursor-pointer"
                aria-label={`Delete skill ${s.name}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {skills.length === 0 && (
          <div className="p-8 text-center text-xs text-ink-muted">
            No skills installed. Click Upload Skill to add agent skills.
          </div>
        )}
      </div>
    </div>
  );
}
