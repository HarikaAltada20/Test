import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Toaster } from "@/components/ui/toaster";
import { createClient } from "@/utils/supabase/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Game Of Creators",
  description:
    "Connect brands with content creators for viral marketing campaigns",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  let profileFullName: string | null = null;
  let profilePictureUrl: string | null = null;

  if (user) {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("full_name, profile_picture_url")
      .eq("id", user.id)
      .maybeSingle();

    if (userError) {
      console.error("Error fetching user profile data in layout:", userError.message);
      // Decide if you want to handle this error more gracefully
    }

    if (userData) {
      profileFullName = userData.full_name;
      profilePictureUrl = userData.profile_picture_url;
    }
  }

  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <div className="relative flex min-h-screen flex-col">
          <Nav
            user={user}
            profileFullName={profileFullName}
            profilePictureUrl={profilePictureUrl}
          />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <Toaster />
      </body>
    </html>
  );
}
