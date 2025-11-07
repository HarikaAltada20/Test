"use client";

import React, { Suspense, useEffect, useState } from "react";
import { ContestListClient } from "./ContestListClient";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { ContestCreationModal } from "@/components/ContestCreationModal";
import { useContestCreation } from "@/hooks/use-contest-creation";
import { cn } from "@/lib/utils";

interface ContestsPageClientProps {
  initialContests: any[];
  userId: string;
}

export function ContestsPageClient({
  initialContests,
  userId,
}: ContestsPageClientProps) {
  const [showModal, setShowModal] = useState(false);
  const { handleCreateContest } = useContestCreation(userId);
  const [selectedTab, setSelectedTab] = useState("all");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"light" | "dark">("light");
  // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

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

    return () => observer.disconnect();
  }, []);

  const handleCreateContestClick = async () => {
    setLoading(true);
    const shouldShowModal = await handleCreateContest();
    if (shouldShowModal) {
      setShowModal(true);
      setLoading(false);
    }
  };

  const handleViewAllDrafts = () => {
    setSelectedTab("draft");
  };
  
  const isDark = mode === "dark";

  return (
    <div className="space-y-6">
      <div className="flex flex-row gap-4 md:items-center md:justify-between">
        <div className="flex-1">
          <h1 className="text-2xl md:text-2xl font-bold tracking-tight">
            My Contests
          </h1>
        </div>
        <button
          onClick={handleCreateContestClick}
          disabled={loading}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-md rounded-xl text-white font-medium",
            isDark ? "bg-[#5F2BB1]" : "bg-[#4A00BE]"
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create Contest
        </button>
      </div>
      <Suspense fallback={<div>Loading contests...</div>}>
        <ContestListClient
          initialContests={initialContests}
          isAdminView={false}
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
        />
      </Suspense>

      <ContestCreationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        userId={userId}
        onViewAllDrafts={handleViewAllDrafts}
      />
    </div>
  );
}
