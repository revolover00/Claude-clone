import { useState, useMemo } from "react";
import ChatListItem from "./ChatListItem";
import type { Conversation } from "../../types/chat";

interface Props {
  conversations: Conversation[];
  isLoading: boolean;
}

function groupConversations(conversations: Conversation[]) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7Days = startOfToday - 86400000 * 6;

  const groups: { label: string; items: Conversation[] }[] = [];

  const starred = conversations.filter((c) => c.starred);
  if (starred.length > 0) {
    groups.push({ label: "Starred", items: starred });
  }

  // Exclude starred items from time groups if already starred
  const nonStarred = conversations.filter((c) => !c.starred);

  const today = nonStarred.filter((c) => c.updatedAt >= startOfToday);
  if (today.length > 0) groups.push({ label: "Today", items: today });

  const yesterday = nonStarred.filter(
    (c) => c.updatedAt >= startOfYesterday && c.updatedAt < startOfToday
  );
  if (yesterday.length > 0) groups.push({ label: "Yesterday", items: yesterday });

  const prev7 = nonStarred.filter(
    (c) => c.updatedAt >= startOf7Days && c.updatedAt < startOfYesterday
  );
  if (prev7.length > 0) groups.push({ label: "Previous 7 days", items: prev7 });

  const older = nonStarred.filter((c) => c.updatedAt < startOf7Days);
  if (older.length > 0) groups.push({ label: "Older", items: older });

  return groups;
}

export default function ChatList({ conversations, isLoading }: Props) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const grouped = useMemo(
    () => groupConversations(conversations),
    [conversations]
  );

  return (
    <div className="scroll-slim min-h-0 flex-1 overflow-y-auto pb-4 font-sans">
      {isLoading ? (
        /* Loading skeleton shimmer on first load */
        <div className="animate-pulse space-y-4 px-2 py-3 select-none">
          <div className="space-y-2">
            <div className="h-2 w-12 rounded bg-elev-3/50" />
            <div className="space-y-1.5">
              <div className="h-8 w-full rounded-md bg-elev-2/40" />
              <div className="h-8 w-full rounded-md bg-elev-2/40" />
              <div className="h-8 w-full rounded-md bg-elev-2/40" />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-2 w-16 rounded bg-elev-3/50" />
            <div className="space-y-1.5">
              <div className="h-8 w-full rounded-md bg-elev-2/40" />
              <div className="h-8 w-full rounded-md bg-elev-2/40" />
            </div>
          </div>
        </div>
      ) : conversations.length === 0 ? (
        <div className="px-2 py-6 text-center text-[13px] text-ink-muted">
          No recent conversations
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.label} className="mt-2">
            <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint text-start">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((conv) => (
                <ChatListItem
                  key={conv.id}
                  conversation={conv}
                  isMenuOpen={activeMenuId === conv.id}
                  onToggleMenu={() =>
                    setActiveMenuId((prev) =>
                      prev === conv.id ? null : conv.id
                    )
                  }
                  onCloseMenu={() => setActiveMenuId(null)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
