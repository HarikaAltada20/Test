"use client";

import React, { Suspense, useState } from "react";
import { ContestListClient } from "./ContestListClient";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ContestCreationModal } from "@/components/ContestCreationModal";
import { useContestCreation } from "@/hooks/use-contest-creation";

interface ContestsPageClientProps {
    initialContests: any[];
    userId: string;
}

export function ContestsPageClient({ initialContests, userId }: ContestsPageClientProps) {
    const [showModal, setShowModal] = useState(false);
    const { handleCreateContest } = useContestCreation(userId);
    const [selectedTab, setSelectedTab] = useState("all");

    const handleCreateContestClick = async () => {
        const shouldShowModal = await handleCreateContest();
        if (shouldShowModal) {
            setShowModal(true);
        }
    };

    const handleViewAllDrafts = () => {
        setSelectedTab("draft");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-row gap-4 md:items-center md:justify-between">
                <div className="flex-1">
                    <h1 className="text-2xl md:text-2xl font-bold tracking-tight">My Contests</h1>
                </div>
                <button
                 className="flex items-center gap-1 px-4 py-2.5 text-md rounded-xl bg-[#4A00BE] text-white font-medium"
                    
                   
                    onClick={handleCreateContestClick}
                >
                    <Plus className="h-4 w-4" /> Create Contest
                </button>
            </div>
            <Suspense fallback={<div>Loading contests...</div>}>
                <ContestListClient
                    initialContests={initialContests}
                    isAdminView={false}
                    selectedTab={selectedTab}
                    onTabChange={setSelectedTab}
                />
            </Suspense>

            <ContestCreationModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                userId={userId}
                onViewAllDrafts={handleViewAllDrafts}
            />
        </div>
    );
} 