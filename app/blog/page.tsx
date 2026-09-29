import { createClient } from "@/utils/supabase/server";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Sparkles, Star, Heart, Palette, Trophy, Crown } from "lucide-react";
import SocialPair from "@/public/images/social_pair.avif";
import { BlogPostsGrid } from "@/app/blog/BlogPostsGrid";
import type { Metadata } from "next";

// Always fetch fresh data so newly published blogs show up immediately
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Blog - Creator Marketing Insights | Game Of Creators",
  description:
    "Discover creator marketing insights, strategies, and trends for brands and creators. Learn about performance-driven content, viral marketing, and gamified creator contests.",
  keywords:
    "creator marketing blog, influencer marketing insights, content creation tips, brand marketing strategies, social media marketing, creator contests, viral marketing, performance marketing",
  openGraph: {
    title: "Blog - Creator Marketing Insights | Game Of Creators",
    description:
      "Creator marketing insights for brands and creators focused on performance-driven content. Learn strategies, trends, and best practices.",
    type: "website",
    url: "https://www.gameofcreators.com/blog",
    siteName: "Game Of Creators",
    images: [
      {
        url: "https://www.gameofcreators.com/goc_ogc.png",
        width: 1200,
        height: 630,
        alt: "Game Of Creators Blog - Creator Marketing Insights",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog - Creator Marketing Insights | Game Of Creators",
    description:
      "Creator marketing insights for brands and creators focused on performance-driven content.",
    images: ["https://www.gameofcreators.com/goc_ogc.png"],
    creator: "@gameofcreators",
  },
  alternates: {
    canonical: "https://www.gameofcreators.com/blog",
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

export default async function BlogIndexPage() {
  const supabase = await createClient();

  const { data: posts, error } = await supabase
    .from("blog_posts")
    .select(
      "id, title, short_description, thumbnail, read_time_minutes, published_at, status, category"
    )
    .eq("status", "published")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Error loading blog posts:", error);
  }

  const safePosts = (posts || []) as {
    id: string;
    title: string;
    short_description: string | null;
    thumbnail: string | null;
    read_time_minutes: number | null;
    published_at: string | null;
    status?: string | null;
    category: string | null;
  }[];

  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL;

  // Structured data for blog listing page
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Game Of Creators Blog",
    description:
      "Creator marketing insights for brands and creators focused on performance-driven content.",
    url: `${siteUrl}/blog`,
    publisher: {
      "@type": "Organization",
      name: "Game Of Creators",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/goc_ogc.png`,
      },
    },
    blogPost: safePosts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.short_description
        ? post.short_description.replace(/<[^>]*>/g, "").trim()
        : undefined,
      image: post.thumbnail || undefined,
      datePublished: post.published_at || undefined,
      url: `${siteUrl}/blog/${post.id}`,
      articleSection: post.category || undefined,
    })),
  };

  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="min-h-screen bg-black text-white pt-[10px] overflow-hidden">
        <div className="relative z-20">
          <section className="pt-20 pb-12 md:pt-28 md:pb-16 relative overflow-hidden">

            <div className="container mx-auto px-4 text-center relative z-10">
              {/* Premium Badge */}
              <div className="inline-grid grid-cols-[auto_1fr] items-center gap-2 bg-[#FFFFFF1A] rounded-full px-3 py-1.5 sm:px-6 sm:py-3 mb-8 max-w-[92vw] sm:max-w-none mx-auto">
                <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
                <span className="text-xs sm:text-lg font-semibold bg-white bg-clip-text text-transparent leading-tight whitespace-normal text-left">
                  #1 Gamified Creator Marketing Platform
                </span>
              </div>

              {/* Enhanced Social Icons */}
              <div className="flex justify-center mb-8">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative">
                    <Image
                      src={SocialPair}
                      alt="Social Media Icons"
                      width={150}
                      height={40}
                      className="relative z-10"
                    />
                  </div>
                </div>
              </div>

              {/* Massive Gaming Title */}
              <h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent mb-6 text-center slide-up"
                style={{ animationDelay: "1s", fontFamily: "Montserrat, sans-serif" }}
              >
                Our Blogs
              </h1>

              {/* Strategic Subtitle */}
              <p
                className="text-lg md:text-2xl text-[#8E8E8E] max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
                style={{ animationDelay: "2s" }}
              >
                Creator marketing insights for brands and creators focused on performance-driven content.
              </p>
            </div>
          </section>

          {/* Blog Posts Section */}
          <section className="py-16 md:py-24 relative z-10">
            <div className="max-w-[1300px] mx-auto px-4">
              {/* Latest Heading */}
              {/* <div className="text-center mb-12">
              <h2
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl flex flex-wrap justify-center gap-x-2 md:gap-x-3 mb-4 leading-tight slide-up"
                style={{ animationDelay: "0.3s" }}
              >
                <span
                  className="font-semibold text-white drop-shadow-2xl"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                >
                  <span className="relative">
                    <span
                      className="bg-clip-text text-transparent"
                      style={{
                        backgroundImage:
                          "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
                      }}
                    >
                      Latest
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl"></div>
                  </span>
                </span>
              </h2>
              <p
                className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed slide-left"
                style={{ animationDelay: "0.5s" }}
              >
                Discover the latest trends, updates, and platform-specific
                strategies.
              </p>
            </div> */}

              {safePosts.length === 0 ? (
                <p className="text-center text-lg text-[#8E8E8E]">
                  No published blog posts yet.
                </p>
              ) : (
                <BlogPostsGrid posts={safePosts} />
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
