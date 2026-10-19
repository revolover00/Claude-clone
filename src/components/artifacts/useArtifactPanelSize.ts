import { useCallback, useEffect, useRef, useState } from "react";

export function getArtifactPanelHeight(isExpanded: boolean, isLargeScreen: boolean): string {
  if (isLargeScreen) return isExpanded ? "100%" : "48dvh";
  return isExpanded ? "calc(100dvh - 3rem)" : "44dvh";
}

export function useArtifactPanelSize(isOpen: boolean, artifactId?: string) {
  const [isExpanded, setIsExpanded] = useState(false);
  const previous = useRef({ isOpen: false, artifactId });

  useEffect(() => {
    if (isOpen && (!previous.current.isOpen || previous.current.artifactId !== artifactId)) {
      setIsExpanded(false);
    }
    previous.current = { isOpen, artifactId };
  }, [artifactId, isOpen]);

  const toggleExpanded = useCallback(() => setIsExpanded((expanded) => !expanded), []);
  return { isExpanded, toggleExpanded };
}
