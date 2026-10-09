import { useEffect, useState } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();
let timerInterval: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && !timerInterval) {
    timerInterval = setInterval(() => {
      listeners.forEach((fn) => fn());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };
}

export function useSharedSecondTick(enabled: boolean): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, [enabled]);
}
