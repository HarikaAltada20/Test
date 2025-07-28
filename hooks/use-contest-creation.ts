"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface DraftInfo {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function useContestCreation(userId: string | undefined) {
  const router = useRouter();
  const supabase = createClient();
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const checkForDrafts = async () => {
    if (!userId) return { hasDrafts: false, drafts: [] };

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("contests")
        .select("id, title, created_at, updated_at")
        .eq("advertiser_id", userId)
        .eq("moderation_status", "draft")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error checking for drafts:", error);
        return { hasDrafts: false, drafts: [] };
      }

      const draftData = data || [];
      setDrafts(draftData);
      return { hasDrafts: draftData.length > 0, drafts: draftData };
    } catch (error) {
      console.error("Error checking for drafts:", error);
      return { hasDrafts: false, drafts: [] };
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateContest = async () => {
    const { hasDrafts } = await checkForDrafts();
    
    if (!hasDrafts) {
      // No drafts - directly go to create new contest
      router.push("/dashboard/contests/create?new=true");
    } else {
      // Has drafts - return true to indicate modal should be shown
      return true;
    }
  };

  return {
    drafts,
    isLoading,
    checkForDrafts,
    handleCreateContest,
  };
} 