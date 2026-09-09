import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Shell, type NavId } from "./components/Shell";
import { NewDownload } from "./components/NewDownload";
import { GocImport } from "./components/GocImport";
import { History } from "./components/History";
import { Settings } from "./components/Settings";
import { Diagnostics } from "./components/Diagnostics";

const TITLES: Record<NavId, { title: string; subtitle: string }> = {
  "new-download": {
    title: "New Download",
    subtitle: "Paste YouTube URLs or import a text list.",
  },
  "goc-import": {
    title: "GoC Import",
    subtitle: "Open a signed .gocdownload manifest and preview before downloading.",
  },
  history: {
    title: "History",
    subtitle: "Review past and in-progress download jobs.",
  },
  settings: {
    title: "Settings",
    subtitle: "Destination, quality, concurrency, and folder behavior.",
  },
  diagnostics: {
    title: "Diagnostics",
    subtitle: "Sidecar versions, logs, and checksum status.",
  },
};

function extractManifestPath(args: string[]): string | null {
  for (const arg of args) {
    const trimmed = arg.trim();
    if (!trimmed) continue;
    // Deep links first — query values can end with .gocdownload.
    if (trimmed.startsWith("goc-downloader://")) {
      try {
        const url = new URL(trimmed);
        const path =
          url.searchParams.get("path") ||
          url.searchParams.get("file") ||
          url.pathname.replace(/^\//, "");
        if (path && path.toLowerCase().endsWith(".gocdownload")) {
          return decodeURIComponent(path);
        }
        // Bare import deep link — open the import tab without a path.
        return null;
      } catch {
        return null;
      }
    }
    if (trimmed.toLowerCase().endsWith(".gocdownload")) {
      return trimmed.replace(/^"+|"+$/g, "");
    }
  }
  return null;
}

export default function App() {
  const [nav, setNav] = useState<NavId>("new-download");
  const [pendingManifestPath, setPendingManifestPath] = useState<string | null>(
    null,
  );
  const meta = TITLES[nav];

  const openImport = useCallback((path: string | null, forceTab = true) => {
    if (forceTab) setNav("goc-import");
    if (path) setPendingManifestPath(path);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string[]>("deep-link", (event) => {
      const args = event.payload || [];
      const path = extractManifestPath(args);
      // Even without a path (goc-downloader://import), switch to import tab.
      const wantsImport =
        path != null ||
        args.some((a) => a.includes("goc-downloader://") || a.toLowerCase().endsWith(".gocdownload"));
      if (wantsImport) openImport(path);
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      unlisten?.();
    };
  }, [openImport]);

  return (
    <Shell active={nav} onNavigate={setNav}>
      <header className="main-header">
        <h1>{meta.title}</h1>
        <p>{meta.subtitle}</p>
      </header>
      <div className="main-body">
        {nav === "new-download" && <NewDownload />}
        {nav === "goc-import" && (
          <GocImport
            initialPath={pendingManifestPath}
            onInitialPathConsumed={() => setPendingManifestPath(null)}
          />
        )}
        {nav === "history" && <History />}
        {nav === "settings" && <Settings />}
        {nav === "diagnostics" && <Diagnostics />}
      </div>
    </Shell>
  );
}
