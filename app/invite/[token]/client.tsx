"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarX,
  CheckCircle2,
  Clock,
  Crown,
  Link2Off,
  Loader2,
  Lock,
  LogIn,
  PartyPopper,
  Sparkles,
  Trophy,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import logo from "@/public/images/gold_logo_horizontal.svg";
import {
  INVITE_RESULT_MESSAGES,
  creatorInitials,
  isInviteRedeemResult,
  type InviteRedeemResult,
} from "@/lib/campaign-access";
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
  /** Total prize pool; null when unknown or zero. */
  prizeCents?: number | null;
  platforms?: string[];
  /** "Best platform paid" campaign (derived on the server). */
  bestPlatformOnly?: boolean;
  startDate?: string | null;
  endDate?: string | null;
};

const PLATFORM_NAMES: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X",
  x: "X",
};

function formatInviteDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Prize, dates and platforms under the invite card's title. */
function InviteFacts({ preview }: { preview: InvitePreview }) {
  const start = formatInviteDate(preview.startDate);
  const end = formatInviteDate(preview.endDate);
  const platforms = (preview.platforms ?? []).map(
    (p) => PLATFORM_NAMES[p] ?? p.charAt(0).toUpperCase() + p.slice(1),
  );
  const facts: { icon: typeof Clock; label: string; value: string }[] = [];
  if (preview.prizeCents) {
    facts.push({ icon: Trophy, label: "Prize pool", value: formatCurrencyFromCents(preview.prizeCents) });
  }
  if (start || end) {
    facts.push({ icon: CalendarDays, label: "Dates", value: `${start ?? "?"} – ${end ?? "?"}` });
  }
  if (platforms.length > 0) {
    facts.push({ icon: Sparkles, label: platforms.length > 1 ? "Platforms" : "Platform", value: platforms.join(", ") });
  }
  if (preview.bestPlatformOnly) {
    facts.push({ icon: Crown, label: "Payout", value: "Paid for your best platform only" });
  }
  if (facts.length === 0) return null;
  return (
    <dl className="grid gap-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3 text-sm sm:grid-cols-3">
      {facts.map((f) => (
        <div key={f.label} className="flex items-start gap-2">
          <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#7F39EC]" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs text-gray-500">{f.label}</dt>
            {/* Dates use the viewer's locale and time zone. */}
            <dd className="font-medium text-gray-900" suppressHydrationWarning>
              {f.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

type Props = {
  token: string;
  preview: InvitePreview;
  viewerType: "signed_out" | "creator" | "other";
};

const DEAD_LINK: Partial<Record<InviteRedeemResult, { icon: typeof Clock; title: string }>> = {
  expired: { icon: Clock, title: "This invite link has expired" },
  revoked: { icon: Link2Off, title: "This invite link was turned off" },
  full: { icon: Users, title: "This invite link is full" },
  ended: { icon: CalendarX, title: "This campaign has ended" },
  not_found: { icon: Link2Off, title: "We couldn't find this invite" },
};

function campaignHref(preview: InvitePreview): string {
  return preview.contestId && preview.isPublished
    ? `/dashboard/opportunities/${preview.contestId}`
    : "/dashboard/opportunities";
}

export default function InviteLandingClient({ token, preview, viewerType }: Props) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [status, setStatus] = useState(preview.linkStatus);
  const [isMember, setIsMember] = useState(preview.alreadyMember);
  const [justJoined, setJustJoined] = useState(false);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await inviteLinkApi.redeem(token);
      if (res.result === "joined" || res.result === "already_member") {
        setIsMember(true);
        setJustJoined(res.result === "joined");
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

  const switchAccount = async () => {
    setSwitching(true);
    try {
      savePendingInvite(token);
      await createClient().auth.signOut();
      router.push("/auth/signin");
    } catch (e: any) {
      toast({ title: "Couldn't sign out", description: e.message, variant: "destructive" });
      setSwitching(false);
    }
  };

  // Details are withheld for links that can't be used (expired, revoked, full, ended).
  const hasDetails = !!preview.contestId;
  const notFound = status === "not_found" || (!hasDetails && !isInviteRedeemResult(status));
  // A creator who already joined keeps the campaign card and "Open campaign"
  // even after the link expires, fills up or is revoked: their access is
  // still valid (the preview returns details for members for this reason).
  const memberWithAccess = viewerType === "creator" && isMember && hasDetails;
  const deadStatus: InviteRedeemResult | null = memberWithAccess
    ? null
    : notFound
      ? "not_found"
      : status !== "active" && status !== "public" && isInviteRedeemResult(status) && DEAD_LINK[status]
        ? status
        : null;

  const browseButton = (
    <Button asChild variant="outline" className="w-full">
      <Link href="/dashboard/opportunities">
        Browse open campaigns
      </Link>
    </Button>
  );

  let body: ReactNode;
  let actions: ReactNode = null;

  if (deadStatus) {
    const dead = DEAD_LINK[deadStatus]!;
    body = (
      <StateCard
        tone="gray"
        icon={dead.icon}
        title={dead.title}
        text={INVITE_RESULT_MESSAGES[deadStatus]}
      />
    );
    actions = browseButton;
  } else if (viewerType === "creator" && isMember) {
    body = justJoined ? (
      <StateCard
        tone="green"
        icon={PartyPopper}
        title="You're in!"
        text={
          preview.isPublished
            ? "You'll find it under Opportunities whenever you need it."
            : "It'll appear under Opportunities once the brand publishes it."
        }
      />
    ) : (
      <StateCard tone="green" icon={UserCheck} title="You already have access" text="Open the campaign to see the brief and submit." />
    );
    actions = (
      <Button asChild className="w-full bg-[#7F39EC] hover:bg-[#7F39EC]/90">
        <Link href={campaignHref(preview)}>{preview.isPublished ? "Open campaign" : "Go to Opportunities"}</Link>
      </Button>
    );
  } else if (status === "public") {
    body = <StateCard tone="green" icon={CheckCircle2} title="Open to everyone" text={INVITE_RESULT_MESSAGES.public} />;
    actions = (
      <Button asChild className="w-full bg-[#7F39EC] hover:bg-[#7F39EC]/90">
        <Link href={viewerType === "signed_out" ? "/auth/signin" : campaignHref(preview)}>Open campaign</Link>
      </Button>
    );
  } else if (viewerType === "other") {
    body = (
      <StateCard
        tone="amber"
        icon={UserX}
        title="This invite is for creators"
        text="You're signed in with a brand or admin account. Switch to your creator account to join. We'll bring you back here."
      />
    );
    actions = (
      <Button className="w-full" onClick={switchAccount} disabled={switching}>
        {switching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
        Switch account
      </Button>
    );
  } else if (viewerType === "signed_out") {
    body = (
      <ol className="grid gap-2 sm:grid-cols-2" aria-label="How joining works">
        <Step n={1} title="Sign in or create an account" active />
        <Step n={2} title="You're added automatically" />
      </ol>
    );
    actions = (
      <>
        <Button className="w-full bg-[#7F39EC] hover:bg-[#7F39EC]/90" onClick={() => goToAuth("/auth/signin")}>
          Sign in to join
        </Button>
        <Button variant="outline" className="w-full" onClick={() => goToAuth("/auth/signup")}>
          Create a creator account
        </Button>
      </>
    );
  } else {
    body = (
      <p className="text-center text-sm text-gray-600">
        Join to see the full brief and submit your content.
      </p>
    );
    actions = (
      <Button className="w-full bg-[#7F39EC] hover:bg-[#7F39EC]/90" onClick={handleJoin} disabled={joining}>
        {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Join campaign
      </Button>
    );
  }

  const notLiveNote =
    hasDetails && !preview.isPublished && !deadStatus && !isMember ? (
      <p className="text-center text-xs text-gray-500">
        This campaign isn&apos;t live yet. Join now and it&apos;ll appear in your Opportunities
        once it&apos;s published.
      </p>
    ) : null;

  return (
    <main className="flex min-h-screen items-start justify-center bg-gradient-to-b from-purple-50 to-white px-4 pb-40 pt-10 sm:items-center sm:py-12">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="block">
          <Image src={logo} alt="Game of Creators" width={180} height={60} className="mx-auto" />
        </Link>

        <div className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-xl">
          {hasDetails && !deadStatus && (
            <div className="relative aspect-video w-full bg-gradient-to-br from-[#7F39EC] to-[#4A00BE]">
              {preview.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  <Lock className="h-3 w-3" aria-hidden="true" /> Invite only
                </span>
                <h1 className="text-xl font-semibold text-white drop-shadow">
                  {preview.title || "Campaign invite"}
                </h1>
                {preview.brandName && (
                  <p className="flex items-center gap-2 text-sm text-white/90">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[10px] font-semibold text-[#4A00BE]"
                      aria-hidden="true"
                    >
                      {creatorInitials(preview.brandName, null)}
                    </span>
                    by {preview.brandName}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4 p-6">
            {hasDetails && !deadStatus && (
              <p className="text-center text-sm font-medium text-[#4A00BE]">
                You&apos;ve been invited to join this campaign.
              </p>
            )}
            {hasDetails && !deadStatus && <InviteFacts preview={preview} />}
            {body}
            {notLiveNote}
            {/* On phones the actions stay pinned to the bottom of the screen. */}
            {actions && (
              <div className="fixed inset-x-0 bottom-0 z-20 space-y-2 border-t border-gray-200 bg-white/95 p-4 backdrop-blur sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                {actions}
              </div>
            )}
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

function Step({ n, title, active }: { n: number; title: string; active?: boolean }) {
  return (
    <li
      className={
        active
          ? "flex items-center gap-2 rounded-lg border border-[#7F39EC] bg-purple-50 p-3 text-sm font-medium text-[#4A00BE]"
          : "flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm text-gray-600"
      }
    >
      <span
        className={
          active
            ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7F39EC] text-xs font-semibold text-white"
            : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600"
        }
        aria-hidden="true"
      >
        {n}
      </span>
      <span>
        <span className="sr-only">Step {n}: </span>
        {title}
      </span>
    </li>
  );
}

function StateCard({
  tone,
  icon: Icon,
  title,
  text,
}: {
  tone: "gray" | "green" | "amber";
  icon: typeof Clock;
  title: string;
  text: string;
}) {
  const tones = {
    gray: { circle: "bg-gray-100 text-gray-500", title: "text-gray-900" },
    green: { circle: "bg-emerald-100 text-emerald-600", title: "text-gray-900" },
    amber: { circle: "bg-amber-100 text-amber-700", title: "text-gray-900" },
  }[tone];
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-2 text-center">
      <span className={`flex h-16 w-16 items-center justify-center rounded-full ${tones.circle}`}>
        <Icon className="h-8 w-8" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className={`text-lg font-semibold ${tones.title}`}>{title}</p>
        <p className="text-sm text-gray-600">{text}</p>
      </div>
    </div>
  );
}
