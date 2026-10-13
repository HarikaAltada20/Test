"use client";

import { useEffect, useState } from "react";

function readIsDark(): boolean {
  if (typeof document === "undefined") return false;
  const mode = document.querySelector("[data-mode]")?.getAttribute("data-mode");
  if (mode === "dark" || mode === "light") return mode === "dark";
  return document.documentElement.classList.contains("dark");
}

/**
 * Whether the dashboard is in dark mode. The dashboard sets `data-mode` on its
 * layout instead of a `.dark` class, so Tailwind `dark:` classes only work under
 * an element that adds `dark` from this value.
 */
export function useDashboardDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const update = () => setIsDark(readIsDark());
    update();
    const observer = new MutationObserver(update);
    const target = document.querySelector("[data-mode]");
    if (target) observer.observe(target, { attributes: true, attributeFilter: ["data-mode"] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
