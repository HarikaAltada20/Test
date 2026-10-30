"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Compass,
  MessageSquare,
  Star,
} from "lucide-react";
import { FaLinkedin, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { SiInstagram, SiYoutube } from "react-icons/si";
import { SOCIAL_LINKS } from "@/constants/socialLinks";
import { CALENDLY_FOUNDER_URL } from "@/constants/brandPartnershipForm";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const followLinks = [
  { label: "Instagram", href: SOCIAL_LINKS.instagram, icon: SiInstagram },
  { label: "YouTube", href: SOCIAL_LINKS.youtube, icon: SiYoutube },
  { label: "X (Twitter)", href: SOCIAL_LINKS.twitter, icon: FaXTwitter },
  { label: "LinkedIn", href: SOCIAL_LINKS.linkedin, icon: FaLinkedin },
];

function BrandHelpIllustration() {
  return (
    <svg
      width="76"
      height="72"
      viewBox="0 0 76 72"
      fill="none"
      aria-hidden="true"
      className="mx-auto"
    >
      <rect x="6" y="14" width="30" height="26" rx="8" fill="#E9E0FF" />
      <rect x="6" y="38" width="64" height="28" rx="9" fill="#1F1F23" />
      <rect x="6" y="38" width="64" height="9" rx="4.5" fill="#34343A" />
      <path
        d="M34 4h30a9 9 0 0 1 9 9v10a9 9 0 0 1-9 9H52l-8 7v-7h-10a9 9 0 0 1-9-9V13a9 9 0 0 1 9-9Z"
        fill="#7C3AED"
      />
      <path
        d="M34 4h30a9 9 0 0 1 9 9v2a9 9 0 0 0-9-9H34a9 9 0 0 0-9 9v-2a9 9 0 0 1 9-9Z"
        fill="#A78BFA"
      />
      <rect x="40" y="14" width="28" height="12" rx="6" fill="#F5F3FF" />
      <text
        x="54"
        y="23"
        textAnchor="middle"
        fill="#5B21B6"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        30 min
      </text>
    </svg>
  );
}

export default function BrandHelpClient() {
  const [isDark, setIsDark] = useState(false);
  const [supportChatEnabled, setSupportChatEnabled] = useState(true);

  useEffect(() => {
    const readMode = () => {
      const attr = document
        .querySelector("[data-mode]")
        ?.getAttribute("data-mode");
      setIsDark(attr === "dark");
    };
    readMode();
    const target = document.querySelector("[data-mode]");
    if (!target) return;
    const observer = new MutationObserver(readMode);
    observer.observe(target, {
      attributes: true,
      attributeFilter: ["data-mode"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetch("/api/support/status")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.enabled === "boolean") setSupportChatEnabled(d.enabled);
      })
      .catch(() => {});
  }, []);

  const openChat = () => {
    if (!supportChatEnabled) return;
    window.dispatchEvent(new CustomEvent("go:open-support-chat"));
  };

  const openReview = () => {
    window.dispatchEvent(new CustomEvent("go:open-review"));
  };

  const muted = isDark ? "text-white/60" : "text-[#6B6B76]";
  const rowClass = cn(
    "group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors",
    isDark ? "hover:bg-white/5" : "hover:bg-[#F6F6F7]",
  );
  const arrowTile = cn(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
    isDark
      ? "border-white/10 bg-white/5 text-white/70"
      : "border-[#E6E6E8] bg-[#F6F6F7] text-[#55555F]",
  );
  const footerButton = cn(
    "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
    isDark
      ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
      : "border-[#E6E6E8] bg-white text-[#3A3A42] hover:bg-[#F6F6F7]",
  );

  return (
    <div className="mx-auto w-full max-w-[440px] py-2 sm:py-6">
      <section
        className={cn(
          "overflow-hidden rounded-3xl border px-5 pb-5 pt-9 sm:px-7",
          isDark
            ? "border-white/10 bg-white/5 text-white"
            : "border-[#ECEDEF] bg-[linear-gradient(180deg,#F7F2FF_0%,#FFFFFF_38%)] text-[#18181B] shadow-[0_24px_48px_-32px_rgba(124,58,237,0.28)]",
        )}
        style={
          !isDark
            ? {
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(124,58,237,0.08) 1px, transparent 0), linear-gradient(180deg,#F7F2FF 0%,#FFFFFF 38%)",
                backgroundSize: "18px 18px, auto",
              }
            : undefined
        }
      >
        <BrandHelpIllustration />

        <h1 className="mt-5 text-center text-[22px] font-bold tracking-tight">
          Book a call with the founder
        </h1>
        <p
          className={cn(
            "mx-auto mt-2 max-w-[340px] text-center text-[14px] leading-6",
            muted,
          )}
        >
          Talk directly with our team. We&apos;ll understand your goals and put
          together a plan on the spot.
        </p>
        <p className={cn("mt-3 text-center text-[12px]", muted)}>
          Free · 30 minutes · A custom campaign plan
        </p>

        <a
          href={CALENDLY_FOUNDER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#7C3AED] text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(124,58,237,0.85)] ring-1 ring-[#5B21B6]/30 transition-colors hover:bg-[#6D28D9]"
        >
          Book a free call
          <ArrowUpRight className="h-4 w-4" />
        </a>

        <div className="my-4 flex items-center gap-3">
          <span
            className={cn("h-px flex-1", isDark ? "bg-white/10" : "bg-[#ECEDEF]")}
          />
          <span className={cn("text-[12px]", muted)}>or</span>
          <span
            className={cn("h-px flex-1", isDark ? "bg-white/10" : "bg-[#ECEDEF]")}
          />
        </div>

        <ul className="space-y-0.5">
          <li>
            <Link href="/dashboard/getting-started" className={rowClass}>
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  isDark
                    ? "bg-[#7C3AED]/20 text-[#C4B5FD]"
                    : "bg-[#F3EEFF] text-[#7C3AED]",
                )}
              >
                <Compass className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-5">
                  How it works
                </span>
                <span className={cn("block text-[12px] leading-5", muted)}>
                  Campaign types, setup, and getting results
                </span>
              </span>
              <span className={arrowTile}>
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </li>
          <li>
            <a
              href={SOCIAL_LINKS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={rowClass}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white">
                <FaWhatsapp className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-5">
                  Join us on WhatsApp
                </span>
                <span className={cn("block text-[12px] leading-5", muted)}>
                  Connect with creators and get support
                </span>
              </span>
              <span className={arrowTile}>
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </a>
          </li>
          <li>
            <button
              type="button"
              onClick={openChat}
              disabled={!supportChatEnabled}
              title={
                supportChatEnabled
                  ? "Chat with support"
                  : "Support chat is unavailable for your account"
              }
              className={cn(
                rowClass,
                !supportChatEnabled && "cursor-not-allowed opacity-60",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  isDark
                    ? "bg-[#7C3AED]/20 text-[#C4B5FD]"
                    : "bg-[#F3EEFF] text-[#7C3AED]",
                )}
              >
                <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[14px] font-semibold leading-5">
                  {supportChatEnabled ? "Chat with us" : "Chat unavailable"}
                </span>
                <span className={cn("block text-[12px] leading-5", muted)}>
                  Ask about campaigns, billing, or setup
                </span>
              </span>
              <span className={arrowTile}>
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </li>
        </ul>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={openReview} className={footerButton}>
            <Star className="h-4 w-4" strokeWidth={1.75} />
            Leave a review
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={footerButton}>
                Follow us
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {followLinks.map(({ label, href, icon: Icon }) => (
                <DropdownMenuItem key={label} asChild>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>
    </div>
  );
}
