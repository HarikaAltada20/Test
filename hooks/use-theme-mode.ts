"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const PRESET_TO_MODE: Record<string, ThemeMode> = {
  "game-of-creators": "dark",
  "clean-professional": "light",
  "dark-professional": "dark",
};

function readThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "light";

  try {
    const preset = window.localStorage.getItem("dashboard-preset");
    if (preset && PRESET_TO_MODE[preset]) {
      return PRESET_TO_MODE[preset];
    }

    const saved = window.localStorage.getItem("dashboard-mode");
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // ignore storage errors
  }

  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;

  return "light";
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  root.setAttribute("data-theme", mode);

  if (mode === "dark") {
    root.style.backgroundColor = "#07031E";
    root.style.color = "rgb(248, 250, 252)";
    root.classList.add("dark");
  } else {
    root.style.backgroundColor = "#F1F1F1";
    root.style.color = "#111827";
    root.classList.remove("dark");
  }

  try {
    window.localStorage.setItem("dashboard-mode", mode);
    window.localStorage.removeItem("dashboard-preset");
    document.cookie = `dashboard-mode=${mode}; path=/; max-age=31536000`;
    document.cookie = "dashboard-preset=; path=/; max-age=0";
  } catch {
    // ignore storage errors
  }

  window.dispatchEvent(
    new CustomEvent("theme-change", { detail: { mode } }),
  );
}

export function useThemeMode() {
  const [mode, setModeState] = useState<ThemeMode>(() => readThemeMode());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setModeState(readThemeMode());
    setMounted(true);

    const syncFromDom = () => {
      const attr = document.documentElement.getAttribute("data-theme");
      if (attr === "dark" || attr === "light") {
        setModeState(attr);
      }
    };

    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: ThemeMode }>).detail;
      if (detail?.mode === "dark" || detail?.mode === "light") {
        setModeState(detail.mode);
      } else {
        syncFromDom();
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === "dashboard-mode" || event.key === "dashboard-preset") {
        setModeState(readThemeMode());
      }
    };

    const observer = new MutationObserver(syncFromDom);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    window.addEventListener("theme-change", onThemeChange);
    window.addEventListener("storage", onStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener("theme-change", onThemeChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    applyThemeMode(next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const next: ThemeMode = current === "light" ? "dark" : "light";
      applyThemeMode(next);
      return next;
    });
  }, []);

  return {
    mode,
    isDark: mode === "dark",
    isLight: mode === "light",
    mounted,
    setMode,
    toggleMode,
  };
}
