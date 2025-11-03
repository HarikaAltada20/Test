"use client";

import LeaderboardClient from "@/app/dashboard/leaderboard/LeaderboardClient";
import { Award } from "lucide-react";

export default function AdminLeaderboardPage() {
  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 md:py-8">
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 bg-white shadow-md">
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

      <LeaderboardClient showAdminSummary summaryOnly />
    </div>
  );
}
