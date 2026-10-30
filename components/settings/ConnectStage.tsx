"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";
import { cn } from "@/lib/utils";
import styles from "./ConnectStage.module.css";

export type ConnectPlatform = "youtube" | "instagram" | "tiktok" | "x";

const ALL: ConnectPlatform[] = ["youtube", "instagram", "tiktok", "x"];

const SLOTS = [-3, -2, -1, 0, 1, 2, 3];

const SPARKS = [
  { x: -30, y: -18, s: 9, d: 0 },
  { x: 32, y: -10, s: 7, d: 0.6 },
  { x: -10, y: -34, s: 6, d: 1.2 },
  { x: 22, y: -30, s: 10, d: 1.7 },
  { x: -36, y: 8, s: 6, d: 2.3 },
  { x: 38, y: 14, s: 8, d: 2.9 },
];

const LABEL: Record<ConnectPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
};

const mod = (n: number, m: number) => ((n % m) + m) % m;

const list = (platforms: ConnectPlatform[], last = "and") => {
  const names = platforms.map((platform) => LABEL[platform]);
  if (names.length < 2) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ${last} ${names[names.length - 1]}`;
};

export function connectLine(connected: ConnectPlatform[], platforms: ConnectPlatform[] = ALL) {
  const left = platforms.filter((platform) => !connected.includes(platform));
  if (connected.length === 0) {
    return {
      lead: "Connect where you post.",
      rest: "You submit straight from your recent posts, and campaigns that need that platform open up. Connect your social media accounts to participate in campaigns.",
    };
  }
  if (left.length === 0) {
    return {
      lead: "Every platform is connected.",
      rest: "Any campaign you qualify for is open to you. Connect your social media accounts to participate in campaigns.",
    };
  }
  return {
    lead: `${list(connected)} connected.`,
    rest: `Add ${list(left, "or")} to open more campaigns. Connect your social media accounts to participate in campaigns.`,
  };
}

function PlatformMark({ platform }: { platform: ConnectPlatform }) {
  if (platform === "youtube") return <SiYoutube className="h-7 w-7 text-red-600" />;
  if (platform === "instagram") return <SiInstagram className="h-7 w-7 text-pink-600" />;
  if (platform === "tiktok") return <SiTiktok className="h-7 w-7 text-[#171717]" />;
  return <FaXTwitter className="h-6 w-6 text-[#171717]" />;
}

function Sparkles({ count = SPARKS.length }: { count?: number }) {
  return (
    <span className={styles.sparkles}>
      {SPARKS.slice(0, count).map((spark, index) => (
        <svg
          key={index}
          className={styles.spark}
          viewBox="0 0 12 12"
          width={spark.s}
          height={spark.s}
          style={
            {
              "--x": `${spark.x}px`,
              "--y": `${spark.y}px`,
              "--d": `${spark.d}s`,
              "--s": `${spark.s}px`,
            } as CSSProperties
          }
        >
          <path
            d="M6 0c.4 3.2 2.4 5.2 6 6-3.6.8-5.6 2.8-6 6-.4-3.2-2.4-5.2-6-6 3.6-.8 5.6-2.8 6-6Z"
            fill="currentColor"
          />
        </svg>
      ))}
    </span>
  );
}

export function ConnectStage({
  platforms = ALL,
  focus,
  connected = [],
  interval = 2400,
  className,
}: {
  platforms?: ConnectPlatform[];
  focus?: ConnectPlatform;
  connected?: ConnectPlatform[];
  interval?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const start = focus ? Math.max(0, platforms.indexOf(focus)) : 0;
  const [index, setIndex] = useState(start);
  const done = connected.filter((platform) => platforms.includes(platform));
  const row = !focus && done.length > 0;
  const complete = row && done.length === platforms.length;
  const moving = !focus && !row && !reduce && platforms.length > 1;

  useEffect(() => setIndex(start), [start]);
  useEffect(() => {
    if (!moving) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((current) => current + 1);
    }, interval);
    return () => window.clearInterval(timer);
  }, [moving, interval]);

  if (row) {
    return (
      <div
        className={cn(styles.stage, styles.row, complete && styles.complete, reduce && styles.calm, className)}
        aria-hidden="true"
      >
        <span className={styles.bloom} />
        {platforms.map((platform) => {
          const on = done.includes(platform);
          return (
            <span key={platform} className={cn(styles.place, on ? styles.on : styles.off)}>
              <span className={styles.tile}>
                <PlatformMark platform={platform} />
                <span className={styles.badge}>
                  {on ? <Check size={11} strokeWidth={3} /> : <Plus size={11} strokeWidth={2.6} />}
                </span>
              </span>
              {on && !reduce && <Sparkles count={complete ? 6 : 4} />}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn(styles.stage, reduce && styles.calm, className)} aria-hidden="true">
      <span className={styles.bloom} />
      {SLOTS.map((slot) => {
        const abs = index + slot;
        const platform = platforms[mod(abs, platforms.length)];
        return (
          <span
            key={abs}
            className={styles.slot}
            data-k={slot}
            style={{ "--k": slot } as CSSProperties}
          >
            <span className={styles.tile}>
              <PlatformMark platform={platform} />
            </span>
            {slot === 0 && !reduce && <Sparkles />}
          </span>
        );
      })}
    </div>
  );
}
