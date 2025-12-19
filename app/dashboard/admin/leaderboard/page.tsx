"use client";

import { useState, useEffect } from "react";
import LeaderboardClient from "@/app/dashboard/leaderboard/LeaderboardClient";
import { Award } from "lucide-react";

export default function AdminLeaderboardPage() {
  // Get theme from parent layout instead of managing independent state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      // Check data-mode attribute from parent layout
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode");
        return dataMode === "dark";
      }
      // Fallback to data-theme attribute
      const themeElement = document.documentElement;
      const dataTheme = themeElement.getAttribute("data-theme");
      return dataTheme === "dark";
    }
    return false; // Default to light mode
  });

  // Watch for theme changes from parent layout
  useEffect(() => {
    const checkTheme = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode");
        const newIsDark = currentMode === "dark";
        if (newIsDark !== isDark) {
          setIsDark(newIsDark);
        }
      }
    };

    checkTheme();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkTheme);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, [isDark]);

  return (
    <div className="px-2 sm:px-4">
      <div className="">
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl">
          <div className="relative">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2">
                <Award
                  className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                />
              </div>
              <h1
                className={`text-2xl sm:text-3xl md:text-4xl font-bold ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Admin Leaderboard
              </h1>
            </div>
          </div>
        </div>
      </div>

      <LeaderboardClient showAdminSummary hideHeroHeader />
    </div>
  );
}
