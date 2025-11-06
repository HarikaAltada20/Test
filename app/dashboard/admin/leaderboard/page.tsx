"use client";

import LeaderboardClient from "@/app/dashboard/leaderboard/LeaderboardClient";
import { Award } from "lucide-react";

export default function AdminLeaderboardPage() {
  return (
    <div className="px-2 sm:px-4">
      <div className="">
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl">
          <div className="relative">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2">
                <Award className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-gray-900" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
                Admin Leaderboard
              </h1>
            </div>
          </div>
        </div>
      </div>

      <LeaderboardClient showAdminSummary hideHeroHeader />
    </div>
  );
}
