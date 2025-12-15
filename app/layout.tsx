import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import ReferralCapture from "@/components/ReferralCapture";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { createClient } from "@/utils/supabase/server";
import { ConditionalFooter } from "./conditional-footer";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { cookies } from "next/headers";
import { MobileAuthBridge } from "@/components/MobileAuthBridge";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Game Of Creators - Performance-Based Creator Marketing Platform",
  description:
    "Turn creativity into income with Game of Creators. Get paid based on views or ranking in brand contests - even with 0 followers. Join 1000s of creators earning through performance-based marketing.",
  metadataBase: new URL("https://www.gameofcreators.com"),
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/goc.png", type: "image/png" },
      { url: "/icon1.png", sizes: "96x96", type: "image/png" },
      { url: "/icon0.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Game Of Creators - Performance-Based Creator Marketing Platform",
    description:
      "Turn creativity into income with Game of Creators. Get paid based on views or ranking in brand contests - even with 0 followers. Join 1000s of creators earning through performance-based marketing.",
    url: "https://www.gameofcreators.com/",
    siteName: "Game Of Creators",
    images: [
      {
        url: "https://www.gameofcreators.com/goc_ogc.png",
        width: 1200,
        height: 630,
        alt: "Game Of Creators - Performance-based creator marketing platform where creators get paid based on views and ranking",
        type: "image/png",
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
    title: "Game Of Creators - Performance-Based Creator Marketing Platform",
    description:
      "Turn creativity into income with Game of Creators. Get paid based on views or ranking in brand contests - even with 0 followers.",
    images: ["https://www.gameofcreators.com/goc_ogc.png"],
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
  other: {
    "apple-mobile-web-app-title": "Game Of Creators",
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
      console.error(
        "Error fetching user profile data in layout:",
        userError.message
      );
    }

    if (userData) {
      profileFullName = userData.full_name;
      profilePictureUrl = userData.profile_picture_url;
      userType = userData.user_type as
        | "advertiser"
        | "creator"
        | "admin"
        | null;
    }

    // Fetch subscription info only for advertisers
    if (userType === "advertiser") {
      const { data: advertiserData, error: advertiserError } = await supabase
        .from("advertiser_profiles")
        .select("subscription_info")
        .eq("id", user.id)
        .maybeSingle();

      if (advertiserError && advertiserError.code !== "PGRST116") {
        console.error(
          "Error fetching advertiser profile in layout:",
          advertiserError.message
        );
      }

      if (advertiserData?.subscription_info) {
        // Extract product_id from subscription_info for display
        subscriptionPlan = advertiserData.subscription_info.product_id || null;
      }
    }
  }

  // Determine initial theme mode on the server from cookies to avoid white flash
  const cookieStore = await cookies();
  const presetCookie = cookieStore.get("dashboard-preset")?.value as
    | "game-of-creators"
    | "clean-professional"
    | "dark-professional"
    | undefined;
  const modeCookie = cookieStore.get("dashboard-mode")?.value as
    | "light"
    | "dark"
    | undefined;
  const presetToMode: Record<string, "light" | "dark"> = {
    "game-of-creators": "dark",
    "clean-professional": "light",
    "dark-professional": "dark",
  };
  const initialMode: "light" | "dark" = presetCookie
    ? presetToMode[presetCookie] || "light"
    : modeCookie === "dark" || modeCookie === "light"
    ? modeCookie
    : "light";

  return (
    <html lang="en" data-theme={initialMode} suppressHydrationWarning>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html{background:${
                initialMode === "dark" ? "#07031E" : "#ffffff"
              };color:${
              initialMode === "dark" ? "rgb(248, 250, 252)" : "#111827"
            }}
              body{background:inherit;color:inherit}
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var d = document.documentElement;
                  var get = function(k){
                    try { return window.localStorage.getItem(k); } catch(e) { return null; }
                  };
                  var mode = 'light';
                  var preset = get('dashboard-preset');
                  var presetToMode = { 'game-of-creators': 'dark', 'clean-professional': 'light', 'dark-professional': 'dark' };
                  if (preset && presetToMode[preset]) {
                    mode = presetToMode[preset];
                  } else {
                    var savedMode = get('dashboard-mode');
                    if (savedMode === 'dark' || savedMode === 'light') mode = savedMode;
                  }
                  d.setAttribute('data-theme', mode);
                  if (mode === 'dark') {
                    d.style.backgroundColor = '#07031E';
                    d.style.color = 'rgb(248, 250, 252)';
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <div className="relative flex min-h-screen flex-col">
          {/* Capture referral codes from landing links and store in localStorage */}
          <ReferralCapture />
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
        <SonnerToaster />
        <Analytics />
        {process.env.NEXT_PUBLIC_CLARITY_ID ? (
          <Script id="ms-clarity" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_ID}");
            `}
          </Script>
        ) : null}
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
        {/* Mobile Auth Bridge - Enables native authentication from Flutter app */}
        <MobileAuthBridge />
        <Script
          src="/mobile-auth-bridge.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
