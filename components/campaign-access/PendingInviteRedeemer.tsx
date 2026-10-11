"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { inviteLinkApi } from "./api";
import { clearPendingInvite, readPendingInvite } from "./pending-invite";

type Props = {
  userRole: "advertiser" | "creator" | "admin" | null;
};

/** Finishes an invite started while signed out, once the creator reaches the dashboard. */
export function PendingInviteRedeemer({ userRole }: Props) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !userRole) return;
    const token = readPendingInvite();
    if (!token) return;
    ran.current = true;
    clearPendingInvite();

    if (userRole !== "creator") {
      toast({
        title: "Invite links are for creator accounts",
        description: "Sign in with a creator account to join that campaign.",
      });
      return;
    }

    (async () => {
      try {
        const res = await inviteLinkApi.redeem(token);
        if (res.result === "joined" || res.result === "already_member") {
          toast({
            title: res.result === "joined" ? "You're in!" : "You already have access",
            description: res.message,
          });
          if (res.contestId) router.push(`/dashboard/opportunities/${res.contestId}`);
          return;
        }
        toast({ title: "Couldn't join the campaign", description: res.message, variant: "destructive" });
      } catch (e: any) {
        toast({ title: "Couldn't join the campaign", description: e.message, variant: "destructive" });
      }
    })();
  }, [userRole, router]);

  return null;
}
