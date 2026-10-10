import { useState, useEffect } from "react";
import { Plus, Brain, Trash2, Loader2 } from "lucide-react";

interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export default function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/skills")
      .then(res => res.json())
      .then(setSkills)
      .finally(() => setLoading(false));
  }, []);

  const toggleSkill = async (id: string, enabled: boolean) => {
    await fetch(`/api/skills/${id}/toggle`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
    setSkills(skills.map(s => s.id === id ? { ...s, enabled } : s));
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">Skills</h3>
          <p className="text-xs text-ink-muted">Enable and manage AI agent skills</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:opacity-90">
          <Plus size={14} /> Upload Skill
        </button>
      </div>

      <div className="space-y-3">
        {skills.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-line bg-elev-1 p-4">
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
                onChange={e => toggleSkill(s.id, e.target.checked)}
                className="toggle"
              />
              <button className="text-danger hover:text-danger-fg"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
