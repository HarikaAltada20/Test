"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ContestListClient } from "./ContestListClient";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Phone } from "lucide-react";
import { ContestCreationModal } from "@/components/ContestCreationModal";
import { useContestCreation } from "@/hooks/use-contest-creation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
import {
  BRAND_CONTEST_LIST_TAB_KEY,
  DEFAULT_CAMPAIGN_LIST_TAB,
  normalizeBrandContestTabFromUrl,
  readStoredCampaignListTab,
  writeStoredCampaignListTab,
  BRAND_CONTEST_TAB_IDS,
} from "@/lib/campaign-list-tab-storage";

const BOOK_A_CALL_URL = "https://calendly.com/guptavishesh2/30min";

export type CreatorRouteNotice =
  | null
  | {
      kind: "from_opportunity";
      contestId: string;
      contestTitle: string | null;
    }
  | {
      kind: "generic";
      section?: "submissions" | "earnings" | "opportunities";
    };

interface ContestsPageClientProps {
  initialContests: any[];
  userId: string;
  creatorRouteNotice?: CreatorRouteNotice;
}

export function ContestsPageClient({
  initialContests,
  userId,
  creatorRouteNotice = null,
}: ContestsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const { handleCreateContest } = useContestCreation(userId);
  const [selectedTab, setSelectedTabState] = useState(DEFAULT_CAMPAIGN_LIST_TAB);
  const [tabHydrated, setTabHydrated] = useState(false);

  useEffect(() => {
    const urlTab = normalizeBrandContestTabFromUrl(
      searchParams.get("tab") ?? "",
    );
    const stored = readStoredCampaignListTab(
      BRAND_CONTEST_LIST_TAB_KEY,
      BRAND_CONTEST_TAB_IDS,
      DEFAULT_CAMPAIGN_LIST_TAB,
    );
    setSelectedTabState(urlTab ?? stored);
    setTabHydrated(true);
  }, [searchParams]);

  useEffect(() => {
    if (!tabHydrated) return;
    writeStoredCampaignListTab(BRAND_CONTEST_LIST_TAB_KEY, selectedTab);
  }, [selectedTab, tabHydrated]);

  const setSelectedTab = useCallback((tab: string) => {
    setSelectedTabState(tab);
  }, []);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  /** Keeps the notice after router.replace strips search params (RSC refetch). */
  const [lockedCreatorRouteNotice, setLockedCreatorRouteNotice] =
    useState<CreatorRouteNotice>(null);
  const [creatorRouteModalDismissed, setCreatorRouteModalDismissed] =
    useState(false);
  const [isSigningOutForCreator, setIsSigningOutForCreator] = useState(false);

  useEffect(() => {
    if (creatorRouteNotice) {
      setLockedCreatorRouteNotice(creatorRouteNotice);
      setCreatorRouteModalDismissed(false);
      router.replace("/dashboard/contests", { scroll: false });
    }
  }, [creatorRouteNotice, router]);

  const activeCreatorRouteNotice =
    lockedCreatorRouteNotice ?? creatorRouteNotice;

  const showCreatorRouteModal =
    Boolean(activeCreatorRouteNotice) && !creatorRouteModalDismissed;

  const handleSignOutAndSignupAsCreator = async () => {
    setIsSigningOutForCreator(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "local" });
      localStorage.setItem("signupRole", "creator");
      router.push("/auth/signup");
      router.refresh();
    } catch (e) {
      console.error("Sign out before creator sign-up failed:", e);
    } finally {
      setIsSigningOutForCreator(false);
    }
  };

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

  const creatorRouteModalVariant = (() => {
    if (!activeCreatorRouteNotice) return null;
    if (activeCreatorRouteNotice.kind === "from_opportunity") {
      const { contestTitle } = activeCreatorRouteNotice;
      return {
        kind: "needs_creator_account" as const,
        headline:
          "You are currently signed up as a brand — you need to sign up as a creator to see this contest.",
        detail: contestTitle ? (
          <span className="block mt-2 text-sm text-muted-foreground">
            Contest: {contestTitle}
          </span>
        ) : null,
      };
    }
    const section = activeCreatorRouteNotice.section;
    const headline =
      section === "submissions"
        ? "You are currently signed up as a brand — creator submissions require a creator account."
        : section === "earnings"
          ? "You are currently signed up as a brand — creator earnings require a creator account."
          : section === "opportunities"
            ? "You are currently signed up as a brand — creator opportunities require a creator account."
            : "You are currently signed up as a brand — you need a creator account to use creator-only areas (opportunities, submissions, earnings).";
    return {
      kind: "needs_creator_account" as const,
      headline,
      detail: null,
    };
  })();

  return (
    <div className="space-y-6">
      <Dialog
        open={showCreatorRouteModal}
        onOpenChange={(open) => {
          if (!open) setCreatorRouteModalDismissed(true);
        }}
      >
        <DialogContent
          className={cn(
            "sm:max-w-lg rounded-2xl border p-6 shadow-lg",
            isDark
              ? "bg-[#0c0c14] border-white/10 text-white"
              : "bg-white border-gray-200 text-gray-900"
          )}
        >
          {creatorRouteModalVariant?.kind === "needs_creator_account" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold leading-snug">
                  Signed in as a brand
                </DialogTitle>
                <DialogDescription
                  asChild
                  className={cn(
                    "text-base leading-relaxed pt-1",
                    isDark ? "text-slate-300" : "text-gray-600"
                  )}
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {creatorRouteModalVariant.headline}
                    </p>
                    {creatorRouteModalVariant.detail}
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-6 flex-col gap-2 sm:flex-row sm:justify-stretch">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full sm:flex-1 order-2 sm:order-1",
                    isDark && "border-white/20 bg-transparent hover:bg-white/10"
                  )}
                  onClick={() => setCreatorRouteModalDismissed(true)}
                  disabled={isSigningOutForCreator}
                >
                  Continue as brand
                </Button>
                <Button
                  type="button"
                  className={cn(
                    "w-full sm:flex-1 order-1 sm:order-2 text-white bg-gradient-to-r from-[#DD7209] to-[#FF652D] hover:opacity-95",
                    isDark && "from-[#DD7209] to-[#FF652D]"
                  )}
                  onClick={handleSignOutAndSignupAsCreator}
                  disabled={isSigningOutForCreator}
                >
                  {isSigningOutForCreator ? <ButtonLoadingSpinner /> : null}
                  Sign out &amp; sign up as creator
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <header
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
          "pb-6 border-b",
          isDark ? "border-white/10" : "border-gray-200/90"
        )}
      >
        <div className="min-w-0 space-y-0.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
            My Campaigns
          </h1>
          <p
            className={cn(
              "text-sm leading-relaxed max-w-xl",
              isDark ? "text-slate-400" : "text-muted-foreground"
            )}
          >
            Create, review, and manage your campaigns in one place.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {!initialContests.some((c) => c.moderation_status !== "draft") && (
            <a
              href={BOOK_A_CALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors",
                isDark
                  ? "border-gray-600 text-gray-200 hover:bg-gray-800/80"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              <Phone className="h-4 w-4 shrink-0" />
              Book a Call
            </a>
          )}
          <button
            type="button"
            onClick={handleCreateContestClick}
            disabled={loading}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white shadow-sm transition-[opacity,box-shadow] hover:opacity-95",
              isDark
                ? "bg-[#5F2BB1] ring-1 ring-white/10"
                : "bg-[#4A00BE] ring-1 ring-black/5"
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <Plus className="h-4 w-4 shrink-0" />
            )}
            Create Contest
          </button>
        </div>
      </header>
      <Suspense fallback={<div>Loading contests...</div>}>
        <ContestListClient
          initialContests={initialContests}
          isAdminView={false}
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
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
