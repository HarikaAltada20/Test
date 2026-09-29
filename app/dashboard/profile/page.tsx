import React from "react";
import ProfilePage from "./client";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import { redirect } from "next/navigation";

export default async function page() {
  try {
    const supabase = await createClient();
    const user = await getSessionUser(supabase);
    const error = user ? null : new Error("No session");

    // Handle authentication errors
    if (error) {
      console.error("Auth error in profile page:", error);

      // Check if it's a network/fetch error
      if (
        error.name === "AuthRetryableFetchError" ||
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("fetch")
      ) {
        // For network errors, still render the page but let client handle it
        // The client component will show appropriate error messages
        return <ProfilePage user={null} />;
      }

      // For other auth errors, redirect to sign in
      redirect(
        "/auth/signin?error=auth_error&message=" +
          encodeURIComponent(error.message)
      );
    }

    return <ProfilePage user={user} />;
  } catch (error: any) {
    console.error("Unexpected error in profile page:", error);

    // Check if it's a network/fetch error
    if (
      error?.name === "AuthRetryableFetchError" ||
      error?.message?.includes("Failed to fetch") ||
      error?.message?.includes("fetch")
    ) {
      // For network errors, render page and let client handle it
      return <ProfilePage user={null} />;
    }

    // For other errors, redirect to sign in
    redirect("/auth/signin?error=unexpected_error");
  }
}
