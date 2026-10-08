"use client";

import React from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

export interface BudgetDistributionCardProps {
  className?: string;
}

export function BudgetDistributionCard({ className }: BudgetDistributionCardProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      // The card's native design width is 486px. Scale down if container is smaller.
      if (width < 486) {
        setScale(width / 486);
      } else {
        setScale(1);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-full w-full items-end justify-center bg-transparent",
        className
      )}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[18px] flex items-end justify-center px-2 sm:px-4 pt-4">
        <div
          className="relative flex justify-center"
          style={{
            width: 486 * scale,
            height: 380 * scale,
          }}
        >
          <div
            className="absolute bottom-0 origin-bottom"
            style={{
              width: 486,
              height: 380,
              transform: `scale(${scale})`,
            }}
          >
            <div className="relative h-[380px] w-[486px] overflow-hidden rounded-t-[17.41px] border-[0.73px] border-b-0 border-[#353535] bg-[#171717] shadow-[8px_8px_50px_rgba(0,0,0,0.5),4px_12px_4px_rgba(0,0,0,0.1)]">
            
            {/* Center Content */}
            <div className="absolute left-[173px] top-[100px] inline-flex flex-col items-center justify-center gap-[0.35px]">
              <div className="font-geist text-[24px] font-medium text-[#F0E6F6]">$2,000</div>
              <div className="font-inter text-[17px] font-medium leading-[25.5px] text-[#7E7B80]">Campaign Budget</div>
            </div>

            {/* Central Icon */}
            <div className="absolute left-[220px] top-[43px] flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#754FF6]">
              <Image 
                src="/images/Frame (3)wdasdasd.png" 
                alt="Badge" 
                width={24} 
                height={24} 
                className="h-[24px] w-[24px] object-contain" 
              />
            </div>

            {/* Smooth SVG Connector Lines */}
            <svg
              className="absolute inset-0 h-full w-full pointer-events-none"
              style={{ zIndex: 0 }}
            >
              <defs>
                <filter id="line-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="0" floodColor="#000000" floodOpacity="0.8" />
                </filter>
              </defs>
              <g filter="url(#line-shadow)">
                {/* Creator 1 (Top Left) */}
                <path
                  d="M217 161.5 L217 221 A22 22 0 0 1 195 243 L119 243"
                  fill="none"
                  stroke="#353535"
                  strokeWidth="1.5"
                />
                {/* Creator 3 (Bottom Left) */}
                <path
                  d="M234 161 L234 302 A22 22 0 0 1 212 324 L67 324"
                  fill="none"
                  stroke="#353535"
                  strokeWidth="1.5"
                />
                {/* Creator 2 (Top Right) */}
                <path
                  d="M266 161.5 L266 221 A22 22 0 0 0 288 243 L364 243"
                  fill="none"
                  stroke="#353535"
                  strokeWidth="1.5"
                />
                {/* Creator 4 (Bottom Right) */}
                <path
                  d="M252 161 L252 302 A22 22 0 0 0 274 324 L419 324"
                  fill="none"
                  stroke="#353535"
                  strokeWidth="1.5"
                />
              </g>
            </svg>

            {/* Creator 1 Pill */}
            <div className="absolute left-[43.37px] top-[221.14px] inline-flex items-start justify-start gap-[17.68px] rounded-[25.73px] border-[0.74px] border-white/10 bg-[#16161A] py-1 pl-1 pr-4 shadow-[0px_11.8px_23.6px_rgba(0,0,0,0.36)]">
              <div className="flex items-center justify-start gap-[8.84px]">
                <Image src="/images/avatar-container.png" alt="Creator 1" width={32} height={32} className="h-[32.16px] w-[32.16px] rounded-full object-cover" />
                <div className="inline-flex flex-col items-start justify-start gap-[2.95px]">
                  <div className="font-inter text-[12.86px] font-semibold text-white">Creator 1</div>
                  <div className="text-center font-inter text-[8.58px] font-semibold text-[#3BEA2E]">$500</div>
                </div>
              </div>
            </div>

            {/* Creator 3 Pill */}
            <div className="absolute left-[23px] top-[304px] inline-flex items-start justify-start gap-[17.68px] rounded-[25.73px] border-[0.74px] border-white/10 bg-[#16161A] py-1 pl-1 pr-4 shadow-[0px_11.8px_23.6px_rgba(0,0,0,0.36)]">
              <div className="flex items-center justify-start gap-[8.84px]">
                <Image src="/images/avatar-container (2).png" alt="Creator 3" width={32} height={32} className="h-[32.16px] w-[32.16px] rounded-full object-cover" />
                <div className="inline-flex flex-col items-start justify-start gap-[2.95px]">
                  <div className="font-inter text-[12.86px] font-semibold text-white">Creator 3</div>
                  <div className="text-center font-inter text-[8.58px] font-semibold text-[#3BEA2E]">$150</div>
                </div>
              </div>
            </div>

            {/* Creator 2 Pill */}
            <div className="absolute left-[322.09px] top-[219px] inline-flex items-start justify-start gap-[17.68px] rounded-[25.73px] border-[0.74px] border-white/10 bg-[#16161A] py-1 pl-1 pr-4 shadow-[0px_11.8px_23.6px_rgba(0,0,0,0.36)]">
              <div className="flex items-center justify-start gap-[8.84px]">
                <Image src="/images/avatar-container (1).png" alt="Creator 2" width={32} height={32} className="h-[32.16px] w-[32.16px] rounded-full object-cover" />
                <div className="inline-flex flex-col items-start justify-start gap-[2.95px]">
                  <div className="font-inter text-[12.86px] font-semibold text-white">Creator 2</div>
                  <div className="text-center font-inter text-[8.58px] font-semibold text-[#3BEA2E]">$250</div>
                </div>
              </div>
            </div>

            {/* Creator 4 Pill */}
            <div className="absolute left-[347.82px] top-[302.62px] inline-flex items-start justify-start gap-[17.68px] rounded-[25.73px] border-[0.74px] border-white/10 bg-[#16161A] py-1 pl-1 pr-4 shadow-[0px_11.8px_23.6px_rgba(0,0,0,0.36)]">
              <div className="flex items-center justify-start gap-[8.84px]">
                <Image src="/images/avatar-container (3).png" alt="Creator 4" width={32} height={32} className="h-[32.16px] w-[32.16px] rounded-full object-cover" />
                <div className="inline-flex flex-col items-start justify-start gap-[2.95px]">
                  <div className="font-inter text-[12.86px] font-semibold text-white">Creator 4</div>
                  <div className="text-center font-inter text-[8.58px] font-semibold text-[#3BEA2E]">$100</div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BudgetDistributionCard;
