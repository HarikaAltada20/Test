"use client";

import CtcBanner from "./CtcBanner";
import HeroContent from "./hero-content";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { cn } from "@/lib/utils";

export function HeroSection() {
  const { isLight } = useThemeMode();

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden transition-colors duration-300",
        isLight ? "bg-[#F1F1F1] text-black" : "bg-[#000825] text-white",
      )}
    >
      <div className="relative z-20 w-full">
        <HeroContent />
        <CtcBanner />
      </div>
    </div>
  );
}
