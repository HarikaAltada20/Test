import { createClient } from "@/utils/supabase/server";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Sparkles, Star, Heart, Palette, Trophy, Crown } from "lucide-react";
import SocialPair from "@/public/images/social_pair.avif";
import { BlogPostsGrid } from "@/app/blog/BlogPostsGrid";

// Always fetch fresh data so newly published blogs show up immediately
export const revalidate = 0;

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

  return (
    <div className="min-h-screen bg-[#000825] text-white overflow-hidden border-b border-[#A87313]">
      <div className="relative z-20">
        {/* Floating Gaming Elements */}
        <section className="pt-20 pb-20 md:pt-28 md:pb-24 relative overflow-hidden">
          {/* Strategic Background Elements */}

          {/* Floating Creative Elements */}
          <div className="inset-0 z-10 pointer-events-none">
            <Sparkles className="absolute top-20 left-10 h-8 w-8 text-amber-400/30 animate-pulse" />
            <Sparkles
              className="absolute top-32 right-20 h-9 w-9 text-violet-400/40 animate-bounce"
              style={{ animationDelay: "1s" }}
            />
            <Star
              className="absolute top-40 left-1/4 h-9 w-9 text-purple-400/30 animate-pulse"
              style={{ animationDelay: "2s" }}
            />
            <Heart
              className="absolute top-60 right-1/3 h-5 w-5 text-pink-400/40 animate-bounce"
              style={{ animationDelay: "0.5s" }}
            />
            <Palette
              className="absolute bottom-40 left-16 h-6 w-6 text-indigo-400/30 animate-pulse"
              style={{ animationDelay: "1.5s" }}
            />
            <Trophy
              className="absolute bottom-32 right-12 h-9 w-9 text-amber-400/40 animate-bounce"
              style={{ animationDelay: "0.8s" }}
            />
          </div>
          {/* Orange Ellipse Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[1200px] h-[500px] rounded-full blur-3xl opacity-50 pointer-events-none bg-blue-ellipse"></div>

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
              className="text-3xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl flex flex-wrap justify-center gap-x-2 md:gap-x-3 mb-6 leading-tight text-center slide-up"
              style={{ animationDelay: "1s" }}
            >
              <span
                className="font-semibold text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Our
              </span>
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
                    Blogs
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl"></div>
                </span>
              </span>
            </h1>

            {/* Strategic Subtitle */}
            <p
              className="text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
              style={{ animationDelay: "2s" }}
            >
              Creator marketing
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent font-semibold">
                {" "}
                insights for
              </span>
              ,{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-semibold">
                brands and creators
              </span>{" "}
              focused on performance-driven content.
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
              <p className="text-center text-lg text-slate-300">
                No published blog posts yet.
              </p>
            ) : (
              <BlogPostsGrid posts={safePosts} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
