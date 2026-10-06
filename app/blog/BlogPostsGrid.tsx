"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
type BlogPost = {
  id: string;
  title: string;
  short_description: string | null;
  thumbnail: string | null;
  read_time_minutes: number | null;
  published_at: string | null;
  status?: string | null;
  category: string | null;
};

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  // Use a fixed locale so server and client render the same string and avoid hydration mismatches
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const stripHtml = (html: string | null | undefined): string => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
};

type BlogPostsGridProps = {
  posts: BlogPost[];
};

export function BlogPostsGrid({ posts }: BlogPostsGridProps) {
  const [visibleCount, setVisibleCount] = useState(6);

  // Filter out any draft posts (safety check)
  const publishedPosts = posts.filter(
    (post) => post.status === "published" && post.published_at
  );

  const visiblePosts = publishedPosts.slice(0, visibleCount);
  const hasMore = visibleCount < publishedPosts.length;

  return (
    <>
      <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {visiblePosts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.id}`}
            className="group relative w-full rounded-[20px] p-[15px] px-[14px] bg-[linear-gradient(360deg,black_0%,#353535_100%)] shadow-[inset_0_0_4px_rgba(255,255,255,0.25)] overflow-hidden flex flex-col justify-start items-center gap-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[inset_0_0_8px_rgba(255,255,255,0.35)]"
          >
            {/* Thumbnail */}
            <div className="relative w-full h-[221px] rounded-[12px] bg-neutral-900 overflow-hidden shrink-0">
              {post.thumbnail ? (
                <img
                  src={post.thumbnail}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
              ) : (
                <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-neutral-500 text-sm">
                  No Thumbnail
                </div>
              )}

              {/* Overlay badges for read time and category */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-2">
                {post.read_time_minutes ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/70 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-medium text-white/90 border border-white/10">
                    {post.read_time_minutes} min read
                  </span>
                ) : null}
              </div>

              {post.category && (
                <div className="absolute bottom-2.5 left-2.5">
                  <span className="inline-flex items-center rounded-md bg-black/70 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                    {post.category}
                  </span>
                </div>
              )}
            </div>

            {/* Content area */}
            <div className="w-full flex-1 flex flex-col justify-between gap-5 px-1">
              <div className="flex flex-col gap-[9px]">
                <h2 className="text-[#F1F1F1] text-[17px] font-semibold leading-[25.5px] font-['Inter'] line-clamp-2 group-hover:text-white transition-colors">
                  {post.title}
                </h2>

                {stripHtml(post.short_description).length > 0 && (
                  <p className="text-[#8E8E8E] text-[15px] font-normal leading-[21px] font-['Inter'] line-clamp-3">
                    {stripHtml(post.short_description)}
                  </p>
                )}
              </div>

              {/* Bottom Footer Row */}
              <div className="w-full flex items-center justify-between pt-1">
                <div className="inline-flex items-center gap-1 px-3 py-2 rounded-[7px] bg-transparent group-hover:bg-white/10 transition-colors">
                  <span className="text-[#F1F1F1] text-[13px] font-medium leading-[18px] font-['Inter']">
                    Read More
                  </span>
                  <svg
                    className="w-3.5 h-3.5 text-[#F1F1F1] transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>

                <div className="text-[#757575] text-[12px] font-medium leading-[16px] font-['Inter']">
                  {formatDate(post.published_at)}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-12">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + 6)}
            className="px-5 py-2.5 bg-white text-[#353535] text-[14px] font-semibold leading-[20px] font-['Inter'] rounded-[12px] outline outline-1 outline-[#131313] outline-offset-[-1px] hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2"
          >
            View More blogs
          </button>
        </div>
      )}

        <section className="pt-16 px-4 sm:px-8 lg:px-24 bg-black flex justify-center items-center">
                      <div className="relative w-full max-w-[1200px] min-h-[471px] py-16 px-6 sm:px-12 flex flex-col justify-center items-center overflow-hidden rounded-[28px] border border-[#3A3636] bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] shadow-[inset_0px_0px_4px_rgba(255,255,255,0.25)]">
                        {/* Background Decorative Shapes */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                          {/* <div className="w-[990px] h-[441px] absolute left-[27px] top-[335px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-202px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" /> */}
                          {/* <div className="w-[990px] h-[441px] absolute left-[27px] top-[354px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-183px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[27px] top-[308px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-230px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[27px] top-[288px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-250px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" /> */}
                        </div>
              
                        {/* Main Content Box */}
                        <div className="relative z-10 max-w-[654px] mx-auto flex flex-col items-center text-center gap-9">
                          <div className="flex flex-col items-center gap-4">
                             <h2 className="text-[28px] sm:text-[36px] md:text-[40px] font-medium text-white leading-[130%] tracking-tight">
                        Want to promote your brand?
                        <br/>
                        Book a Call
                      </h2>
                            <p className="text-[15px] sm:text-[17px] font-medium text-[#8E8E8E] leading-[150%]">
                              Book a demo with{" "}
                              <span className="text-[#F1F1F1] font-semibold">Vishesh</span>
                              , Founder of Game Of Creators. Join hundreds of successful businesses. Get answers and start launching impactful campaigns with a free consultation.
                            </p>
                          </div>
              
                          <a
                            href="https://calendly.com/guptavishesh2/30min"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2.5 px-9 py-3 bg-[#DEDEDE] text-[#353535] hover:bg-white rounded-[14px] font-semibold text-base leading-[20px] transition-all duration-200 cursor-pointer shadow-md group"
                          >
                            <span>Book Call Now</span>
                            <ArrowRight className="w-4 h-4 text-[#353535] transition-transform group-hover:translate-x-0.5" />
                          </a>
                        </div>
                      </div>
                    </section>
    </>
  );
}
