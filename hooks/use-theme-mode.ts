"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type ThemeMode = "light" | "dark";

/**
 * Marketing site (home / creators / brands) is dark-only.
 * Light mode is disabled for these pages; dashboard keeps its own theme.
 */
export function readMarketingThemeMode(): ThemeMode {
  return "dark";
}

function applyMarketingDarkMode() {
  const root = document.documentElement;
  root.setAttribute("data-theme", "dark");
  root.style.backgroundColor = "#07031E";
  root.style.color = "rgb(248, 250, 252)";
  root.classList.add("dark");

  window.dispatchEvent(
    new CustomEvent("theme-change", {
      detail: { mode: "dark" as const, scope: "marketing" as const },
    }),
  );
}

/** @deprecated Prefer readMarketingThemeMode */
export function readThemeMode(): ThemeMode {
  return readMarketingThemeMode();
}

export function useThemeMode(_serverMode?: ThemeMode) {
  const pathname = usePathname();
  const [mode] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const isDashboardPath = () =>
      typeof window !== "undefined" &&
      (pathname?.startsWith("/dashboard") ??
        window.location.pathname.startsWith("/dashboard"));

    // Never overwrite the dashboard theme while on /dashboard.
    if (!isDashboardPath()) {
      applyMarketingDarkMode();
    }
    setMounted(true);

    const onPageShow = () => {
      if (!isDashboardPath()) {
        applyMarketingDarkMode();
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [pathname]);

  // No-ops: marketing light/dark switching is disabled.
  const setMode = useCallback((_next: ThemeMode) => {
    applyMarketingDarkMode();
  }, []);

  const toggleMode = useCallback(() => {
    applyMarketingDarkMode();
  }, []);

  return {
    mode,
    isDark: true,
    isLight: false,
    mounted,
    setMode,
    toggleMode,
  };
}
