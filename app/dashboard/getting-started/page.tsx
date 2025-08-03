import { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import GettingStartedClient from "./GettingStartedClient";

export const metadata: Metadata = {
    title: "Getting Started - Game Of Creators",
    description: "Learn how to use Game Of Creators platform with Leaderboard and CPM contests",
};

export default async function GettingStartedPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/auth/signin");
    }

    return <GettingStartedClient user={user} />;
} 