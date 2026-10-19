import type { ToolActivityEvent } from "../types/chat";

/** Merge the start and finish notifications for one server-side tool call. */
export function upsertToolActivityEvent(
  events: ToolActivityEvent[] = [],
  incoming: ToolActivityEvent
): ToolActivityEvent[] {
  if (incoming.id) {
    const idIndex = events.findIndex((event) => event.id === incoming.id);
    if (idIndex >= 0) return replaceAt(events, idIndex, incoming);
  }

  if (incoming.status !== "executing") {
    const pendingIndex = findPendingEvent(events, incoming);
    if (pendingIndex >= 0) {
      return replaceAt(events, pendingIndex, { ...incoming, id: events[pendingIndex].id });
    }
  }

  return [...events, incoming];
}

function findPendingEvent(events: ToolActivityEvent[], incoming: ToolActivityEvent): number {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.status === "executing" && event.name === incoming.name && event.skill === incoming.skill) {
      return index;
    }
  }
  return -1;
}

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, itemIndex) => itemIndex === index ? value : item);
}
