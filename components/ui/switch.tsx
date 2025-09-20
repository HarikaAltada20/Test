"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  variant?: "default" | "theme-aware";
  theme?: "light" | "dark";
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, variant = "default", theme, ...props }, ref) => {
  // Theme-aware styling for light and dark modes
  const getThemeClasses = () => {
    if (variant !== "theme-aware") return "";

    if (theme === "dark") {
      return "data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-slate-700 data-[state=checked]:border-purple-500 data-[state=unchecked]:border-slate-600";
    } else {
      return "data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-slate-200 data-[state=checked]:border-purple-400 data-[state=unchecked]:border-slate-300";
    }
  };

  const getThumbClasses = () => {
    if (variant !== "theme-aware") return "";

    if (theme === "dark") {
      return "bg-white shadow-lg data-[state=checked]:bg-purple-100";
    } else {
      return "bg-white shadow-md data-[state=checked]:bg-purple-50";
    }
  };

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        variant === "default"
          ? "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
          : getThemeClasses(),
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
          variant === "default" ? "bg-background" : getThumbClasses()
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
