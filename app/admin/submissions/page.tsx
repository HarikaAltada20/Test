import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SubmissionVerificationClient from "./client";

export default async function AdminSubmissionsPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/auth/signin");
    }

    // Get user role from the database
    const { data: userData, error: userError } = await supabase
        .from("users")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (userError) {
        console.error("Error fetching user data:", userError);
        redirect("/dashboard?error=user_fetch_failed");
    }

    if (userData?.user_type !== "admin" && userData?.user_type !== "advertiser") {
        console.warn(`User ${user.id} with type ${userData?.user_type} attempted to access admin panel.`);
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen">
            <Suspense fallback={<div className="p-8">Loading admin panel...</div>}>
                <SubmissionVerificationClient />
            </Suspense>
        </div>
    );
} 