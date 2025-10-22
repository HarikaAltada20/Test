"use client";

import { useState, useEffect } from "react";

export function useAnalyticsDarkMode() {
  // Initialize mode state with proper detection to prevent flash
  const [mode, setMode] = useState<"light" | "dark">(() => {
    // Check if we're in browser environment
    if (typeof window !== "undefined") {
      // Try to get theme from data-theme attribute first
      const themeElement = document.documentElement;
      const dataTheme = themeElement.getAttribute("data-theme") as
        | "light"
        | "dark";
      if (dataTheme) return dataTheme;

      // Fallback to data-mode attribute
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (dataMode) return dataMode;
      }

      // Check localStorage as last resort
      try {
        const savedMode = localStorage.getItem("dashboard-mode") as
          | "light"
          | "dark";
        if (savedMode) return savedMode;

        const preset = localStorage.getItem("dashboard-preset");
        if (preset === "game-of-creators" || preset === "dark-professional") {
          return "dark";
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }
    return "light";
  });

  // Read mode from data attribute with immediate updates
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode && currentMode !== mode) {
          setMode(currentMode);
        }
      }
    };

    // Check immediately
    checkMode();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    // Also listen for storage events to catch theme changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "dashboard-mode" && e.newValue) {
        const newMode = e.newValue as "light" | "dark";
        if (newMode !== mode) {
          setMode(newMode);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [mode]);

  const isDark = mode === "dark";

  return {
    mode,
    isDark,
    setMode,
  };
}
