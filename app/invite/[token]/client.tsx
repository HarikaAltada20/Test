"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import logo from "@/public/images/gold_logo_horizontal.svg";
import { INVITE_RESULT_MESSAGES, isInviteRedeemResult } from "@/lib/campaign-access";
import { inviteLinkApi } from "@/components/campaign-access/api";
import { savePendingInvite } from "@/components/campaign-access/pending-invite";

export type InvitePreview = {
  contestId: string | null;
  title: string | null;
  brandName: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  linkStatus: string;
  alreadyMember: boolean;
};

type Props = {
  token: string;
  preview: InvitePreview;
  viewerType: "signed_out" | "creator" | "other";
};

function campaignHref(preview: InvitePreview): string {
  return preview.contestId && preview.isPublished
    ? `/dashboard/opportunities/${preview.contestId}`
    : "/dashboard/opportunities";
}

export default function InviteLandingClient({ token, preview, viewerType }: Props) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [status, setStatus] = useState(preview.linkStatus);
  const [isMember, setIsMember] = useState(preview.alreadyMember);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await inviteLinkApi.redeem(token);
      if (res.result === "joined" || res.result === "already_member") {
        toast({
          title: res.result === "joined" ? "You're in!" : "You already have access",
          description: preview.isPublished
            ? "Opening the campaign…"
            : "It'll appear in your Opportunities once it's published.",
        });
        setIsMember(true);
        router.push(campaignHref(preview));
        return;
      }
      if (res.result === "not_signed_in") {
        savePendingInvite(token);
        router.push("/auth/signin");
        return;
      }
      setStatus(res.result);
    } catch (e: any) {
      toast({ title: "Couldn't join", description: e.message, variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  const goToAuth = (path: "/auth/signin" | "/auth/signup") => {
    savePendingInvite(token);
    router.push(path);
  };

  const notFound = status === "not_found" || !preview.contestId;
  const blockedMessage =
    !notFound && status !== "active" && status !== "public" && isInviteRedeemResult(status)
      ? INVITE_RESULT_MESSAGES[status]
      : null;

  const renderAction = () => {
    if (notFound) {
      return (
        <StateMessage
          icon={<XCircle className="h-5 w-5 text-gray-400" />}
          text={INVITE_RESULT_MESSAGES.not_found}
        />
      );
    }

    if (viewerType === "creator" && isMember) {
      return (
        <>
          <StateMessage
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            text={INVITE_RESULT_MESSAGES.already_member}
          />
          <Button asChild className="w-full">
            <Link href={campaignHref(preview)}>Open campaign</Link>
          </Button>
        </>
      );
    }

    if (status === "public") {
      return (
        <>
          <StateMessage
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            text={INVITE_RESULT_MESSAGES.public}
          />
          <Button asChild className="w-full">
            <Link href={viewerType === "signed_out" ? "/auth/signin" : campaignHref(preview)}>
              Open campaign
            </Link>
          </Button>
        </>
      );
    }

    if (blockedMessage) {
      return (
        <StateMessage icon={<Clock className="h-5 w-5 text-gray-400" />} text={blockedMessage} />
      );
    }

    if (viewerType === "other") {
      return (
        <StateMessage
          icon={<Lock className="h-5 w-5 text-gray-400" />}
          text={`${INVITE_RESULT_MESSAGES.not_creator} Sign in with a creator account to join.`}
        />
      );
    }

    const notLiveNote = !preview.isPublished && (
      <p className="text-center text-xs text-gray-500">
        This campaign isn&apos;t live yet. Join now and it&apos;ll appear in your
        Opportunities once it&apos;s published.
      </p>
    );

    if (viewerType === "signed_out") {
      return (
        <>
          <Button className="w-full" onClick={() => goToAuth("/auth/signin")}>
            Sign in to join
          </Button>
          <Button variant="outline" className="w-full" onClick={() => goToAuth("/auth/signup")}>
            Create a creator account
          </Button>
          <p className="text-center text-xs text-gray-500">
            We&apos;ll add you to the campaign right after you sign in.
          </p>
          {notLiveNote}
        </>
      );
    }

    return (
      <>
        <Button className="w-full" onClick={handleJoin} disabled={joining}>
          {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Join campaign
        </Button>
        {notLiveNote}
      </>
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-50 to-white px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="block">
          <Image src={logo} alt="Game of Creators" width={180} height={60} className="mx-auto" />
        </Link>

        <div className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-xl">
          {!notFound && preview.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.thumbnailUrl}
              alt=""
              className="aspect-video w-full object-cover"
            />
          )}

          <div className="space-y-5 p-6">
            {!notFound && (
              <div className="space-y-2 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-[#4A00BE]">
                  <Lock className="h-3 w-3" /> You&apos;ve been invited to a private campaign
                </span>
                <h1 className="text-xl font-semibold text-gray-900">{preview.title}</h1>
                {preview.brandName && (
                  <p className="text-sm text-gray-500">by {preview.brandName}</p>
                )}
              </div>
            )}

            <div className="space-y-3">{renderAction()}</div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          <Link
            href={viewerType === "signed_out" ? "/" : "/dashboard"}
            className="hover:text-gray-600 hover:underline"
          >
            {viewerType === "signed_out" ? "Go to homepage" : "Go to dashboard"}
          </Link>
        </p>
      </div>
    </main>
  );
}

function StateMessage({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
