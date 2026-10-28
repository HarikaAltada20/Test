"use client";

import { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DiscordOnboardingModal } from "@/components/DiscordOnboardingModal";
import CreatorGettingStarted from "./CreatorGettingStarted";
import BrandGettingStarted from "./BrandGettingStarted";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

interface GettingStartedClientProps {
  user: User;
}

export default function GettingStartedClient({
  user,
}: GettingStartedClientProps) {
  const [userType, setUserType] = useState<string | null>(null);
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const supabase = createClient();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const searchParams = useSearchParams();

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

  useEffect(() => {
    const fetchUserType = async () => {
      const { data: profile } = await supabase
        .from("advertiser_profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserType("advertiser");
      } else {
        setUserType("creator");
      }
    };

    fetchUserType();
  }, [user.id, supabase]);

  useEffect(() => {
    if (!userType) return;
    const flag = searchParams.get("welcome");
    const isCreator = userType === "creator";
    try {
      const alreadyShown =
        typeof window !== "undefined" &&
        localStorage.getItem("discordOnboardingShown") === "1";
      if (isCreator && (flag === "1" || flag === "true") && !alreadyShown) {
        setShowDiscordModal(true);
        const url = new URL(window.location.href);
        url.searchParams.delete("welcome");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {}
  }, [userType, searchParams]);

  if (!userType) {
    return (
      <div className="flex h-[76vh] items-center justify-center">
        <PageLoadingSpinner mode="light" />
      </div>
    );
  }

  const isDark = mode === "dark";

  if (userType === "creator") {
    return (
      <>
        <CreatorGettingStarted isDark={isDark} />
        <DiscordOnboardingModal
          isOpen={showDiscordModal}
          onClose={() => setShowDiscordModal(false)}
        />
      </>
    );
  }

  return <BrandGettingStarted isDark={isDark} />;
}
