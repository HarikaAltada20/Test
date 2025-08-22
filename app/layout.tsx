import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/toaster";
import { createClient } from "@/utils/supabase/server";
import { ConditionalFooter } from "./conditional-footer";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Game Of Creators",
  description: "Connect brands with content creators for viral marketing campaigns",
  metadataBase: new URL('https://www.gameofcreators.com'),
  icons: {
    icon: "/images/goc_square.avif",
  },
  openGraph: {
    title: "Game Of Creators",
    description: "Connect brands with content creators for viral marketing campaigns",
    url: "https://www.gameofcreators.com/",
    siteName: "Game Of Creators",
    images: [
      {
        url: "https://www.gameofcreators.com/images/goc_square.avif",
        width: 1200,
        height: 630,
        alt: "Game Of Creators Logo - Platform connecting brands with content creators",
        type: "image/webp",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  facebook: {
    appId: "9901516833263498",
  },
  twitter: {
    card: "summary_large_image",
    title: "Game Of Creators",
    description: "Connect brands with content creators for viral marketing campaigns",
    images: ["https://www.gameofcreators.com/images/goc_square.avif"],
    creator: "@gameofcreators",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
  let userType: "advertiser" | "creator" | "admin" | null = null;
  let subscriptionPlan: string | null = null;

  if (user) {
    // Fetch basic user profile data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("full_name, profile_picture_url, user_type")
      .eq("id", user.id)
      .maybeSingle();

    if (userError) {
      console.error("Error fetching user profile data in layout:", userError.message);
    }

    if (userData) {
      profileFullName = userData.full_name;
      profilePictureUrl = userData.profile_picture_url;
      userType = userData.user_type as "advertiser" | "creator" | "admin" | null;
    }

    // Fetch subscription info only for advertisers
    if (userType === "advertiser") {
      const { data: advertiserData, error: advertiserError } = await supabase
        .from("advertiser_profiles")
        .select("subscription_info")
        .eq("id", user.id)
        .maybeSingle();

      if (advertiserError && advertiserError.code !== 'PGRST116') {
        console.error("Error fetching advertiser profile in layout:", advertiserError.message);
      }

      if (advertiserData?.subscription_info) {
        // Extract product_id from subscription_info for display
        subscriptionPlan = advertiserData.subscription_info.product_id || null;
      }
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
            userType={userType}
            subscriptionPlan={subscriptionPlan}
          />
          <main className="flex-1">{children}</main>
          <ConditionalFooter />
        </div>
        <Toaster />
        <Analytics />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-8J6VZKVWLF"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8J6VZKVWLF', {
              page_path: window.location.pathname,
            });
          `}
        </Script>
      </body>
    </html>
  );
}
