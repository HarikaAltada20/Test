"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const ROW_ONE = [
  "Category / Niche",
  "Campaign Type",
  "Platform",
  "Content Type",
];

const ROW_TWO = [
  "Campaign Status",
  "Deadline",
  "Earning Potential",
  "Reward Model",
];

/** Demo click order — matching the product recording. */
const CLICK_SEQUENCE = ["Deadline", "Category / Niche"] as const;

const ROW_PAUSE_FOR: Record<string, "one" | "two"> = {
  "Category / Niche": "one",
  Deadline: "two",
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type CursorPos = { x: number; y: number };

type PickWhatFitsCardProps = {
  isLight?: boolean;
};

export default function PickWhatFitsCard({
  isLight = false,
}: PickWhatFitsCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [rowOnePaused, setRowOnePaused] = useState(false);
  const [rowTwoPaused, setRowTwoPaused] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorClicking, setCursorClicking] = useState(false);
  const [cursorPos, setCursorPos] = useState<CursorPos>({ x: 0, y: 0 });
  const [cursorReady, setCursorReady] = useState(false);
  const [showClickBurst, setShowClickBurst] = useState(false);

  const findVisibleChipPos = (label: string): CursorPos | null => {
    const card = cardRef.current;
    if (!card) return null;

    const cardRect = card.getBoundingClientRect();
    const chips = card.querySelectorAll<HTMLElement>(`[data-chip="${label}"]`);
    if (!chips.length) return null;

    const midX = cardRect.left + cardRect.width / 2;
    let best: HTMLElement | null = null;
    let bestDist = Infinity;

    chips.forEach((chip) => {
      const r = chip.getBoundingClientRect();
      const cx = (r.left + r.right) / 2;
      const inView =
        r.right > cardRect.left + 28 && r.left < cardRect.right - 28;
      if (!inView) return;
      const dist = Math.abs(cx - midX);
      if (dist < bestDist) {
        bestDist = dist;
        best = chip;
      }
    });

    if (!best) {
      // Fall back to whichever instance is closest to center
      chips.forEach((chip) => {
        const r = chip.getBoundingClientRect();
        const cx = (r.left + r.right) / 2;
        const dist = Math.abs(cx - midX);
        if (dist < bestDist) {
          bestDist = dist;
          best = chip;
        }
      });
    }

    if (!best) return null;
    const chipRect = best.getBoundingClientRect();
    return {
      x: chipRect.left + chipRect.width * 0.62 - cardRect.left,
      y: chipRect.top + chipRect.height * 0.55 - cardRect.top,
    };
  };

  /** Wait until a chip for `label` is reasonably in view, then pause its row. */
  const waitForChipAndPause = async (
    label: string,
    cancelled: () => boolean,
  ): Promise<CursorPos | null> => {
    const row = ROW_PAUSE_FOR[label];
    const deadline = performance.now() + 4000;

    while (performance.now() < deadline) {
      if (cancelled()) return null;
      const pos = findVisibleChipPos(label);
      if (pos) {
        if (row === "one") setRowOnePaused(true);
        if (row === "two") setRowTwoPaused(true);
        await wait(40);
        if (cancelled()) return null;
        return findVisibleChipPos(label) ?? pos;
      }
      await wait(60);
    }

    // Timeout: pause anyway and use best available position
    if (row === "one") setRowOnePaused(true);
    if (row === "two") setRowTwoPaused(true);
    await wait(40);
    return findVisibleChipPos(label);
  };

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    const runAnimation = async () => {
      let shownCursor = false;

      setActiveFilter(null);
      setRowOnePaused(false);
      setRowTwoPaused(false);
      setCursorClicking(false);
      setShowClickBurst(false);
      setCursorVisible(false);
      setCursorReady(false);

      await wait(500);
      if (cancelled) return;

      for (const label of CLICK_SEQUENCE) {
        if (cancelled) return;

        const pos = await waitForChipAndPause(label, isCancelled);
        if (cancelled) return;

        if (pos) {
          if (!shownCursor) {
            setCursorPos({
              x: pos.x - 28,
              y: pos.y - 22,
            });
            setCursorReady(true);
            setCursorVisible(true);
            shownCursor = true;
            await wait(120);
            if (cancelled) return;
          }
          setCursorPos(pos);
        }

        await wait(700);
        if (cancelled) return;

        setCursorClicking(true);
        setShowClickBurst(true);
        setActiveFilter(label);

        await wait(240);
        if (cancelled) return;

        setCursorClicking(false);
        setShowClickBurst(false);

        // Hold while the selected row stays paused
        await wait(1100);
        if (cancelled) return;

        setActiveFilter(null);
        setRowOnePaused(false);
        setRowTwoPaused(false);

        await wait(380);
        if (cancelled) return;
      }

      setCursorVisible(false);
      await wait(600);
      if (!cancelled) void runAnimation();
    };

    void runAnimation();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- demo loop mounts once
  }, []);

  const chipClass = (label: string) =>
    cn(
      "flex h-[32px] shrink-0 items-center rounded-full px-3 text-[12px] font-medium leading-none transition-[background-color,color,box-shadow,transform] duration-300 sm:h-[37px] sm:px-4 sm:text-[13px]",
      activeFilter === label
        ? "scale-[1.03] bg-[#FF8800] text-white shadow-[0_8px_20px_rgba(255,136,0,0.35)]"
        : isLight
          ? "border border-[#0000000D] bg-[#DEDEDE] text-black/70 shadow-[0px_11px_21.99px_0px_#FFFFFF5C]"
          : "bg-[#555] text-[#e5e5e5]",
    );

  const renderRow = (
    filters: string[],
    opts: {
      direction: "left" | "right";
      paused: boolean;
      offsetClass?: string;
    },
  ) => {
    const track = [...filters, ...filters];
    return (
      <div className={cn("overflow-hidden", opts.offsetClass)}>
        <div
          className={cn(
            "flex gap-2 sm:gap-[10px]",
            opts.direction === "left"
              ? "animate-pick-fits-left"
              : "animate-pick-fits-right",
            opts.paused && "animate-pick-fits-paused",
          )}
        >
          {track.map((filter, index) => (
            <div
              key={`${opts.direction}-${filter}-${index}`}
              data-chip={filter}
              className={chipClass(filter)}
            >
              {filter}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative h-[340px] w-full min-w-0 overflow-hidden rounded-[20px] sm:h-[365px]",
        isLight
          ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
          : "border border-white/[0.08] bg-[#171717]",
      )}
    >
      {/* Filter chips — rows marquee; pause when Deadline / Category clicked */}
      <div className="absolute inset-x-0 top-[64px] sm:top-[82px]">
        <div
          className="relative mx-auto flex w-full flex-col gap-2.5 sm:absolute sm:-left-[58px] sm:top-0 sm:w-[540px] sm:gap-[10px]"
          style={{
            maskImage:
              "linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%)",
          }}
        >
          {renderRow(ROW_ONE, {
            direction: "left",
            paused: rowOnePaused,
          })}
          {renderRow(ROW_TWO, {
            direction: "right",
            paused: rowTwoPaused,
            offsetClass: "sm:pl-6",
          })}
        </div>
      </div>

      {/* Animated cursor — clicks Deadline then Category / Niche */}
      {cursorReady ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-40 transition-[left,top,opacity,transform] duration-700 ease-in-out",
            cursorVisible ? "opacity-100" : "opacity-0",
            cursorClicking && "scale-90",
          )}
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            width: 28,
            height: 28,
          }}
        >
          {showClickBurst ? (
            <span className="pointer-events-none absolute -left-1 -top-1 h-5 w-5 animate-ping rounded-full bg-white/50" />
          ) : null}
          <Image
            src="/images/Frame (5).png"
            alt=""
            width={28}
            height={28}
            className="relative h-[28px] w-[28px] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
            priority
          />
        </div>
      ) : null}

      {/* Text — aligned with Know Your Numbers */}
      <div className="absolute bottom-5 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6">
        <h3
          className={cn(
            "text-[18px] font-semibold leading-tight sm:text-[21px]",
            isLight ? "text-black" : "text-white/80",
          )}
        >
          Pick What Fits
        </h3>

        <p
          className={cn(
            "mt-2 text-[14px] leading-5 sm:text-[16px] sm:leading-6",
            isLight ? "text-black/50" : "text-white/45",
          )}
        >
          Choose campaigns that match your
          <br className="hidden sm:block" /> content style.
        </p>
      </div>
    </div>
  );
}
