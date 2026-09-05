import { useState } from "react";
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

export default function App() {
  const [nav, setNav] = useState<NavId>("new-download");
  const meta = TITLES[nav];

  return (
    <Shell active={nav} onNavigate={setNav}>
      <header className="main-header">
        <h1>{meta.title}</h1>
        <p>{meta.subtitle}</p>
      </header>
      <div className="main-body">
        {nav === "new-download" && <NewDownload />}
        {nav === "goc-import" && <GocImport />}
        {nav === "history" && <History />}
        {nav === "settings" && <Settings />}
        {nav === "diagnostics" && <Diagnostics />}
      </div>
    </Shell>
  );
}
