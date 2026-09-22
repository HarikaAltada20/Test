"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const START_BALANCE = 3400;
/** Balance snaps after withdraw click (ends at $0). */
const WITHDRAW_STEPS = [2800, 2100, 1400, 700, 0];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PaidDirectlyCardProps = {
  isLight?: boolean;
};

type CursorPos = { x: number; y: number };

export default function PaidDirectlyCard({
  isLight = false,
}: PaidDirectlyCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const withdrawRef = useRef<HTMLButtonElement>(null);

  const [amount, setAmount] = useState(START_BALANCE);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showDashHighlight, setShowDashHighlight] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorClicking, setCursorClicking] = useState(false);
  const [cursorPos, setCursorPos] = useState<CursorPos>({ x: 0, y: 0 });
  const [cursorReady, setCursorReady] = useState(false);

  const readTopOfCard = (): CursorPos | null => {
    const card = cardRef.current;
    if (!card) return null;
    const width = card.clientWidth;
    return {
      x: width * 0.42,
      y: 18,
    };
  };

  const readWithdrawPos = (): CursorPos | null => {
    const card = cardRef.current;
    const btn = withdrawRef.current;
    if (!card || !btn) return null;
    const cardRect = card.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    return {
      x: btnRect.left + btnRect.width * 0.55 - cardRect.left,
      y: btnRect.top + btnRect.height * 0.45 - cardRect.top,
    };
  };

  useEffect(() => {
    let cancelled = false;

    const runAnimation = async () => {
      setAmount(START_BALANCE);
      setIsWithdrawing(false);
      setShowDashHighlight(false);
      setSuccess(false);
      setCursorClicking(false);
      setCursorVisible(false);
      setCursorReady(false);

      await wait(80);
      if (cancelled) return;

      // 1) Cursor starts at the top of the card
      const topPos = readTopOfCard();
      if (topPos) {
        setCursorPos(topPos);
        setCursorReady(true);
        setCursorVisible(true);
      }

      await wait(1000);
      if (cancelled) return;

      // 2) Move down to Withdraw and click
      const withdrawPos = readWithdrawPos();
      if (withdrawPos) {
        setCursorPos(withdrawPos);
      }

      await wait(900);
      if (cancelled) return;

      setCursorClicking(true);
      setIsWithdrawing(true);
      // Gray highlight runs once along the dotted line
      setShowDashHighlight(true);
      await wait(280);
      if (cancelled) return;
      setCursorClicking(false);

      await wait(350);
      if (cancelled) return;

      setCursorVisible(false);

      // 3) Snap balance directly through steps
      for (const next of WITHDRAW_STEPS) {
        setAmount(next);
        await wait(380);
        if (cancelled) return;
      }

      setIsWithdrawing(false);
      setShowDashHighlight(false);

      setSuccess(true);
      await wait(1400);
      if (cancelled) return;

      setSuccess(false);
      await wait(500);
      if (cancelled) return;

      setAmount(START_BALANCE);
      await wait(700);
      if (!cancelled) runAnimation();
    };

    void runAnimation();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative w-full overflow-visible rounded-[20px] px-4 pb-5 pt-8 sm:px-6 sm:pb-[22px] sm:pt-[54px]",
        isLight
          ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A] text-black"
          : "border border-[#303030] bg-[#151515] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
      )}
    >
      {/* Animated cursor — starts at top of card, then clicks Withdraw */}
      {cursorReady ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-40 transition-[left,top,opacity,transform] duration-900 ease-in-out",
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
          <Image
            src="/images/Frame (5).png"
            alt=""
            width={28}
            height={28}
            className="h-[28px] w-[28px] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
            priority
          />
        </div>
      ) : null}

      <div className="relative flex min-h-[120px] flex-col items-start gap-4 sm:min-h-[172px] sm:flex-row sm:items-center sm:justify-between">
        {/* Account balance card */}
        <div className="relative ml-3 w-full max-w-[204px] sm:ml-6 sm:h-[172px] sm:w-[204px]">
          <div
            className={cn(
              "relative h-auto w-full rounded-[17px] px-[15px] pb-4 pt-[17px] sm:h-[172px] sm:pb-0",
              isLight
                ? "border border-[#0000000D] bg-[#F1F1F1]"
                : "border border-[#2c2c2c] bg-[#151515]",
            )}
          >
            <p
              className={cn(
                "text-[13px] font-normal uppercase tracking-[-0.1px]",
                isLight ? "text-black/45" : "text-[#777]",
              )}
            >
              Account Balance
            </p>

            <p
              className={cn(
                "mt-[5px] text-[30px] font-normal leading-none tracking-[-1px] tabular-nums",
                isLight ? "text-black" : "text-[#e5e5e5]",
              )}
            >
              ${amount.toLocaleString()}
            </p>

            <button
              ref={withdrawRef}
              type="button"
              tabIndex={-1}
              className={cn(
                "mt-[15px] flex h-[34px] items-center gap-2 rounded-[9px] px-[14px] text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-300",
                isWithdrawing
                  ? "scale-[0.96] bg-orange-400/50 opacity-60"
                  : "bg-gradient-to-b from-[#ff9700] to-[#ee8500] hover:brightness-110",
              )}
            >
              <ArrowUpRight className="h-[17px] w-[17px]" strokeWidth={2.2} />
              Withdraw
            </button>
          </div>
        </div>

        {/* Dashed connector with one-shot gray highlight — desktop only */}
        <div className="relative hidden h-[2px] flex-1 self-center overflow-hidden sm:mx-3 sm:block">
          <div
            className={cn(
              "absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed",
              isLight ? "border-black/25" : "border-white/25",
            )}
          />
          {showDashHighlight ? (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-[-4px] w-[42%] animate-paid-dash-flow-once",
                isLight
                  ? "bg-gradient-to-r from-transparent via-black/35 to-transparent"
                  : "bg-gradient-to-r from-transparent via-[#c8c8c8] to-transparent",
              )}
            />
          ) : null}
        </div>

        {/* Payment icons — always visible; success check overlays when done */}
        <div className="relative flex h-[52px] items-center sm:shrink-0">
          <div
            className={cn(
              "flex items-center transition-opacity duration-500",
              success ? "opacity-0" : "opacity-100",
            )}
          >
            <div className="relative z-10 h-[43px] w-[43px] overflow-hidden rounded-full">
              <Image
                src="/images/Frame 2147243912.png"
                alt="Crypto"
                fill
                className="object-cover"
                sizes="43px"
              />
            </div>
            <div className="relative z-20 -ml-[9px] h-[43px] w-[43px] overflow-hidden rounded-full">
              <Image
                src="/images/Ellipse 41.png"
                alt="PhonePe"
                fill
                className="object-cover"
                sizes="43px"
              />
            </div>
            <div className="relative z-30 -ml-[9px] h-[43px] w-[43px] overflow-hidden rounded-full">
              <Image
                src="/images/Ellipse 42.png"
                alt="GPay"
                fill
                className="object-cover"
                sizes="43px"
              />
            </div>
          </div>

          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-all duration-500",
              success
                ? "scale-100 opacity-100"
                : "scale-75 opacity-0 pointer-events-none",
            )}
          >
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-black/40 bg-[#2bea25] shadow-[0_0_25px_rgba(43,234,37,0.22)]">
              <Check size={27} strokeWidth={2.5} className="text-black" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom content */}
      <div className="mt-6 sm:mt-[40px]">
        <h2
          className={cn(
            "text-[18px] font-semibold leading-[26px] tracking-[-0.5px] sm:text-[22px] sm:leading-[28px]",
            isLight ? "text-black" : "text-[#d0d0d0]",
          )}
        >
          Get Paid Directly
        </h2>

        <p
          className={cn(
            "mt-[7px] text-[14px] font-normal leading-[22px] tracking-[-0.2px] sm:text-[17px] sm:leading-[24px]",
            isLight ? "text-black/50" : "text-[#858585]",
          )}
        >
          Withdraw your earnings straight to UPI and Crypto
        </p>
      </div>
    </div>
  );
}
