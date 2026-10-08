"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface PerformanceOverviewCardProps {
  className?: string;
}

export function PerformanceOverviewCard({
  className,
}: PerformanceOverviewCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-end pl-4 py-4",
        className
      )}
    >
      <div className="relative w-full max-w-[620px] overflow-hidden rounded-l-[13px] border-[0.73px] border-r-0 border-[#292929] bg-[#171717] px-5 pb-4 pt-6 shadow-[0_15px_35px_rgba(0,0,0,0.25)] sm:px-7 sm:pt-7">
      {/* Heading */}
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#f5f5f5] sm:text-[22px]">
        Performance Overview
      </h2>

      <p className="mt-1 text-[9px] text-[#707070] sm:text-[10px]">
        How your creator content is performing over time
      </p>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] text-[#7e7e7e] sm:gap-x-5 sm:text-[10px]">
        <Legend active color="purple" label="Views" />
        <Legend color="orange" label="Likes" />
        <Legend color="cyan" label="Comments" />
        <Legend color="gray" label="Shares" />
      </div>

      {/* Main metric */}
      <div className="relative mt-10 flex items-end gap-2.5">
        <span className="absolute -top-5 left-0 text-[8px] font-bold tracking-[0.1em] text-[#9a9a9a] sm:text-[9px]">
          VIEWS PER WEEK
        </span>

        <span className="text-[26px] font-bold leading-none tracking-[-0.04em] text-white sm:text-[30px]">
          8,607,772
        </span>

        <span className="mb-px rounded-lg bg-[rgba(20,105,59,0.22)] px-2 py-1 text-[9px] font-bold text-[#35bd70] sm:text-[10px]">
          ↗ 805.8%
        </span>

        <span className="mb-[3px] text-[8px] text-[#666] sm:text-[9px]">
          vs earlier half of range
        </span>
      </div>

      {/* Chart */}
      <div className="relative mt-5 h-[200px] sm:h-[220px]">
        {/* Chart key */}
        <div className="absolute right-0 top-[-25px] hidden gap-4 text-[8px] text-[#666] sm:flex">
          <span>
            <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#25bd6b]" />
            Paid views
          </span>

          <span>
            <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#8f48ec]" />
            Verified
          </span>
        </div>

        <svg
          viewBox="0 0 690 220"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="greenFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#2bbd6e" stopOpacity=".18" />
              <stop offset="1" stopColor="#2bbd6e" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[20, 62, 104, 146, 188].map((y) => (
            <line
              key={y}
              x1="34"
              y1={y}
              x2="690"
              y2={y}
              stroke="#2b2b2b"
              strokeWidth="1"
            />
          ))}

          {/* Y axis */}
          <text x="0" y="23" fill="#696969" fontSize="8">
            800K
          </text>
          <text x="0" y="65" fill="#696969" fontSize="8">
            600K
          </text>
          <text x="0" y="107" fill="#696969" fontSize="8">
            400K
          </text>
          <text x="0" y="149" fill="#696969" fontSize="8">
            200K
          </text>
          <text x="16" y="191" fill="#696969" fontSize="8">
            0
          </text>

          {/* Green area */}
          <path
            fill="url(#greenFill)"
            d="
              M34 188
              C80 188 120 187 155 188
              C190 188 216 185 246 184
              C276 183 296 173 325 169
              C355 165 372 169 400 158
              C430 151 456 145 482 139
              C512 132 531 126 556 121
              C585 115 603 109 628 103
              C651 98 671 93 690 88
              L690 188
              L34 188
              Z
            "
          />

          {/* Purple */}
          <path
            d="
              M34 187
              C80 187 120 187 155 187
              C190 188 216 186 246 183
              C276 180 296 172 325 168
              C355 164 372 167 400 157
              C430 150 456 143 482 136
              C512 128 531 119 556 113
              C585 106 603 100 628 94
              C651 88 671 83 690 78
            "
            fill="none"
            stroke="#7F39EA"
            strokeWidth="2"
          />

          {/* Orange */}
          <path
            d="
              M34 188
              C80 188 120 188 155 188
              C190 188 216 187 246 185
              C276 182 296 176 325 171
              C355 167 372 169 400 160
              C430 153 456 147 482 141
              C512 135 531 129 556 123
              C585 117 603 112 628 107
              C651 101 671 97 690 92
            "
            fill="none"
            stroke="#f19a2f"
            strokeWidth="2"
          />

          {/* Green */}
          <path
            d="
              M34 189
              C80 189 120 189 155 189
              C190 189 216 188 246 186
              C276 184 296 178 325 173
              C355 169 372 171 400 163
              C430 157 456 151 482 145
              C512 140 531 134 556 128
              C585 122 603 117 628 112
              C651 107 671 103 690 98
            "
            fill="none"
            stroke="#398DEC"
            strokeWidth="2"
          />

          {/* Red */}
          <path
            d="
              M34 190
              C80 190 120 190 155 190
              C190 190 216 189 246 187
              C276 185 296 179 325 174
              C355 170 372 172 400 164
              C430 158 456 152 482 146
              C512 141 531 135 556 129
              C585 123 603 118 628 113
              C651 108 671 104 690 99
            "
            fill="none"
            stroke="#e65e63"
            strokeWidth="2"
          />

          {/* X axis */}
          {[
            ["Aug 23", 34],
            ["Sep 13", 92],
            ["Oct 4", 153],
            ["Oct 25", 207],
            ["Nov 15", 269],
            ["Dec 6", 330],
            ["Dec 27", 391],
            ["Jan 17", 452],
            ["Feb 7", 513],
            ["Feb 28", 570],
            ["Mar 21", 626],
            ["Apr 11", 681],
          ].map(([label, x]) => (
            <text
              key={String(label)}
              x={Number(x)}
              y="210"
              fill="#5d5d5d"
              fontSize="8"
            >
              {label}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        <div
          className="
            absolute right-0 top-2
            w-[143px]
            rounded-[9px]
            border border-[#444]
            bg-[rgba(30,30,30,0.96)]
            p-2.5
            text-[9px]
            shadow-[0_12px_28px_rgba(0,0,0,0.45)]
          "
        >
          <div className="mb-2 font-bold text-[#ddd]">Jun 10</div>

          <TooltipRow label="Views" value="1,897,846" valueClass="text-[#FFFFFF]" />
          <TooltipRow label="Pending Views" value="217" valueClass="text-[#30b76a]" />
          <TooltipRow
            label="Verified Views"
            value="25,789"
            valueClass="text-[#398DEC]"
          />
          <TooltipRow
            label="Paid Views"
            value="239,343"
            valueClass="text-[#f19a2f]"
          />
          <TooltipRow
            label="Rejected Views"
            value="1,632,497"
            valueClass="text-[#e65e63]"
          />
        </div>
      </div>
      </div>
    </div>
  );
}

function Legend({
  label,
  color,
  active = false,
}: {
  label: string;
  color: "purple" | "orange" | "cyan" | "gray";
  active?: boolean;
}) {
  const colors = {
    purple: "bg-[#9d4df2]",
    orange: "bg-[#f2b34c]",
    cyan: "bg-[#57c7d9]",
    gray: "bg-[#666]",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`grid h-3 w-3 place-items-center rounded-[3px] border ${
          active
            ? "border-[#9147ee] bg-[#9147ee] text-[8px] text-white"
            : "border-[#6d6d6d]"
        }`}
      >
        {active && "✓"}
      </span>

      <span>{label}</span>

      <i className={`h-[3px] w-[10px] rounded-full ${colors[color]}`} />
    </div>
  );
}

function TooltipRow({
  label,
  value,
  valueClass = "text-[#aaa]",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="my-1 flex justify-between gap-2 text-[#777]">
      <span>{label}</span>
      <b className={`font-medium ${valueClass}`}>: {value}</b>
    </div>
  );
}

export default PerformanceOverviewCard;
