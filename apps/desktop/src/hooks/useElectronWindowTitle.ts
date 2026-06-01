import { useMatches } from "@tanstack/react-router";
import { useEffect } from "react";

export function useElectronWindowTitle() {
  const matches = useMatches();

  useEffect(() => {
    const currentMatch = [...matches]
      .reverse()
      .find((match) =>
        match.meta?.some(
          (meta) => meta && "title" in meta && typeof meta.title === "string",
        ),
      );

    const titleMeta = currentMatch?.meta?.find(
      (meta) => meta && "title" in meta && typeof meta.title === "string",
    );

    const routeTitle = titleMeta?.title;

    const finalTitle = routeTitle ? `${routeTitle} · Nexus` : "Nexus";

    document.title = finalTitle;

    if (window.electron.app) {
      window.electron.app.updateTitle(finalTitle);
    }
  }, [matches]);
}
