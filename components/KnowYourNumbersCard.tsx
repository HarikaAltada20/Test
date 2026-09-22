"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CHART_PATH =
  "M38 142 C55 153, 67 145, 78 116 C91 82, 104 91, 117 113 C132 139, 143 149, 158 133 C174 115, 168 72, 192 59 C213 48, 229 82, 244 71 C256 63, 248 38, 258 28";

/** Fixed highlight peak from the design / recording (not the path tip). */
const HIGHLIGHT = { x: 192, y: 59 };

const DRAW_MS = 2400;
const HOLD_MS = 4800;
const RESET_MS = 600;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type KnowYourNumbersCardProps = {
  isLight?: boolean;
};

export default function KnowYourNumbersCard({
  isLight = false,
}: KnowYourNumbersCardProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const [drawProgress, setDrawProgress] = useState(0);
  const [highlightAt, setHighlightAt] = useState(0.55);
  const [showDot, setShowDot] = useState(false);
  const [showShares, setShowShares] = useState(false);
  const [showDollar, setShowDollar] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [lineVisible, setLineVisible] = useState(true);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const length = path.getTotalLength();
    setPathLength(length);

    let bestT = 0.55;
    let bestDist = Infinity;
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt = path.getPointAtLength(length * t);
      const dist =
        (pt.x - HIGHLIGHT.x) ** 2 + (pt.y - HIGHLIGHT.y) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }
    setHighlightAt(bestT);
  }, []);

  useEffect(() => {
    if (!pathLength) return;
    let cancelled = false;
    let raf = 0;

    const run = async () => {
      while (!cancelled) {
        setShowShares(false);
        setShowDollar(false);
        setShowViews(false);
        setShowDot(false);
        setLineVisible(true);
        setDrawProgress(0);

        await wait(350);
        if (cancelled) return;

        const startTime = performance.now();
        let sharesShown = false;
        let dollarShown = false;
        let viewsShown = false;
        let dotShown = false;

        await new Promise<void>((resolve) => {
          const tick = (now: number) => {
            if (cancelled) {
              resolve();
              return;
            }

            const t = Math.min((now - startTime) / DRAW_MS, 1);
            const eased = 1 - Math.pow(1 - t, 2.2);
            setDrawProgress(eased);

            if (!dotShown && eased >= highlightAt) {
              dotShown = true;
              setShowDot(true);
            }
            if (!sharesShown && eased >= 0.12) {
              sharesShown = true;
              setShowShares(true);
            }
            if (!dollarShown && eased >= 0.52) {
              dollarShown = true;
              setShowDollar(true);
            }
            if (!viewsShown && eased >= 0.78) {
              viewsShown = true;
              setShowViews(true);
            }

            if (t < 1) {
              raf = requestAnimationFrame(tick);
            } else {
              resolve();
            }
          };

          raf = requestAnimationFrame(tick);
        });

        if (cancelled) return;
        // Hold the completed graph + badges (matches recording dwell)
        await wait(HOLD_MS);
        if (cancelled) return;

        setLineVisible(false);
        setShowDot(false);
        setShowShares(false);
        setShowDollar(false);
        setShowViews(false);
        await wait(RESET_MS);
        if (cancelled) return;
      }
    };

    void run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [pathLength, highlightAt]);

  const dashOffset = pathLength * (1 - drawProgress);

  const pillClass = cn(
    "flex items-center gap-2.5 rounded-full px-2.5 py-2",
    "border-[0.74px] border-[#FFFFFF14] bg-[#16161A]",
    "shadow-[0px_11.79px_23.58px_0px_#0000005C]",
  );

  return (
    <div
      className={cn(
        "relative h-[340px] w-full min-w-0 overflow-hidden rounded-[20px] sm:h-[365px]",
        isLight
          ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
          : "border border-white/10 bg-[#171717] shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
      )}
    >
      {/* Chart area */}
      <div className="absolute left-4 right-4 top-4 h-[180px] sm:left-6 sm:right-6 sm:top-6 sm:h-[205px]">
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)
            `,
            backgroundSize: "34px 34px",
          }}
        />

        {/* Chart line */}
        <svg
          className={cn(
            "absolute inset-0 h-full w-full transition-opacity duration-500",
            lineVisible ? "opacity-100" : "opacity-0",
          )}
          viewBox="0 0 340 180"
          fill="none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient
              id="know-line-fade"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor="#FF8800" stopOpacity="0" />
              <stop offset="12%" stopColor="#FF8800" stopOpacity="1" />
              <stop offset="100%" stopColor="#FF8800" stopOpacity="1" />
            </linearGradient>
            <filter
              id="know-numbers-glow"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur stdDeviation="1.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            ref={pathRef}
            d={CHART_PATH}
            stroke="url(#know-line-fade)"
            strokeWidth="1.5"
            strokeLinecap="round"
            filter="url(#know-numbers-glow)"
            style={{
              strokeDasharray: pathLength || 1,
              strokeDashoffset: pathLength ? dashOffset : 1,
            }}
          />

          {/* Highlight point — fixed on the mid peak */}
          <circle
            cx={HIGHLIGHT.x}
            cy={HIGHLIGHT.y}
            r="3.5"
            fill="white"
            className={cn(
              "transition-opacity duration-200",
              showDot && lineVisible ? "opacity-100" : "opacity-0",
            )}
            style={{
              filter: "drop-shadow(0 0 5px rgba(255,255,255,0.5))",
            }}
          />
        </svg>

        {/* Shares — black pill card */}
        <div
          className={cn(
            "absolute left-[8px] top-[8px] transition-all duration-500 sm:left-[18px]",
            showShares
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0",
          )}
        >
          <div className={cn(pillClass, showShares && "animate-know-float")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D8C2FF]">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7F39EC"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 4L10.5 13.5" />
                <path d="M20 4L14 20L10.5 13.5L4 10L20 4Z" />
              </svg>
            </div>

            <div className="pr-1.5 leading-none">
              <p className="text-sm font-semibold text-white">423</p>
              <p className="mt-1 text-[9px] text-white/40">Shares</p>
            </div>
          </div>
        </div>

        {/* Earnings icon */}
        <div
          className={cn(
            "absolute right-[8px] top-0 transition-all duration-500 sm:right-[15px]",
            showDollar
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-75 opacity-0",
          )}
        >
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full",
              showDollar && "animate-know-float-delayed",
            )}
            style={{
              background:
                "radial-gradient(circle at 50% 45%, #E8FFE8 0%, #C8F5C8 55%, #B6EFB6 100%)",
              boxShadow: showDollar
                ? "0 0 20px rgba(54, 199, 89, 0.4)"
                : undefined,
            }}
          >
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[#36C759]/35">
              <span className="text-[17px] font-medium leading-none text-[#2EAE4E]">
                $
              </span>
            </div>
          </div>
        </div>

        {/* Views — black pill card */}
        <div
          className={cn(
            "absolute bottom-[12px] right-[0px] transition-all duration-500 sm:bottom-[18px] sm:right-[3px]",
            showViews
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-3 opacity-0",
          )}
        >
          <div className={cn(pillClass, showViews && "animate-know-float")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFE0C8]">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FF8800"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" fill="#FF8800" stroke="none" />
              </svg>
            </div>

            <div className="pr-1.5 leading-none">
              <p className="text-sm font-semibold text-white">1.2M</p>
              <p className="mt-1 text-[9px] text-white/40">Views</p>
            </div>
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="absolute bottom-5 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6">
        <h3
          className={cn(
            "text-[18px] font-semibold leading-tight sm:text-[21px]",
            isLight ? "text-black" : "text-white/80",
          )}
        >
          Know Your Numbers
        </h3>

        <p
          className={cn(
            "mt-2 text-[14px] leading-5 sm:text-[16px] sm:leading-6",
            isLight ? "text-black/50" : "text-white/45",
          )}
        >
          Track views, performance, and
          <br className="hidden sm:block" /> earnings easily.
        </p>
      </div>
    </div>
  );
}
