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
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} ${last} ${names[names.length - 1]}`;
};

export function connectLine(connected: ConnectPlatform[]) {
  const left = ALL.filter((platform) => !connected.includes(platform));
  if (connected.length === 0) {
    return {
      lead: "Connect where you post.",
      rest: "You submit straight from your recent posts, and campaigns that need that platform open up.",
    };
  }
  if (left.length === 0) {
    return {
      lead: "Every platform is connected.",
      rest: "Any campaign you qualify for is open to you.",
    };
  }
  return {
    lead: `${list(connected)} connected.`,
    rest: `Add ${list(left, "or")} to open more campaigns.`,
  };
}

function PlatformGlyph({ platform }: { platform: ConnectPlatform }) {
  if (platform === "youtube") {
    return <SiYoutube className="h-[30px] w-[30px] text-[#FF0000]" aria-hidden />;
  }
  if (platform === "instagram") {
    return <SiInstagram className="h-[28px] w-[28px] text-[#E1306C]" aria-hidden />;
  }
  if (platform === "tiktok") {
    return <SiTiktok className="h-[28px] w-[28px] text-[#111]" aria-hidden />;
  }
  return <FaXTwitter className="h-[26px] w-[26px] text-[#111]" aria-hidden />;
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
          style={{ "--x": `${spark.x}px`, "--y": `${spark.y}px`, "--d": `${spark.d}s` } as CSSProperties}
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
  connected = [],
  interval = 2400,
  className,
}: {
  connected?: ConnectPlatform[];
  interval?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const done = ALL.filter((platform) => connected.includes(platform));
  const row = done.length > 0;
  const complete = done.length === ALL.length;
  const moving = !row && !reduce;

  useEffect(() => {
    if (!moving) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((value) => value + 1);
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
        {ALL.map((platform, position) => {
          const on = done.includes(platform);
          return (
            <span
              key={platform}
              className={cn(styles.place, on ? styles.on : styles.off)}
              style={{ "--pos": position - (ALL.length - 1) / 2, "--i": position } as CSSProperties}
            >
              <span className={styles.tile}>
                <PlatformGlyph platform={platform} />
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
        const absolute = index + slot;
        const platform = ALL[mod(absolute, ALL.length)];
        return (
          <span
            key={absolute}
            className={styles.slot}
            data-k={slot}
            style={{ "--k": slot, "--i": mod(absolute, 7) } as CSSProperties}
          >
            <span className={styles.tile}>
              <PlatformGlyph platform={platform} />
            </span>
            {slot === 0 && !reduce && <Sparkles />}
          </span>
        );
      })}
    </div>
  );
}
