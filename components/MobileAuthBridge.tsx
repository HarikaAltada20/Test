"use client";

import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

/**
 * Client component that exposes Supabase client globally for mobile auth bridge
 * This allows the mobile app to inject sessions via JavaScript
 */
export function MobileAuthBridge() {
  useEffect(() => {
    // Expose Supabase client globally for mobile auth bridge
    if (typeof window !== "undefined") {
      const supabase = createClient();
      (window as any).supabase = supabase;
      console.log("✅ Supabase client exposed globally for mobile auth");
    }
  }, []);

  return null; // This component doesn't render anything
}

