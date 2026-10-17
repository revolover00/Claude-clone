import React, { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Trash2, ShieldCheck } from "lucide-react";
import { authFetch } from "../../utils/safeFetch";

export interface CredentialRow {
  id: string;
  provider: string;
  label: string;
  key_last4: string;
  status: string;
  last_verified_at?: string;
  last_error?: string | null;
}

/** Shared with streamResponse.ts: { [providerId]: [credentialId, ...] }. */
const ORDER_KEY = "claude_clone_key_order";

function readOrderMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistOrder(providerId: string, ids: string[]): void {
  try {
    const map = readOrderMap();
    if (ids.length) map[providerId] = ids;
    else delete map[providerId];
    localStorage.setItem(ORDER_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — order simply won't persist */
  }
}

const chipStyle = (status: string): { text: string; cls: string } => {
  if (status === "active") return { text: "Active", cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" };
  if (status === "exhausted") return { text: "Quota reached", cls: "text-amber-300 border-amber-500/30 bg-amber-500/10" };
  if (status === "invalid") return { text: "Invalid", cls: "text-danger border-danger/30 bg-danger/10" };
  return { text: status || "unknown", cls: "text-ink-muted border-line bg-elev-2" };
};

interface CredentialListProps {
  providerId: string;
  credentials: CredentialRow[];
  onChange?: () => void;
}

/**
 * All API keys of one provider, top = runs first. Reordering persists to
 * localStorage; streamResponse.ts sends the order with every chat request
 * and the server rotates through it, skipping spent/invalid keys.
 */
export const CredentialList: React.FC<CredentialListProps> = ({ providerId, credentials, onChange }) => {
  const [order, setOrder] = useState<string[]>(() => {
    const ids = credentials.map((c) => c.id);
    const stored = readOrderMap()[providerId];
    if (stored?.length) {
      const kept = stored.filter((id) => ids.includes(id));
      const rest = ids.filter((id) => !kept.includes(id));
      return [...kept, ...rest];
    }
    return ids;
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setOrder((prev) => {
      const ids = credentials.map((c) => c.id);
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [credentials]);

  if (credentials.length === 0) return null;

  const move = (id: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      persistOrder(providerId, next);
      return next;
    });
  };

  const verify = async (cred: CredentialRow) => {
    setBusyId(cred.id);
    setErrorMsg(null);
    try {
      const res = await authFetch(`/api/providers/${providerId}/credentials/${cred.id}/verify`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Verification failed");
      }
      onChange?.();
    } catch {
      setErrorMsg("Network error verifying credential");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (cred: CredentialRow) => {
    setBusyId(cred.id);
    setErrorMsg(null);
    try {
      const res = await authFetch(`/api/providers/${providerId}/credentials/${cred.id}`, { method: "DELETE" });
      if (res.ok) {
        setOrder((prev) => {
          const next = prev.filter((id) => id !== cred.id);
          persistOrder(providerId, next);
          return next;
        });
        onChange?.();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to remove key");
      }
    } catch {
      setErrorMsg("Network error removing key");
    } finally {
      setBusyId(null);
    }
  };

  const ordered = order
    .map((id) => credentials.find((c) => c.id === id))
    .filter((c): c is CredentialRow => Boolean(c));

  const iconBtn =
    "rounded p-1 text-ink-muted hover:text-ink hover:bg-elev-1 disabled:opacity-30 disabled:hover:text-ink-muted transition-colors cursor-pointer disabled:cursor-default";

  return (
    <div className="space-y-1.5 pt-1" role="list" aria-label="API keys in priority order">
      <p className="text-[11px] text-ink-muted">
        Keys run <span className="font-semibold text-ink">top to bottom</span> — a spent key automatically falls through to the next.
      </p>
      {ordered.map((cred, idx) => {
        const chip = chipStyle(cred.status);
        return (
          <div
            key={cred.id}
            role="listitem"
            title={cred.last_error || undefined}
            className="flex items-center gap-2 rounded-lg border border-line bg-elev-2 px-2 py-1.5"
          >
            <span className="w-4 shrink-0 text-center text-[11px] font-semibold text-ink-muted">{idx + 1}</span>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-ink">{cred.label}</span>
              <span className="font-mono text-[11px] text-ink-muted">&bull;&bull;&bull;&bull;{cred.key_last4}</span>
            </div>
            <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10.5px] ${chip.cls}`}>{chip.text}</span>
            <div className="flex shrink-0 items-center gap-0.5">
              <button type="button" aria-label={`Move ${cred.label} up`} disabled={idx === 0} onClick={() => move(cred.id, -1)} className={iconBtn}>
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                aria-label={`Move ${cred.label} down`}
                disabled={idx === ordered.length - 1}
                onClick={() => move(cred.id, 1)}
                className={iconBtn}
              >
                <ArrowDown size={13} />
              </button>
              <button type="button" aria-label={`Verify ${cred.label}`} disabled={busyId !== null} onClick={() => verify(cred)} className={iconBtn}>
                <ShieldCheck size={13} />
              </button>
              <button type="button" aria-label={`Remove ${cred.label}`} disabled={busyId !== null} onClick={() => remove(cred)} className={iconBtn}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        );
      })}
      {errorMsg && <p className="text-[11px] text-danger font-medium break-words">{errorMsg}</p>}
    </div>
  );
};
